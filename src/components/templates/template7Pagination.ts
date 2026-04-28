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
}

const STANDARD_PAGE_CAPACITY = 34;
const LAST_PAGE_CAPACITY = 34;
const FIXED_FOOTER_LINES = 6;

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

  if (quote.notes) {
    lines += 1.2 + estimateWrappedLines(quote.notes, 88);
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

  if (currentLines + summaryLines <= LAST_PAGE_CAPACITY) {
    pages[pages.length - 1].showSummary = true;
    return pages;
  }

  const summaryPageItems: T[] = [];
  let summaryPageLines = summaryLines;

  for (let pageIndex = pages.length - 1; pageIndex >= 0; pageIndex -= 1) {
    while (pages[pageIndex].items.length > 0) {
      const candidate = pages[pageIndex].items[pages[pageIndex].items.length - 1] as T;
      const candidateLines = estimateItemLines(candidate);

      if (summaryPageLines + candidateLines > LAST_PAGE_CAPACITY) {
        break;
      }

      pages[pageIndex].items.pop();
      summaryPageItems.unshift(candidate);
      summaryPageLines += candidateLines;
    }

    if (summaryPageItems.length > 0) {
      break;
    }
  }

  while (pages.length > 0 && pages[pages.length - 1].items.length === 0) {
    pages.pop();
  }

  const lastContentPage = pages[pages.length - 1];
  if (summaryPageItems.length === 0 && lastContentPage && getItemsLines(lastContentPage.items) + summaryLines <= LAST_PAGE_CAPACITY) {
    lastContentPage.showSummary = true;
    return pages;
  }

  if (summaryPageItems.length === 0 && lastContentPage && getItemsLines(lastContentPage.items) + summaryLines <= STANDARD_PAGE_CAPACITY + 1) {
    lastContentPage.showSummary = true;
    return pages;
  }

  pages.push({ items: summaryPageItems, showSummary: true });

  return pages;
};