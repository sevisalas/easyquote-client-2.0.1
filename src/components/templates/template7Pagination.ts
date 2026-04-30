export interface Template7PaginationItem {
  name?: string;
  description?: string;
  description_manual?: boolean;
  prompts?: Array<{ label?: string; value?: string }>;
  components?: Array<{ alias?: string; prompts?: Array<{ label?: string; value?: string }> }>;
  item_additionals?: Array<{ name?: string }>;
  multi_extra?: Array<{ qty?: number; price?: number }>;
}

export interface Template7PaginationPage<T = Template7PaginationItem> {
  items: T[];
  showSummary: boolean;
  showNotes?: boolean;
}

// Capacidad efectiva de líneas por página A4 con la cabecera/pie de T7/T8.
// 42 estaba siendo demasiado conservador para artículos simples con descripción
// manual larga, dejando huecos grandes y forzando saltos innecesarios. Subimos
// ligeramente la capacidad, manteniendo margen para los casos complejos.
const STANDARD_PAGE_CAPACITY = 46;
const LAST_PAGE_CAPACITY = 48;
const FOOTER_RESERVE_SHARE = 0.25;
const FIXED_FOOTER_LINES = 4;

const stripHtml = (value: string) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();

const estimateWrappedLines = (value: string, charsPerLine: number) => {
  const text = stripHtml(value);
  if (!text) return 0;

  return text.split(/\r?\n/).reduce((total, line) => {
    const clean = line.trim();
    if (!clean) return total + 1;
    return total + Math.max(1, Math.ceil(clean.length / charsPerLine));
  }, 0);
};

const estimateItemLines = (item: Template7PaginationItem) => {
  const hasStructuredDetails = Boolean(
    item.prompts?.length ||
    item.components?.length ||
    item.item_additionals?.length ||
    item.multi_extra?.length
  );

  // Base por item: cabecera del producto + fila de cantidad/precio + margen.
  // Para artículos simples (solo descripción) usamos una base algo menor porque
  // el cálculo anterior estaba sobredimensionando su altura real en PDF.
  let lines = hasStructuredDetails ? 3.2 : 2.7;

  if ((!item.prompts || item.prompts.length === 0) && item.description) {
    const charsPerLine = item.description_manual ? 128 : 120;
    const descriptionLines = estimateWrappedLines(item.description, charsPerLine);
    // Colchón pequeño para absorber pequeñas diferencias de render sin volver a
    // empujar artículos completos a la página siguiente antes de tiempo.
    const safetyLines = item.description_manual ? 0.6 : 0.3;
    lines += descriptionLines + safetyLines;
  }

  if (item.prompts?.length) {
    lines += item.prompts.reduce(
      (total, prompt) => total + estimateWrappedLines(`${prompt.label || ''}: ${prompt.value || ''}`, 72),
      0
    );
  }

  if (item.components?.length) {
    lines += item.components.reduce((total, component) => {
      const promptLines = (component.prompts || []).reduce(
        (promptTotal, prompt) => promptTotal + estimateWrappedLines(`${prompt.label || ''}: ${prompt.value || ''}`, 68),
        0
      );
      // 1.8 para header del componente "── Alias ──" + spacing
      return total + 1.8 + promptLines;
    }, 0);
  }

  if (item.item_additionals?.length) {
    lines += item.item_additionals.length;
  }

  if (item.multi_extra?.length) {
    // Cada fila multi-cantidad renderiza con padding ~1.4 líneas
    lines += item.multi_extra.length * 1.4;
  }

  return lines + 0.8;
};

const getItemsLines = (items: Template7PaginationItem[]) =>
  items.reduce((total, item) => total + estimateItemLines(item), 0);

const estimateSummaryLines = ({
  quote,
  quoteAdditionals,
}: {
  quote: any;
  quoteAdditionals: any[];
}) => {
  let lines = FIXED_FOOTER_LINES;

  if (quoteAdditionals.length > 0) {
    lines += quoteAdditionals.length;
  }

  if (quote.tax_amount > 0 || quote.discount_amount > 0) {
    lines += 1;
  }
  if (quote.tax_amount > 0) {
    lines += 1;
  }
  if (quote.discount_amount > 0) {
    lines += 1;
  }

  if (quoteAdditionals.length > 0 || quote.tax_amount > 0 || quote.discount_amount > 0 || (quote.items_count || 0) > 1) {
    lines += 1.5;
  }

  return lines;
};

const estimateNotesLines = (quote: any) => {
  if (!quote?.notes) return 0;
  return 1.2 + estimateWrappedLines(quote.notes, 124);
};

const shouldRenderSummary = ({
  itemsCount,
  quote,
  quoteAdditionals,
}: {
  itemsCount: number;
  quote: any;
  quoteAdditionals: any[];
}) => itemsCount > 1 || quoteAdditionals.length > 0 || quote.tax_amount > 0 || quote.discount_amount > 0;

