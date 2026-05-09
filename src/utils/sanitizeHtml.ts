import DOMPurify from "dompurify";

/**
 * Sanitize untrusted HTML before injecting via dangerouslySetInnerHTML.
 * Used for quote/order item descriptions and email/footer templates that
 * may originate from low-privilege org members.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(String(input), { USE_PROFILES: { html: true } });
}

/** Sanitize a description that uses \n line breaks rendered as <br/>. */
export function sanitizeDescriptionHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(String(input).replace(/\n/g, "<br/>"));
}