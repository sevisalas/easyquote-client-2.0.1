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
    gutterV,
    pagesPerSheet
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
  
  let repetitionsH = useVertical ? repsH_prodVert : repsH_prodHoriz;
  let repetitionsV = useVertical ? repsV_prodVert : repsV_prodHoriz;
  let totalRepetitions = repetitionsH * repetitionsV;
  const rawTotalRepetitions = totalRepetitions;
  
  // ─── Ajuste por páginas/pliego para encuadernación ───
  // pagesPerSheet > 0 indica que las repeticiones totales × 2 caras
  // deben ajustarse al valor válido más cercano ≤ calculado
  let adjustedPagesPerSheet: number | undefined;
  if (pagesPerSheet && pagesPerSheet > 0) {
    const totalPages = totalRepetitions * 2; // ambas caras del pliego
    // Buscar el mayor valor válido ≤ totalPages
    const validSorted = [...VALID_PAGES_PER_SHEET].sort((a, b) => b - a);
    const snapped = validSorted.find(v => v <= totalPages) || validSorted[validSorted.length - 1];
    adjustedPagesPerSheet = snapped;
    // Recalcular repeticiones por cara
    const adjustedPerSide = snapped / 2;
    if (adjustedPerSide < totalRepetitions) {
      totalRepetitions = adjustedPerSide;
      // Ajustar H y V para que sigan siendo coherentes
      // Mantener la relación original de aspecto H×V lo más posible
      if (repetitionsH > 0 && repetitionsV > 0) {
        // Intentar mantener repetitionsH y reducir repetitionsV
        const newV = Math.floor(adjustedPerSide / repetitionsH);
        if (newV > 0 && newV * repetitionsH === adjustedPerSide) {
          repetitionsV = newV;
        } else {
          // Intentar mantener repetitionsV y reducir repetitionsH
          const newH = Math.floor(adjustedPerSide / repetitionsV);
          if (newH > 0 && newH * repetitionsV === adjustedPerSide) {
            repetitionsH = newH;
          } else {
            // Factorización más cercana
            for (let h = repetitionsH; h >= 1; h--) {
              if (adjustedPerSide % h === 0) {
                repetitionsH = h;
                repetitionsV = adjustedPerSide / h;
                break;
              }
            }
          }
        }
      }
    }
  }
  
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
    rawTotalRepetitions: rawTotalRepetitions !== totalRepetitions ? rawTotalRepetitions : undefined,
    adjustedPagesPerSheet,
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
    rawTotalRepetitions: result.rawTotalRepetitions,
    utilization: result.utilization,
    orientation: result.orientation
  };
}
