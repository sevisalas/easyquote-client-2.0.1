/**
 * Utilidades para manejar valores de checkbox
 * 
 * Valores considerados como "marcado" (checked):
 * - true, 1, "1", "true", "sí", "si", "on", "checked"
 * 
 * Valores considerados como "desmarcado" (unchecked):
 * - false, 0, "0", "false", "no", "off", "unchecked", "", null, undefined
 */

// Valores que se consideran "marcado"
const CHECKED_VALUES = new Set([
  true,
  1,
  "1",
  "true",
  "sí",
  "si",
  "on",
  "checked",
]);

// Valores que se consideran "desmarcado"
const UNCHECKED_VALUES = new Set([
  false,
  0,
  "0",
  "false",
  "no",
  "off",
  "unchecked",
  "",
  null,
  undefined,
]);

/**
 * Detecta el formato original de un valor checkbox
 * Retorna: 'boolean' | 'number' | 'string' | 'unknown'
 */
export type CheckboxFormat = 'boolean' | 'number' | 'string-truthy' | 'string-spanish' | 'string-onoff' | 'unknown';

export function detectCheckboxFormat(value: any): CheckboxFormat {
  if (value === true || value === false) return 'boolean';
  if (value === 1 || value === 0) return 'number';
  
  const strVal = String(value).toLowerCase().trim();
  
  if (strVal === 'true' || strVal === 'false') return 'string-truthy';
  if (strVal === 'sí' || strVal === 'si' || strVal === 'no') return 'string-spanish';
  if (strVal === 'on' || strVal === 'off') return 'string-onoff';
  if (strVal === '1' || strVal === '0') return 'number'; // Treat string numbers as number format
  if (strVal === 'checked' || strVal === 'unchecked') return 'string-truthy';
  
  return 'unknown';
}

/**
 * Determina si un valor representa "marcado" (checked)
 */
export function isCheckedValue(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  
  // Direct match
  if (CHECKED_VALUES.has(value)) return true;
  
  // String comparison (case-insensitive)
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return CHECKED_VALUES.has(normalized);
  }
  
  return false;
}

/**
 * Determina si un valor representa "desmarcado" (unchecked)
 */
export function isUncheckedValue(value: any): boolean {
  if (value === null || value === undefined || value === '') return true;
  
  // Direct match
  if (UNCHECKED_VALUES.has(value)) return true;
  
  // String comparison (case-insensitive)
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return UNCHECKED_VALUES.has(normalized);
  }
  
  return false;
}

/**
 * Convierte un valor booleano al formato original detectado
 * @param checked - true/false del checkbox UI
 * @param originalFormat - formato detectado del valor original
 * @param originalValue - valor original (para preservar case/accent)
 */
export function toOriginalFormat(checked: boolean, originalFormat: CheckboxFormat, originalValue?: any): any {
  switch (originalFormat) {
    case 'boolean':
      return checked;
    
    case 'number':
      return checked ? 1 : 0;
    
    case 'string-truthy':
      return checked ? 'true' : 'false';
    
    case 'string-spanish':
      // Preserve original casing if available
      if (originalValue) {
        const orig = String(originalValue);
        if (checked) {
          // Return "Sí" or "sí" based on original case
          return orig === orig.toUpperCase() ? 'SÍ' : (orig[0] === orig[0].toUpperCase() ? 'Sí' : 'sí');
        } else {
          return orig === orig.toUpperCase() ? 'NO' : (orig[0] === orig[0].toUpperCase() ? 'No' : 'no');
        }
      }
      return checked ? 'Sí' : 'No';
    
    case 'string-onoff':
      return checked ? 'on' : 'off';
    
    case 'unknown':
    default:
      // Default to boolean for unknown formats
      return checked;
  }
}

/**
 * Guarda metadata del formato original en el valor
 * Útil para preservar el formato al hacer PATCH
 */
export interface CheckboxValueWithMeta {
  value: boolean;
  originalFormat: CheckboxFormat;
  originalValue: any;
}

export function createCheckboxMeta(originalValue: any): CheckboxValueWithMeta {
  return {
    value: isCheckedValue(originalValue),
    originalFormat: detectCheckboxFormat(originalValue),
    originalValue,
  };
}

/**
 * Extrae el valor para enviar a la API manteniendo el formato original
 */
export function getApiValue(meta: CheckboxValueWithMeta | boolean, fallbackFormat: CheckboxFormat = 'boolean'): any {
  if (typeof meta === 'boolean') {
    return toOriginalFormat(meta, fallbackFormat);
  }
  return toOriginalFormat(meta.value, meta.originalFormat, meta.originalValue);
}
