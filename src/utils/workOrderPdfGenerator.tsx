import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { supabase } from '@/integrations/supabase/client';

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
                <View style={styles.impositionGrid}>
                  <View style={styles.impositionItem}>
                    <Text style={styles.impositionLabel}>Producto (sin sangrado):</Text>
                    <Text style={styles.impositionValue}>
                      {item.imposition_data.productWidth} × {item.imposition_data.productHeight} mm
                    </Text>
                  </View>
                  <View style={styles.impositionItem}>
                    <Text style={styles.impositionLabel}>Sangrado:</Text>
                    <Text style={styles.impositionValue}>
                      {item.imposition_data.bleed} mm
                    </Text>
                  </View>
                  <View style={styles.impositionItem}>
                    <Text style={styles.impositionLabel}>Pliego total:</Text>
                    <Text style={styles.impositionValue}>
                      {item.imposition_data.sheetWidth} × {item.imposition_data.sheetHeight} mm
                    </Text>
                  </View>
                  <View style={styles.impositionItem}>
                    <Text style={styles.impositionLabel}>Área válida:</Text>
                    <Text style={styles.impositionValue}>
                      {item.imposition_data.validWidth} × {item.imposition_data.validHeight} mm
                    </Text>
                  </View>
                  <View style={styles.impositionItem}>
                    <Text style={styles.impositionLabel}>Calles H/V:</Text>
                    <Text style={styles.impositionValue}>
                      {item.imposition_data.gutterH} / {item.imposition_data.gutterV} mm
                    </Text>
                  </View>
                  <View style={styles.impositionItem}>
                    <Text style={styles.impositionLabel}>Orientación producto:</Text>
                    <Text style={styles.impositionValue}>
                      {item.imposition_data.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
                    </Text>
                  </View>
                </View>
                {item.imposition_data.repetitionsH && item.imposition_data.repetitionsV && (
                  <View style={styles.impositionHighlight}>
                    <Text style={styles.impositionHighlightText}>
                      {item.imposition_data.repetitionsH} × {item.imposition_data.repetitionsV} = {item.imposition_data.totalRepetitions} unidades por pliego
                    </Text>
                    <Text style={[styles.impositionHighlightText, { marginTop: 3 }]}>
                      Aprovechamiento: {item.imposition_data.utilization?.toFixed(1)}%
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
