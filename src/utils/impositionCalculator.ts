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
  // Forzamos la hoja a horizontal (landscape)
  const sheetW = Math.max(data.sheetWidth, data.sheetHeight);
  const sheetH = Math.min(data.sheetWidth, data.sheetHeight);
  const validW = Math.max(data.validWidth, data.validHeight);
  const validH = Math.min(data.validWidth, data.validHeight);
  
  const { productWidth, productHeight, bleed, gutterH, gutterV } = data;
  
  // Tamaño del producto con sangrado
  const productWithBleedW = productWidth + (bleed * 2);
  const productWithBleedH = productHeight + (bleed * 2);
  
  // Calcular repeticiones con PRODUCTO en horizontal
  const repsH_prodHoriz = Math.floor(validW / (productWithBleedW + gutterH));
  const repsV_prodHoriz = Math.floor(validH / (productWithBleedH + gutterV));
  const total_prodHoriz = repsH_prodHoriz * repsV_prodHoriz;
  
  // Calcular repeticiones con PRODUCTO en vertical (rotado 90°)
  const repsH_prodVert = Math.floor(validW / (productWithBleedH + gutterH));
  const repsV_prodVert = Math.floor(validH / (productWithBleedW + gutterV));
  const total_prodVert = repsH_prodVert * repsV_prodVert;
  
  // Elegir la mejor orientación DEL PRODUCTO
  const useVertical = total_prodVert > total_prodHoriz;
  
  const repetitionsH = useVertical ? repsH_prodVert : repsH_prodHoriz;
  const repetitionsV = useVertical ? repsV_prodVert : repsV_prodHoriz;
  const totalRepetitions = repetitionsH * repetitionsV;
  
  // Calcular aprovechamiento
  const usedWidth = useVertical ? productWithBleedH : productWithBleedW;
  const usedHeight = useVertical ? productWithBleedW : productWithBleedH;
  const totalUsedArea = totalRepetitions * (usedWidth * usedHeight);
  const totalValidArea = validW * validH;
  const utilization = totalValidArea > 0 ? (totalUsedArea / totalValidArea) * 100 : 0;
  
  return {
    repetitionsH,
    repetitionsV,
    totalRepetitions,
    utilization: Math.round(utilization * 10) / 10,
    orientation: useVertical ? 'vertical' : 'horizontal'
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
