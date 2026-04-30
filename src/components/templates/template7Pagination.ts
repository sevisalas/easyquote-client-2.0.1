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
  const lastPageItemsCapacity = Math.max(0, LAST_PAGE_CAPACITY - reservedFooterLines - summaryLines - notesLines);

  if (items.length === 0) {
    return [{ items: [], showSummary, showNotes: notesLines > 0 }];
  }

  const lastPageItems: T[] = [];
  let lastPageItemsLines = 0;
  let splitIndex = items.length;

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const itemLines = estimateItemLines(item);

    if (lastPageItems.length === 0) {
      lastPageItems.unshift(item);
      lastPageItemsLines += itemLines;
      splitIndex = index;
      continue;
    }

    if (lastPageItemsLines + itemLines <= lastPageItemsCapacity) {
      lastPageItems.unshift(item);
      lastPageItemsLines += itemLines;
      splitIndex = index;
      continue;
    }

    break;
  }

  const leadingItems = items.slice(0, splitIndex);
  const pages = buildItemOnlyPages(leadingItems);
  pages.push({ items: lastPageItems, showSummary, showNotes: notesLines > 0 });

  return pages;
};