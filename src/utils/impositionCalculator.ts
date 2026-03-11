// Valores válidos de páginas por pliego (total ambas caras) para encuadernación
export const VALID_PAGES_PER_SHEET = [4, 8, 12, 16, 24, 32] as const;

export interface ImpositionData {
  // Producto
  productWidth: number;  // mm
  productHeight: number; // mm
  bleed: number;         // mm (sangrado)
  
  // Área válida de impresión
  validWidth: number;    // mm (ancho del área imprimible)
  validHeight: number;   // mm (alto del área imprimible)
  
  // Calles
  gutterH: number;       // mm (calle horizontal)
  gutterV: number;       // mm (calle vertical)
  
  // Encuadernación: páginas por pliego (total ambas caras)
  // Cuando > 0, totalRepetitions se ajusta al valor válido más cercano ≤ calculado
  pagesPerSheet?: number;
  
  // Calculados
  repetitionsH?: number;
  repetitionsV?: number;
  totalRepetitions?: number;
  rawTotalRepetitions?: number; // antes del ajuste por pagesPerSheet
  utilization?: number;  // % aprovechamiento
  orientation?: 'horizontal' | 'vertical';

  // Legacy (kept for backward compat with saved data, not used in calc)
  sheetWidth?: number;
  sheetHeight?: number;
}

export interface CalculationResult {
  repetitionsH: number;
  repetitionsV: number;
  totalRepetitions: number;
  rawTotalRepetitions?: number;
  adjustedPagesPerSheet?: number;
  utilization: number;
  orientation: 'horizontal' | 'vertical';
}

/**
 * Calcula las repeticiones y aprovechamiento del pliego
 */
export function calculateImposition(data: ImpositionData): CalculationResult {
  const { 
    validWidth,
    validHeight,
    productWidth, 
    productHeight, 
    bleed, 
    gutterH, 
    gutterV 
  } = data;
  
  // Tamaño del producto con calles (el sangrado NO se suma como espacio extra
  // porque en imposición las piezas comparten la zona de sangrado con las adyacentes)
  const cellW = productWidth + gutterH;
  const cellH = productHeight + gutterV;
  
  // Calcular repeticiones con PRODUCTO en horizontal
  const repsH_prodHoriz = Math.floor(validWidth / cellW);
  const repsV_prodHoriz = Math.floor(validHeight / cellH);
  const total_prodHoriz = repsH_prodHoriz * repsV_prodHoriz;
  
  // Calcular repeticiones con PRODUCTO en vertical (rotado 90°)
  const cellW_vert = productHeight + gutterH;
  const cellH_vert = productWidth + gutterV;
  const repsH_prodVert = Math.floor(validWidth / cellW_vert);
  const repsV_prodVert = Math.floor(validHeight / cellH_vert);
  const total_prodVert = repsH_prodVert * repsV_prodVert;
  
  // Elegir la mejor orientación DEL PRODUCTO
  const useVertical = total_prodVert > total_prodHoriz;
  
  const repetitionsH = useVertical ? repsH_prodVert : repsH_prodHoriz;
  const repetitionsV = useVertical ? repsV_prodVert : repsV_prodHoriz;
  const totalRepetitions = repetitionsH * repetitionsV;
  
  // Calcular aprovechamiento
  const usedCellW = useVertical ? cellW_vert : cellW;
  const usedCellH = useVertical ? cellH_vert : cellH;
  const totalUsedArea = totalRepetitions * (usedCellW * usedCellH);
  const totalValidArea = validWidth * validHeight;
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
