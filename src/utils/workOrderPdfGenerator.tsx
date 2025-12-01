import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image, Svg, Rect, Line } from '@react-pdf/renderer';
import { supabase } from '@/integrations/supabase/client';

// Componente para renderizar el esquema de imposición con componentes nativos
const ImpositionScheme: React.FC<{ data: any }> = ({ data }) => {
  const {
    productWidth,
    productHeight,
    bleed = 0,
    sheetWidth,
    sheetHeight,
    validWidth,
    validHeight,
    gutterH = 0,
    gutterV = 0,
    repetitionsH = 0,
    repetitionsV = 0,
    orientation = 'horizontal'
  } = data;

  const isLandscape = sheetWidth >= sheetHeight;
  const svgWidth = 400;
  const svgHeight = isLandscape ? 280 : 350;
  
  const margin = 20;
  const scaleX = (svgWidth - margin * 2) / sheetWidth;
  const scaleY = (svgHeight - margin * 2) / sheetHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const scaledSheetW = sheetWidth * scale;
  const scaledSheetH = sheetHeight * scale;
  const offsetX = (svgWidth - scaledSheetW) / 2;
  const offsetY = (svgHeight - scaledSheetH) / 2;
  
  const sx = (x: number) => offsetX + x * scale;
  const sy = (y: number) => offsetY + y * scale;
  const sw = (w: number) => w * scale;
  const sh = (h: number) => h * scale;
  
  const validOffsetX = (sheetWidth - validWidth) / 2;
  const validOffsetY = (sheetHeight - validHeight) / 2;
  
  const productWithBleedW = productWidth + (bleed * 2);
  const productWithBleedH = productHeight + (bleed * 2);
  
  const prodW = orientation === 'horizontal' ? productWithBleedW : productWithBleedH;
  const prodH = orientation === 'horizontal' ? productWithBleedH : productWithBleedW;
  
  const totalUsedWidth = repetitionsH * prodW + (repetitionsH - 1) * gutterH;
  const totalUsedHeight = repetitionsV * prodH + (repetitionsV - 1) * gutterV;
  
  const impositionOffsetX = validOffsetX + (validWidth - totalUsedWidth) / 2;
  const impositionOffsetY = validOffsetY + (validHeight - totalUsedHeight) / 2;
  
  const cropMarkLength = 8;

  return (
    <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      {/* Sheet background */}
      <Rect
        x={sx(0)}
        y={sy(0)}
        width={sw(sheetWidth)}
        height={sh(sheetHeight)}
        fill="#fafafa"
        stroke="#d1d5db"
        strokeWidth={2}
      />
      
      {/* Valid area */}
      <Rect
        x={sx(validOffsetX)}
        y={sy(validOffsetY)}
        width={sw(validWidth)}
        height={sh(validHeight)}
        fill="none"
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      
      {/* Products */}
      {Array.from({ length: repetitionsV }).map((_, row) =>
        Array.from({ length: repetitionsH }).map((_, col) => {
          const x = impositionOffsetX + col * (prodW + gutterH);
          const y = impositionOffsetY + row * (prodH + gutterV);
          
          return (
            <React.Fragment key={`${row}-${col}`}>
              {/* Product with bleed */}
              <Rect
                x={sx(x)}
                y={sy(y)}
                width={sw(prodW)}
                height={sh(prodH)}
                fill="#e5e7eb"
                stroke="#9ca3af"
                strokeWidth={0.5}
              />
              
              {/* Product area */}
              <Rect
                x={sx(x + bleed)}
                y={sy(y + bleed)}
                width={sw(orientation === 'horizontal' ? productWidth : productHeight)}
                height={sh(orientation === 'horizontal' ? productHeight : productWidth)}
                fill="#f3f4f6"
                stroke="#6b7280"
                strokeWidth={1}
              />
              
              {/* Crop marks */}
              <Line
                x1={sx(x + bleed - cropMarkLength)}
                y1={sy(y + bleed)}
                x2={sx(x + bleed + cropMarkLength)}
                y2={sy(y + bleed)}
                stroke="#374151"
                strokeWidth={0.8}
              />
              <Line
                x1={sx(x + bleed)}
                y1={sy(y + bleed - cropMarkLength)}
                x2={sx(x + bleed)}
                y2={sy(y + bleed + cropMarkLength)}
                stroke="#374151"
                strokeWidth={0.8}
              />
            </React.Fragment>
          );
        })
      )}
    </Svg>
  );
};

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 80,
    height: 'auto',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    marginRight: 5,
    minWidth: 100,
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontFamily: 'Helvetica-Bold',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  observationsBox: {
    border: '1px solid #ddd',
    padding: 10,
    minHeight: 100,
    backgroundColor: '#fafafa',
    marginTop: 15,
  },
  observationsTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  observationsText: {
    fontSize: 9,
    color: '#666',
    fontStyle: 'italic',
  },
  impositionBox: {
    border: '1px solid #ddd',
    padding: 10,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  impositionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  impositionItem: {
    width: '50%',
    marginBottom: 6,
  },
  impositionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  impositionValue: {
    fontSize: 10,
    color: '#333',
  },
  impositionHighlight: {
    backgroundColor: '#e8f5e9',
    padding: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  impositionHighlightText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#2e7d32',
  },
});

interface WorkOrderPDFOptions {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderDate?: string;
  deliveryDate?: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    prompts?: Array<{ label: string; value: any; order?: number }>;
    outputs?: Array<{ name: string; type: string; value: any }>;
    description?: string;
    imposition_data?: {
      productWidth: number;
      productHeight: number;
      bleed: number;
      sheetWidth: number;
      sheetHeight: number;
      validWidth: number;
      validHeight: number;
      gutterH: number;
      gutterV: number;
      repetitionsH?: number;
      repetitionsV?: number;
      totalRepetitions?: number;
      utilization?: number;
      orientation?: 'horizontal' | 'vertical';
    };
  }>;
  logoUrl?: string;
  companyName?: string;
}

