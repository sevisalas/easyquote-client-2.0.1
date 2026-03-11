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
  pagesPerSheet?: number;
  
  // Manual mode: when true, user controls orientation and reps directly
  isManual?: boolean;
  
  // Calculados (o manuales si isManual=true)
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
 * Calcula las repeticiones y aprovechamiento del pliego.
 * En modo manual (isManual=true), usa repetitionsH, repetitionsV y orientation del data directamente.
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
    pagesPerSheet,
    isManual
  } = data;

  let repetitionsH: number;
  let repetitionsV: number;
  let orientation: 'horizontal' | 'vertical';

  if (isManual) {
    // Manual mode: user-provided values
    repetitionsH = data.repetitionsH || 1;
    repetitionsV = data.repetitionsV || 1;
    orientation = data.orientation || 'horizontal';
  } else {
    // Auto mode: calculate optimal layout
    const cellW = productWidth + gutterH;
    const cellH = productHeight + gutterV;
    
    // Producto en horizontal
    const repsH_prodHoriz = Math.floor(validWidth / cellW);
    const repsV_prodHoriz = Math.floor(validHeight / cellH);
    const total_prodHoriz = repsH_prodHoriz * repsV_prodHoriz;
    
    // Producto en vertical (rotado 90°)
    const cellW_vert = productHeight + gutterH;
    const cellH_vert = productWidth + gutterV;
    const repsH_prodVert = Math.floor(validWidth / cellW_vert);
    const repsV_prodVert = Math.floor(validHeight / cellH_vert);
    const total_prodVert = repsH_prodVert * repsV_prodVert;
    
    const useVertical = total_prodVert > total_prodHoriz;
    
    repetitionsH = useVertical ? repsH_prodVert : repsH_prodHoriz;
    repetitionsV = useVertical ? repsV_prodVert : repsV_prodHoriz;
    orientation = useVertical ? 'vertical' : 'horizontal';
  }

  let totalRepetitions = repetitionsH * repetitionsV;
  const rawTotalRepetitions = totalRepetitions;
  
  // ─── Ajuste por páginas/pliego para encuadernación ───
  let adjustedPagesPerSheet: number | undefined;
  if (pagesPerSheet && pagesPerSheet > 0) {
    const totalPages = totalRepetitions * 2;
    const validSorted = [...VALID_PAGES_PER_SHEET].sort((a, b) => b - a);
    const snapped = validSorted.find(v => v <= totalPages) || validSorted[validSorted.length - 1];
    adjustedPagesPerSheet = snapped;
    const adjustedPerSide = snapped / 2;
    if (adjustedPerSide < totalRepetitions) {
      totalRepetitions = adjustedPerSide;
      if (repetitionsH > 0 && repetitionsV > 0) {
        const newV = Math.floor(adjustedPerSide / repetitionsH);
        if (newV > 0 && newV * repetitionsH === adjustedPerSide) {
          repetitionsV = newV;
        } else {
          const newH = Math.floor(adjustedPerSide / repetitionsV);
          if (newH > 0 && newH * repetitionsV === adjustedPerSide) {
            repetitionsH = newH;
          } else {
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
  const prodW = orientation === 'vertical' ? productHeight : productWidth;
  const prodH = orientation === 'vertical' ? productWidth : productHeight;
  const usedCellW = prodW + gutterH;
  const usedCellH = prodH + gutterV;
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
    orientation
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
