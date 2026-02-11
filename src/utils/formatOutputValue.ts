/**
 * Rounds numeric output values for display.
 * Only formats outputs with type "Generic" (2 decimals) or "UnitPrice" (4 decimals).
 * All other types are returned as-is.
 */
export function formatOutputValue(value: string, type?: string): string {
  if (!value || value.trim() === '') return value;

  const t = (type || '').toLowerCase();

  // Only format Generic and UnitPrice types
  if (t !== 'generic' && t !== 'unitprice') return value;

  // Don't format URLs or #N/A
  if (/^https?:\/\//i.test(value) || value === '#N/A') return value;

  // Try to parse as number (support Spanish format: 1.234,56)
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);

  if (!Number.isFinite(num)) return value;

  const decimals = t === 'unitprice' ? 4 : 2;

  return num.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
