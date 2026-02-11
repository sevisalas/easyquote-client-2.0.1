/**
 * Rounds numeric output values for display.
 * - UnitPrice type: 4 decimal places
 * - All other numeric values: 2 decimal places
 * - Non-numeric values are returned as-is
 */
export function formatOutputValue(value: string, type?: string): string {
  if (!value || value.trim() === '') return value;
  
  // Don't format URLs or #N/A
  if (/^https?:\/\//i.test(value) || value === '#N/A') return value;
  
  // Try to parse as number (support Spanish format: 1.234,56)
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  
  if (!Number.isFinite(num)) return value;
  
  // Determine decimal places based on type
  const decimals = type && type.toLowerCase() === 'unitprice' ? 4 : 2;
  
  // Format with Spanish locale
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
