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
    validWidth,
    validHeight,
    repetitionsH = 0,
    repetitionsV = 0,
    orientation = 'horizontal'
  } = data;

  // SVG se adapta a la orientación real del área válida
  const isLandscape = validWidth >= validHeight;
  const svgWidth = compact ? 140 : 700;
  const svgHeight = compact ? 80 : (isLandscape ? 400 : 500);
  
  // Escala para que el área válida quepa en el SVG con margen
  const margin = compact ? 5 : 20;
  const scaleX = (svgWidth - margin * 2) / validWidth;
  const scaleY = (svgHeight - margin * 2) / validHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Centrar el área válida en el SVG
  const scaledW = validWidth * scale;
  const scaledH = validHeight * scale;
  const offsetX = (svgWidth - scaledW) / 2;
  const offsetY = (svgHeight - scaledH) / 2;
  
  // Función para escalar y posicionar
  const sx = (x: number) => offsetX + x * scale;
  const sy = (y: number) => offsetY + y * scale;
  const sw = (w: number) => w * scale;
  const sh = (h: number) => h * scale;
  
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
  const impositionOffsetX = (validWidth - totalUsedWidth) / 2;
  const impositionOffsetY = (validHeight - totalUsedHeight) / 2;
  
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
              <line x1={sx(x + bleed - cropMarkLength)} y1={sy(y + bleed)} x2={sx(x + bleed + cropMarkLength)} y2={sy(y + bleed)} stroke="#374151" strokeWidth={0.5} />
              <line x1={sx(x + bleed)} y1={sy(y + bleed - cropMarkLength)} x2={sx(x + bleed)} y2={sy(y + bleed + cropMarkLength)} stroke="#374151" strokeWidth={0.5} />
              
              {/* Esquina superior derecha */}
              <line x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) - cropMarkLength)} y1={sy(y + bleed)} x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) + cropMarkLength)} y2={sy(y + bleed)} stroke="#374151" strokeWidth={0.5} />
              <line x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))} y1={sy(y + bleed - cropMarkLength)} x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))} y2={sy(y + bleed + cropMarkLength)} stroke="#374151" strokeWidth={0.5} />
              
              {/* Esquina inferior izquierda */}
              <line x1={sx(x + bleed - cropMarkLength)} y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))} x2={sx(x + bleed + cropMarkLength)} y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))} stroke="#374151" strokeWidth={0.5} />
              <line x1={sx(x + bleed)} y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) - cropMarkLength)} x2={sx(x + bleed)} y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) + cropMarkLength)} stroke="#374151" strokeWidth={0.5} />
              
              {/* Esquina inferior derecha */}
              <line x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) - cropMarkLength)} y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))} x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight) + cropMarkLength)} y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth))} stroke="#374151" strokeWidth={0.5} />
              <line x1={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))} y1={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) - cropMarkLength)} x2={sx(x + bleed + (orientation === 'horizontal' ? productWidth : productHeight))} y2={sy(y + bleed + (orientation === 'horizontal' ? productHeight : productWidth) + cropMarkLength)} stroke="#374151" strokeWidth={0.5} />
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
      {/* Área válida de impresión */}
      <rect
        x={sx(0)}
        y={sy(0)}
        width={sw(validWidth)}
        height={sh(validHeight)}
        fill="#fafafa"
        stroke="#d1d5db"
        strokeWidth={compact ? 1 : 2}
      />
      
      {/* Productos */}
      {products}
    </svg>
  );
}
