import { ImpositionData } from "@/utils/impositionCalculator";

interface ImpositionSchemeProps {
  data: ImpositionData;
  compact?: boolean; // true = miniatura ~120x80, false = grande para modal
}

export function ImpositionScheme({ data, compact = false }: ImpositionSchemeProps) {
  const {
    productWidth,
    productHeight,
    bleed,
    sheetWidth,
    sheetHeight,
    validWidth,
    validHeight,
    gutterH,
    gutterV,
    repetitionsH = 0,
    repetitionsV = 0,
    orientation = 'horizontal'
  } = data;

  // Dimensiones del SVG
  const svgWidth = compact ? 120 : 400;
  const svgHeight = compact ? 80 : 300;
  
  // Escala para que el pliego quepa en el SVG con margen
  const margin = compact ? 5 : 20;
  const scaleX = (svgWidth - margin * 2) / sheetWidth;
  const scaleY = (svgHeight - margin * 2) / sheetHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Centrar el pliego en el SVG
  const scaledSheetW = sheetWidth * scale;
  const scaledSheetH = sheetHeight * scale;
  const offsetX = (svgWidth - scaledSheetW) / 2;
  const offsetY = (svgHeight - scaledSheetH) / 2;
  
  // Función para escalar y posicionar
  const sx = (x: number) => offsetX + x * scale;
  const sy = (y: number) => offsetY + y * scale;
  const sw = (w: number) => w * scale;
  const sh = (h: number) => h * scale;
  
  // Área válida (centrada en el pliego)
  const validOffsetX = (sheetWidth - validWidth) / 2;
  const validOffsetY = (sheetHeight - validHeight) / 2;
  
  // Tamaño del producto con sangrado
  const productWithBleedW = productWidth + (bleed * 2);
  const productWithBleedH = productHeight + (bleed * 2);
  
  // Tamaño según orientación
  const prodW = orientation === 'horizontal' ? productWithBleedW : productWithBleedH;
  const prodH = orientation === 'horizontal' ? productWithBleedH : productWithBleedW;
  
  // Renderizar productos
  const products = [];
  for (let row = 0; row < repetitionsV; row++) {
    for (let col = 0; col < repetitionsH; col++) {
      const x = validOffsetX + col * (prodW + gutterH);
      const y = validOffsetY + row * (prodH + gutterV);
      
      products.push(
        <g key={`${row}-${col}`}>
          {/* Producto con sangrado */}
          <rect
            x={sx(x)}
            y={sy(y)}
            width={sw(prodW)}
            height={sh(prodH)}
            className="fill-primary/30 stroke-primary"
            strokeWidth={compact ? 0.5 : 1}
          />
          
          {/* Área de producto sin sangrado (interior) */}
          {!compact && (
            <rect
              x={sx(x + bleed)}
              y={sy(y + bleed)}
              width={sw(orientation === 'horizontal' ? productWidth : productHeight)}
              height={sh(orientation === 'horizontal' ? productHeight : productWidth)}
              className="fill-primary/50 stroke-primary"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          )}
        </g>
      );
    }
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="border border-border rounded bg-background"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      {/* Pliego completo */}
      <rect
        x={sx(0)}
        y={sy(0)}
        width={sw(sheetWidth)}
        height={sh(sheetHeight)}
        className="fill-muted stroke-border"
        strokeWidth={compact ? 1 : 2}
      />
      
      {/* Área válida de impresión */}
      <rect
        x={sx(validOffsetX)}
        y={sy(validOffsetY)}
        width={sw(validWidth)}
        height={sh(validHeight)}
        className="fill-none stroke-muted-foreground/40"
        strokeWidth={compact ? 0.5 : 1}
        strokeDasharray={compact ? "2,2" : "4,4"}
      />
      
      {/* Productos */}
      {products}
    </svg>
  );
}
