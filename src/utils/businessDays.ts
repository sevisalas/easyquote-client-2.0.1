/**
 * Utility functions for calculating business days (excluding weekends)
 */

/**
 * Adds business days to a given date (excludes Saturdays and Sundays)
 * @param startDate - The starting date
 * @param days - Number of business days to add
 * @returns The resulting date after adding business days
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  
  return result;
}

/**
 * Calculates delivery date based on production type prompt value
 * @param productionValue - The value of the PRODUCCION prompt (e.g., "Normal ... días" or "Urgente 24/48 horas")
 * @param orderDate - The order date (defaults to today)
 * @returns The calculated delivery date as ISO string, or null if not determinable
 */
export function calculateDeliveryDateFromProduction(
  productionValue: string | undefined | null,
  orderDate: Date = new Date()
): string | null {
  if (!productionValue) return null;
  
  const lowerValue = productionValue.toLowerCase();
  
  // Check for urgent production (2 business days)
  if (lowerValue.includes('urgente') || lowerValue.includes('24/48')) {
    const deliveryDate = addBusinessDays(orderDate, 2);
    return deliveryDate.toISOString().split('T')[0];
  }
  
  // Check for normal production (5 business days)
  if (lowerValue.includes('normal')) {
    const deliveryDate = addBusinessDays(orderDate, 5);
    return deliveryDate.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Finds the PRODUCCION prompt value from an array of prompts
 * @param prompts - Array of prompt objects with label and value
 * @returns The production value if found, null otherwise
 */
export function findProductionPromptValue(
  prompts: Array<{ label?: string; value?: any }> | Record<string, any> | null | undefined
): string | null {
  if (!prompts) return null;
  
  // Handle array format
  if (Array.isArray(prompts)) {
    const productionPrompt = prompts.find(p => 
      p.label?.toLowerCase().includes('produccion') || 
      p.label?.toLowerCase().includes('producción')
    );
    return productionPrompt?.value?.toString() || null;
  }
  
  // Handle object format (keyed by ID)
  const entries = Object.values(prompts);
  for (const prompt of entries) {
    if (prompt && typeof prompt === 'object') {
      const label = (prompt as any).label?.toLowerCase() || '';
      if (label.includes('produccion') || label.includes('producción')) {
        return (prompt as any).value?.toString() || null;
      }
    }
  }
  
  return null;
}