const buildItemOnlyPages = <T extends Template7PaginationItem>(items: T[]) => {
  if (items.length === 0) return [] as Template7PaginationPage<T>[];

  const pages: Template7PaginationPage<T>[] = [{ items: [], showSummary: false }];
  let currentPageIndex = 0;
  let currentLines = 0;

  items.forEach((item) => {
    const itemLines = estimateItemLines(item);
    const currentPage = pages[currentPageIndex];

    if (currentPage.items.length > 0 && currentLines + itemLines > STANDARD_PAGE_CAPACITY) {
      pages.push({ items: [], showSummary: false });
      currentPageIndex += 1;
      currentLines = 0;
    }

    pages[currentPageIndex].items.push(item);
    currentLines += itemLines;
  });

  return pages;
};

export const paginateTemplate7Items = <T extends Template7PaginationItem>({
  items,
  quote,
  quoteAdditionals,
  reserveFooterShare = 0,
}: {
  items: T[];
  quote: any;
  quoteAdditionals: any[];
  reserveFooterShare?: number;
}): Template7PaginationPage<T>[] => {
  const showSummary = shouldRenderSummary({
    itemsCount: items.length,
    quote,
    quoteAdditionals,
  });

  const summaryLines = showSummary
    ? estimateSummaryLines({
        quote: { ...quote, items_count: items.length },
        quoteAdditionals,
      })
    : 0;
  const notesLines = estimateNotesLines(quote);
  const reservedFooterLines = Math.ceil(LAST_PAGE_CAPACITY * Math.min(Math.max(reserveFooterShare, 0), FOOTER_RESERVE_SHARE));

  if (items.length === 0) {
    return [{ items: [], showSummary, showNotes: notesLines > 0 }];
  }

  const summaryBlockLines = summaryLines + notesLines + reservedFooterLines;
  const lastPageItemsCapacity = Math.max(0, LAST_PAGE_CAPACITY - summaryBlockLines);
  const itemLines = items.map((item) => estimateItemLines(item));

  const linePrefix = itemLines.reduce<number[]>((acc, value) => {
    acc.push((acc[acc.length - 1] || 0) + value);
    return acc;
  }, []);

  const getRangeLines = (start: number, end: number) => {
    if (start > end) return 0;
    return linePrefix[end] - (start > 0 ? linePrefix[start - 1] : 0);
  };

  const memo = new Map<number, number[][] | null>();

  const isBetterCandidate = (candidate: number[][], currentBest: number[][] | null) => {
    if (!currentBest) return true;
    if (candidate.length !== currentBest.length) {
      return candidate.length < currentBest.length;
    }

    for (let pageIndex = 0; pageIndex < candidate.length; pageIndex += 1) {
      const candidateLines = getRangeLines(candidate[pageIndex][0], candidate[pageIndex][1]);
      const bestLines = getRangeLines(currentBest[pageIndex][0], currentBest[pageIndex][1]);

      if (candidateLines !== bestLines) {
        return candidateLines > bestLines;
      }
    }

    return false;
  };

  const solve = (startIndex: number): number[][] | null => {
    if (startIndex >= items.length) return [];

    const cached = memo.get(startIndex);
    if (cached !== undefined) return cached;

    let best: number[][] | null = null;

    // Si el resto cabe en la última página junto al bloque de cierre, usamos esa
    // solución directamente. Esto minimiza páginas y deja la última lo más vacía
    // posible solo cuando no aumenta el número total de páginas.
    if (startIndex === items.length - 1 || getRangeLines(startIndex, items.length - 1) <= lastPageItemsCapacity) {
      best = [[startIndex, items.length - 1]];
    }

    let currentLines = 0;
    for (let endIndex = startIndex; endIndex < items.length - 1; endIndex += 1) {
      currentLines += itemLines[endIndex];

      if (endIndex > startIndex && currentLines > STANDARD_PAGE_CAPACITY) {
        break;
      }

      const remainder = solve(endIndex + 1);
      if (!remainder) continue;

      const candidate = [[startIndex, endIndex], ...remainder];
      if (isBetterCandidate(candidate, best)) {
        best = candidate;
      }

      if (currentLines > STANDARD_PAGE_CAPACITY) {
        break;
      }
    }

    memo.set(startIndex, best);
    return best;
  };

  const pageRanges = solve(0) || [[0, items.length - 1]];
  const pages = pageRanges.map(([startIndex, endIndex]) => ({
    items: items.slice(startIndex, endIndex + 1),
    showSummary: false,
  }));

  const lastPage = pages[pages.length - 1];
  lastPage.showSummary = showSummary;
  lastPage.showNotes = notesLines > 0;

  return pages;
};