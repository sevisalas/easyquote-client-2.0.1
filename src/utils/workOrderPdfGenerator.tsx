import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { supabase } from '@/integrations/supabase/client';

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 8,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 60,
    height: 'auto',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: '#666',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    marginRight: 4,
    minWidth: 80,
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 3,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontFamily: 'Helvetica-Bold',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 3,
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
    imposition_data?: any;
    composite_data?: any;
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

  // Agrupar items por página
  const itemsPerPage = 3;
  const pages: Array<typeof items> = [];
  
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage));
  }

  return (
    <Document>
      {pages.map((pageItems, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Cabecera - solo en primera página */}
          {pageIndex === 0 && (
            <>
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
            </>
          )}

          {/* Items de la página */}
          {pageItems.map((item, itemIndex) => (
            <View 
              key={itemIndex} 
              style={{
                marginBottom: 12,
                padding: 8,
                backgroundColor: '#f8f9fa',
                borderWidth: 1,
                borderColor: '#dee2e6',
                borderRadius: 4,
              }}
            >
              {/* Producto */}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#495057', marginBottom: 3 }}>
                  ARTÍCULO {pageIndex * itemsPerPage + itemIndex + 1}
                </Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                  {item.product_name}
                </Text>
              </View>

              {/* Configuración (Prompts) */}
              {item.prompts && item.prompts.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#6c757d' }}>
                    Configuración
                  </Text>
                  <View style={styles.table}>
                    {item.prompts
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((prompt, idx) => (
                        <View key={idx} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                            {prompt.label}
                          </Text>
                          <Text style={[styles.tableCell, { fontSize: 7 }]}>
                            {String(prompt.value)}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              )}

              {/* Datos Técnicos (Outputs) */}
              {getProductionOutputs(item.outputs).length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: '#6c757d' }}>
                    Datos Técnicos
                  </Text>
                  <View style={styles.table}>
                    {getProductionOutputs(item.outputs).map((output, idx) => (
                      <View key={idx} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                          {output.name}
                        </Text>
                        <Text style={[styles.tableCell, { fontSize: 7 }]}>
                          {String(output.value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Imposición - solo texto, sin SVG */}
              {item.imposition_data && (() => {
                try {
                  const isSimple = typeof item.imposition_data.productWidth === 'number';
                  const isComposite = item.composite_data?.components && Object.keys(item.composite_data.components).length > 0;

                  const renderImpText = (imp: any, label?: string) => {
                    if (!imp || !imp.repetitionsH || !imp.repetitionsV) return null;
                    return (
                      <View style={{ flex: 1, borderWidth: 0.5, borderColor: '#ccc', padding: 4, marginRight: 4 }} key={label || '__simple__'}>
                        {label && (
                          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                            {label}
                          </Text>
                        )}
                        <Text style={{ fontSize: 7 }}>
                          Producto: {imp.productWidth}×{imp.productHeight} mm · Sangrado: {imp.bleed} mm
                        </Text>
                        <Text style={{ fontSize: 7 }}>
                          Pliego: {imp.sheetWidth}×{imp.sheetHeight} mm · Válido: {imp.validWidth || imp.sheetWidth}×{imp.validHeight || imp.sheetHeight} mm
                        </Text>
                        <Text style={{ fontSize: 7 }}>
                          Calles: {imp.gutterH}×{imp.gutterV} mm
                        </Text>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 1 }}>
                          {imp.repetitionsH}×{imp.repetitionsV} = {imp.totalRepetitions} uds/pliego
                          {imp.utilization != null ? ` · Aprov: ${Number(imp.utilization).toFixed(1)}%` : ''}
                        </Text>
                      </View>
                    );
                  };

                  const compositeEntries = !isSimple && isComposite
                    ? Object.entries(item.imposition_data).filter(([_, d]) => d && typeof (d as any).productWidth === 'number')
                    : [];

                  return (
                    <View style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#6c757d' }}>
                        {compositeEntries.length > 0 ? 'Imposición por componente' : 'Imposición'}
                      </Text>
                      {isSimple ? (
                        renderImpText(item.imposition_data)
                      ) : compositeEntries.length > 0 ? (
                        <View style={{ flexDirection: 'row' }}>
                          {compositeEntries.map(([key, data]) => {
                            const alias = item.composite_data?.components?.[key]?.alias || key;
                            return renderImpText(data, alias);
                          })}
                        </View>
                      ) : (
                        renderImpText(item.imposition_data)
                      )}
                    </View>
                  );
                } catch (e) {
                  console.error('Error rendering imposition in PDF:', e);
                  return null;
                }
              })()}

              {/* Observaciones */}
              <View style={{ 
                borderWidth: 1, borderColor: '#ced4da', 
                padding: 4, 
                backgroundColor: '#ffffff',
                marginTop: 4,
              }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                  Observaciones:
                </Text>
                <Text style={{ fontSize: 6, color: '#6c757d', fontStyle: 'italic' }}>
                  ...
                </Text>
              </View>
            </View>
          ))}
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
  } catch (error: any) {
    console.error('Error generando PDF de orden de trabajo:', error?.message || error, error?.stack);
    throw new Error(`No se pudo generar el PDF de la orden de trabajo: ${error?.message || error}`);
  }
};
