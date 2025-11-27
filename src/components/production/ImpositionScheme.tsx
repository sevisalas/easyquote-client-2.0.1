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
    gutterH,
    gutterV,
    repetitionsH = 0,
    repetitionsV = 0,
    orientation = 'horizontal'
  } = data;

  // La hoja SIEMPRE se dibuja horizontal (forzamos landscape)
  const sheetWidth = Math.max(data.sheetWidth, data.sheetHeight);
  const sheetHeight = Math.min(data.sheetWidth, data.sheetHeight);
  const validWidth = Math.max(data.validWidth, data.validHeight);
  const validHeight = Math.min(data.validWidth, data.validHeight);

  // SVG horizontal
  const svgWidth = compact ? 140 : 700;
  const svgHeight = compact ? 80 : 400;
  
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
  
  // Calcular espacio total usado por productos
  const totalUsedWidth = repetitionsH * prodW + (repetitionsH - 1) * gutterH;
  const totalUsedHeight = repetitionsV * prodH + (repetitionsV - 1) * gutterV;
  
  // Centrar la imposición dentro del área válida
  const impositionOffsetX = validOffsetX + (validWidth - totalUsedWidth) / 2;
  const impositionOffsetY = validOffsetY + (validHeight - totalUsedHeight) / 2;
  
  // Longitud de las marcas de corte
  const cropMarkLength = compact ? 3 : 10;
  
  // Renderizar productos con marcas de corte
  const products = [];
  for (let row = 0; row < repetitionsV; row++) {
    for (let col = 0; col < repetitionsH; col++) {
      const x = impositionOffsetX + col * (prodW + gutterH);
      const y = impositionOffsetY + row * (prodH + gutterV);
      
      products.push(
        <g key={`${row}-${col}`}>
          {/* Área de sangrado (gris claro) */}
          <rect
            x={sx(x)}
            y={sy(y)}
            width={sw(prodW)}
            height={sh(prodH)}
            fill="#e5e7eb"
            stroke="#9ca3af"
            strokeWidth={compact ? 0.3 : 0.5}
          />
          
          {/* Área de producto sin sangrado (gris medio) */}
          <rect
            x={sx(x + bleed)}
            y={sy(y + bleed)}
            width={sw(orientation === 'horizontal' ? productWidth : productHeight)}
            height={sh(orientation === 'horizontal' ? productHeight : productWidth)}
            fill="#f3f4f6"
            stroke="#6b7280"
            strokeWidth={compact ? 0.5 : 1}
          />
          
          {/* Marcas de corte en las esquinas del producto (sin sangrado) */}
          {!compact && (
            <>
              {/* Esquina superior izquierda */}
              <line
                x1={sx(x + bleed - cropMarkLength)}
                y1={sy(y + bleed)}
                x2={sx(x + bleed + cropMarkLength)}
                y2={sy(y + bleed)}
                stroke="#374151"
                strokeWidth={0.5}
              />
              <line
                x1={sx(x + bleed)}
                y1={sy(y + bleed - cropMarkLength)}
                x2={sx(x + bleed)}
                y2={sy(y + bleed + cropMarkLength)}
                stroke="#374151"
                strokeWidth={0.5}
              />
              
              {/* Esquina superior derecha */}
              <line
                x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) - cropMarkLength)}
                y1={sy(y + bleed)}
                x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) + cropMarkLength)}
                y2={sy(y + bleed)}
                stroke="#374151"
                strokeWidth={0.5}
              />
              <line
                x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))}
                y1={sy(y + bleed - cropMarkLength)}
                x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))}
                y2={sy(y + bleed + cropMarkLength)}
                stroke="#374151"
                strokeWidth={0.5}
              />
              
              {/* Esquina inferior izquierda */}
              <line
                x1={sx(x + bleed - cropMarkLength)}
                y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))}
                x2={sx(x + bleed + cropMarkLength)}
                y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))}
                stroke="#374151"
                strokeWidth={0.5}
              />
              <line
                x1={sx(x + bleed)}
                y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) - cropMarkLength)}
                x2={sx(x + bleed)}
                y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) + cropMarkLength)}
                stroke="#374151"
                strokeWidth={0.5}
              />
              
              {/* Esquina inferior derecha */}
              <line
                x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) - cropMarkLength)}
                y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))}
                x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) + cropMarkLength)}
                y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))}
                stroke="#374151"
                strokeWidth={0.5}
              />
              <line
                x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))}
                y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) - cropMarkLength)}
                x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))}
                y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) + cropMarkLength)}
                stroke="#374151"
                strokeWidth={0.5}
              />
            </>
          )}
        </g>
      );
    }
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      className="border border-border rounded"
      style={{ backgroundColor: '#ffffff' }}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      {/* Pliego completo */}
      <rect
        x={sx(0)}
        y={sy(0)}
        width={sw(sheetWidth)}
        height={sh(sheetHeight)}
        fill="#fafafa"
        stroke="#d1d5db"
        strokeWidth={compact ? 1 : 2}
      />
      
      {/* Área válida de impresión */}
      <rect
        x={sx(validOffsetX)}
        y={sy(validOffsetY)}
        width={sw(validWidth)}
        height={sh(validHeight)}
        fill="none"
        stroke="#9ca3af"
        strokeWidth={compact ? 0.5 : 1}
        strokeDasharray={compact ? "2,2" : "4,4"}
      />
      
      {/* Productos */}
      {products}
    </svg>
  );
}