// Componente del documento PDF
const WorkOrderDocument: React.FC<WorkOrderPDFOptions> = ({
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  orderDate,
  deliveryDate,
  items,
  logoUrl,
  companyName,
}) => {
  // Filtrar outputs relevantes para producción
  const getProductionOutputs = (outputs?: Array<{ name: string; type: string; value: any }>) => {
    if (!outputs) return [];
    
    const productionTypes = ['Instructions', 'Workflow', 'Width', 'Height', 'Depth', 
                            'ProductImage', 'Quantity', 'Generic', 'Weight'];
    
    return outputs.filter(output => productionTypes.includes(output.type));
  };

  return (
    <Document>
      {items.map((item, index) => (
        <Page key={index} size="A4" style={styles.page}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {logoUrl && (
                <Image src={logoUrl} style={styles.logo} />
              )}
              {companyName && (
                <Text style={styles.subtitle}>{companyName}</Text>
              )}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>ORDEN DE TRABAJO</Text>
              <Text style={styles.subtitle}>Pedido: {orderNumber}</Text>
              {orderDate && (
                <Text style={styles.subtitle}>Fecha: {orderDate}</Text>
              )}
            </View>
          </View>

          {/* Información del Cliente */}
          {customerName && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CLIENTE</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Nombre:</Text>
                <Text style={styles.value}>{customerName}</Text>
              </View>
              {customerEmail && (
                <View style={styles.row}>
                  <Text style={styles.label}>Email:</Text>
                  <Text style={styles.value}>{customerEmail}</Text>
                </View>
              )}
              {customerPhone && (
                <View style={styles.row}>
                  <Text style={styles.label}>Teléfono:</Text>
                  <Text style={styles.value}>{customerPhone}</Text>
                </View>
              )}
            </View>
          )}

          {/* Fechas */}
          {(orderDate || deliveryDate) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FECHAS</Text>
              {orderDate && (
                <View style={styles.row}>
                  <Text style={styles.label}>Fecha Pedido:</Text>
                  <Text style={styles.value}>{orderDate}</Text>
                </View>
              )}
              {deliveryDate && (
                <View style={styles.row}>
                  <Text style={styles.label}>Fecha Entrega:</Text>
                  <Text style={styles.value}>{deliveryDate}</Text>
                </View>
              )}
            </View>
          )}

          {/* Producto */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRODUCTO</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              {item.product_name}
            </Text>
          </View>

          {/* Configuración (Prompts) */}
          {item.prompts && item.prompts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CONFIGURACIÓN</Text>
              <View style={styles.table}>
                {item.prompts
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((prompt, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>
                        {prompt.label}
                      </Text>
                      <Text style={styles.tableCell}>
                        {String(prompt.value)}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Datos Técnicos (Outputs) */}
          {getProductionOutputs(item.outputs).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DATOS TÉCNICOS</Text>
              <View style={styles.table}>
                {getProductionOutputs(item.outputs).map((output, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>
                      {output.name}
                    </Text>
                    <Text style={styles.tableCell}>
                      {String(output.value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Imposición */}
          {item.imposition_data && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>IMPOSICIÓN</Text>
              <View style={styles.impositionBox}>
                <ImpositionScheme data={item.imposition_data} />
                <View style={styles.row}>
                  <Text style={styles.label}>Tamaño de hoja:</Text>
                  <Text style={styles.value}>
                    {item.imposition_data.sheetWidth} × {item.imposition_data.sheetHeight} mm
                  </Text>
                </View>
                {item.imposition_data.repetitionsH && item.imposition_data.repetitionsV && (
                  <View style={[styles.row, { marginTop: 8 }]}>
                    <Text style={[styles.value, { fontSize: 12, fontFamily: 'Helvetica-Bold' }]}>
                      {item.imposition_data.repetitionsH} × {item.imposition_data.repetitionsV} = {item.imposition_data.totalRepetitions} unidades por pliego
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Observaciones */}
          <View style={styles.observationsBox}>
            <Text style={styles.observationsTitle}>OBSERVACIONES</Text>
            <Text style={styles.observationsText}>
              Espacio para notas y observaciones durante la producción...
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
};

// Función principal para generar el PDF
export const generateWorkOrderPDF = async (
  options: Omit<WorkOrderPDFOptions, 'logoUrl' | 'companyName'>
): Promise<void> => {
  try {
    // Obtener configuración del PDF (logo y nombre de empresa)
    const { data: { user } } = await supabase.auth.getUser();
    let logoUrl = '';
    let companyName = '';

    if (user) {
      const { data: config } = await supabase
        .from('pdf_configurations')
        .select('logo_url, company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (config) {
        logoUrl = config.logo_url || '';
        companyName = config.company_name || '';
      }
    }

    // Obtener datos completos del cliente si existe
    let customerEmail = '';
    let customerPhone = '';

    if (options.orderId) {
      const { data: order } = await supabase
        .from('sales_orders')
        .select('customer_id')
        .eq('id', options.orderId)
        .single();

      if (order?.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('email, phone')
          .eq('id', order.customer_id)
          .single();

        if (customer) {
          customerEmail = customer.email || '';
          customerPhone = customer.phone || '';
        }
      }
    }

    // Generar el PDF
    const blob = await pdf(
      <WorkOrderDocument
        {...options}
        logoUrl={logoUrl}
        companyName={companyName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
      />
    ).toBlob();

    // Descargar el archivo
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OT-${options.orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generando PDF de orden de trabajo:', error);
    throw new Error('No se pudo generar el PDF de la orden de trabajo');
  }
};
