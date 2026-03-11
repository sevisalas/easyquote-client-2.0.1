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
 * Find all valid H×V factorizations for a target count
 * that physically fit within the valid area for the given orientation.
 */
function findFittingFactorizations(
  target: number,
  validWidth: number,
  validHeight: number,
  productWidth: number,
  productHeight: number,
  gutterH: number,
  gutterV: number,
  orientation: 'horizontal' | 'vertical'
): { h: number; v: number } | null {
  const prodW = orientation === 'vertical' ? productHeight : productWidth;
  const prodH = orientation === 'vertical' ? productWidth : productHeight;
  const cellW = prodW + gutterH;
  const cellH = prodH + gutterV;
  const maxH = Math.floor(validWidth / cellW);
  const maxV = Math.floor(validHeight / cellH);

  // Try factorizations preferring wider layouts (more cols)
  for (let h = Math.min(target, maxH); h >= 1; h--) {
    if (target % h === 0) {
      const v = target / h;
      if (v <= maxV) {
        return { h, v };
      }
    }
  }
  return null;
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
    const repsH_horiz = Math.floor(validWidth / cellW);
    const repsV_horiz = Math.floor(validHeight / cellH);
    const total_horiz = repsH_horiz * repsV_horiz;
    
    // Producto en vertical (rotado 90°)
    const cellW_vert = productHeight + gutterH;
    const cellH_vert = productWidth + gutterV;
    const repsH_vert = Math.floor(validWidth / cellW_vert);
    const repsV_vert = Math.floor(validHeight / cellH_vert);
    const total_vert = repsH_vert * repsV_vert;
    
    const useVertical = total_vert > total_horiz;
    
    repetitionsH = useVertical ? repsH_vert : repsH_horiz;
    repetitionsV = useVertical ? repsV_vert : repsV_horiz;
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
      // Try to find a factorization that physically fits in the current orientation
      let fit = findFittingFactorizations(
        adjustedPerSide, validWidth, validHeight,
        productWidth, productHeight, gutterH, gutterV,
        orientation
      );

      if (!fit) {
        // Try the other orientation
        const altOrientation: 'horizontal' | 'vertical' = orientation === 'horizontal' ? 'vertical' : 'horizontal';
        fit = findFittingFactorizations(
          adjustedPerSide, validWidth, validHeight,
          productWidth, productHeight, gutterH, gutterV,
          altOrientation
        );
        if (fit) {
          orientation = altOrientation;
        }
      }

      if (fit) {
        repetitionsH = fit.h;
        repetitionsV = fit.v;
        totalRepetitions = adjustedPerSide;
      } else {
        // Fallback: just reduce total, best-effort factorization
        totalRepetitions = adjustedPerSide;
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
