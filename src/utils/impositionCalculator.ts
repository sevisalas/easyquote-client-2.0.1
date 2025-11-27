export interface ImpositionData {
  // Producto
  productWidth: number;  // mm
  productHeight: number; // mm
  bleed: number;         // mm (sangrado)
  
  // Pliego
  sheetWidth: number;    // mm (ancho total de la hoja)
  sheetHeight: number;   // mm (alto total de la hoja)
  validWidth: number;    // mm (ancho del área imprimible)
  validHeight: number;   // mm (alto del área imprimible)
  
  // Calles
  gutterH: number;       // mm (calle horizontal)
  gutterV: number;       // mm (calle vertical)
  
  // Calculados
  repetitionsH?: number;
  repetitionsV?: number;
  totalRepetitions?: number;
  utilization?: number;  // % aprovechamiento
  orientation?: 'horizontal' | 'vertical';
}

export interface CalculationResult {
  repetitionsH: number;
  repetitionsV: number;
  totalRepetitions: number;
  utilization: number;
  orientation: 'horizontal' | 'vertical';
}

/**
 * Calcula las repeticiones y aprovechamiento del pliego
 */
export function calculateImposition(data: ImpositionData): CalculationResult {
  const { 
    productWidth, 
    productHeight, 
    bleed, 
    validWidth, 
    validHeight, 
    gutterH, 
    gutterV 
  } = data;
  
  // Tamaño del producto con sangrado
  const productWithBleedW = productWidth + (bleed * 2);
  const productWithBleedH = productHeight + (bleed * 2);
  
  // Calcular repeticiones en orientación normal (horizontal - sin rotar)
  const repsH_normal = Math.floor((validWidth + gutterH) / (productWithBleedW + gutterH));
  const repsV_normal = Math.floor((validHeight + gutterV) / (productWithBleedH + gutterV));
  const total_normal = repsH_normal * repsV_normal;
  
  // Calcular repeticiones en orientación rotada (90°)
  const repsH_rotated = Math.floor((validWidth + gutterH) / (productWithBleedH + gutterH));
  const repsV_rotated = Math.floor((validHeight + gutterV) / (productWithBleedW + gutterV));
  const total_rotated = repsH_rotated * repsV_rotated;
  
  // Priorizar orientación normal (sin rotar) a menos que rotado quepa 50% más
  // Esto mantiene la orientación del producto igual a la del pliego cuando sea razonable
  const useRotated = total_rotated > total_normal * 1.5;
  
  const repetitionsH = useRotated ? repsH_rotated : repsH_normal;
  const repetitionsV = useRotated ? repsV_rotated : repsV_normal;
  const totalRepetitions = repetitionsH * repetitionsV;
  
  // Calcular aprovechamiento
  const usedWidth = useRotated ? productWithBleedH : productWithBleedW;
  const usedHeight = useRotated ? productWithBleedW : productWithBleedH;
  const totalUsedArea = totalRepetitions * (usedWidth * usedHeight);
  const totalValidArea = validWidth * validHeight;
  const utilization = totalValidArea > 0 ? (totalUsedArea / totalValidArea) * 100 : 0;
  
  return {
    repetitionsH,
    repetitionsV,
    totalRepetitions,
    utilization: Math.round(utilization * 10) / 10, // 1 decimal
    orientation: useRotated ? 'vertical' : 'horizontal'
  };
}

/**
 * Actualiza los datos de imposición con los valores calculados
 */
export function updateCalculatedValues(data: ImpositionData): ImpositionData {
  const result = calculateImposition(data);
  return {
    ...data,
    repetitionsH: result.repetitionsH,
    repetitionsV: result.repetitionsV,
    totalRepetitions: result.totalRepetitions,
    utilization: result.utilization,
    orientation: result.orientation
  };
}
