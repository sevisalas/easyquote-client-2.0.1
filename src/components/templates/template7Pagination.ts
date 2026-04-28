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

const STANDARD_PAGE_CAPACITY = 48;
const LAST_PAGE_CAPACITY = 48;
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
  let lines = 2.5;

  if ((!item.prompts || item.prompts.length === 0) && item.description) {
    const charsPerLine = item.description_manual ? 60 : 72;
    const safetyMultiplier = item.description_manual ? 1.35 : 1;
    lines += estimateWrappedLines(item.description, charsPerLine) * safetyMultiplier;
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
      return total + 1.2 + promptLines;
    }, 0);
  }

  if (item.item_additionals?.length) {
    lines += item.item_additionals.length;
  }

  if (item.multi_extra?.length) {
    lines += item.multi_extra.length;
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
  return 1.2 + estimateWrappedLines(quote.notes, 88);
};

export const paginateTemplate7Items = <T extends Template7PaginationItem>({
  items,
  quote,
  quoteAdditionals,
}: {
  items: T[];
  quote: any;
  quoteAdditionals: any[];
}): Template7PaginationPage<T>[] => {
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

  const summaryLines = estimateSummaryLines({
    quote: { ...quote, items_count: items.length },
    quoteAdditionals,
  });
  const notesLines = estimateNotesLines(quote);

  // Caso 1: TOTAL + notas caben con los items
  if (currentLines + summaryLines + notesLines <= LAST_PAGE_CAPACITY) {
    pages[pages.length - 1].showSummary = true;
    pages[pages.length - 1].showNotes = notesLines > 0;
    return pages;
  }

  // Caso 2: TOTAL cabe con los items, las notas no → notas a página nueva
  if (currentLines + summaryLines <= LAST_PAGE_CAPACITY) {
    pages[pages.length - 1].showSummary = true;
    if (notesLines > 0) {
      pages.push({ items: [] as T[], showSummary: false, showNotes: true });
    }
    return pages;
  }

  // Caso 3: Ni TOTAL cabe → TOTAL (+ notas si caben juntas) a página nueva
  pages.push({ items: [] as T[], showSummary: true, showNotes: notesLines > 0 });
  return pages;
};