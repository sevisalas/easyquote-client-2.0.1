const EVENT_HANDLER_ATTR = /\son[a-z]+=("[^"]*"|'[^']*'|[^\s>]+)/gi;
const GENERIC_ATTRS = /\s(?:style|class|id|dir|lang)=("[^"]*"|'[^']*'|[^\s>]+)/gi;

export const sanitizePdfVariableHtml = (value: string | null | undefined): string => {
  const html = String(value ?? '').trim();
  if (!html) return '';

  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(EVENT_HANDLER_ATTR, '')
    .replace(GENERIC_ATTRS, '')
    .replace(/<(\/)?font\b[^>]*>/gi, '')
    .replace(/<(\/)?(h1|h2|h3|h4|h5|h6)\b/gi, '<$1p');
};

export const PDF_VARIABLE_TEXT_RESET_CSS = `
  [data-pdf-variable-text],
  [data-pdf-variable-text] * {
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: inherit !important;
    line-height: inherit !important;
    letter-spacing: 0 !important;
    max-width: 100% !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  [data-pdf-variable-text] p,
  [data-pdf-variable-text] div,
  [data-pdf-variable-text] li {
    margin: 0 0 2px 0 !important;
  }

  [data-pdf-variable-text] ul,
  [data-pdf-variable-text] ol {
    margin: 0 0 2px 16px !important;
    padding: 0 !important;
  }

  [data-pdf-variable-text] br {
    line-height: inherit !important;
  }
`;