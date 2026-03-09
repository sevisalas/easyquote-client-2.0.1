import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { supabase } from '@/integrations/supabase/client';

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  // --- Header ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 70,
    height: 'auto',
    marginBottom: 4,
  },
  otTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  otNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  companyName: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  // --- Client info ---
  clientTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  clientRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  clientLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    width: 65,
  },
  clientValue: {
    fontSize: 9,
  },
  // --- Separators ---
  thickSeparator: {
    height: 2,
    backgroundColor: '#333',
    marginVertical: 6,
  },
  thinSeparator: {
    height: 0.5,
    backgroundColor: '#ccc',
    marginVertical: 4,
  },
  // --- Section titles ---
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subsectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  // --- Grid layout (3 columns) ---
  grid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.33%',
    flexDirection: 'row',
    paddingVertical: 2,
    paddingRight: 6,
  },
  gridLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#555',
    marginRight: 3,
  },
  gridValue: {
    fontSize: 8,
    flex: 1,
  },
  // --- Imposition ---
  impositionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  impositionBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    padding: 6,
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  impositionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  impositionCaption: {
    fontSize: 7,
    color: '#555',
    marginTop: 4,
    textAlign: 'center',
  },
  // --- Observations ---
  observationsBlock: {
    borderWidth: 1,
    borderColor: '#999',
    padding: 8,
    minHeight: 60,
  },
  observationsTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  observationsPlaceholder: {
    fontSize: 7,
    color: '#aaa',
    fontStyle: 'italic',
  },
  // --- Dates ---
  dateItem: {
    flexDirection: 'row',
    fontSize: 8,
  },
  dateLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    marginRight: 3,
  },
});

// ─── Interfaces ─────────────────────────────────────────────

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

// ─── Visual Imposition Diagram ──────────────────────────────

const DIAGRAM_MAX_W = 350;
const DIAGRAM_MAX_H = 240;

const ImpositionDiagram: React.FC<{ data: any; title: string }> = ({ data, title }) => {
  if (!data || !data.repetitionsH || !data.repetitionsV) return null;

  const pw = Number(data.productWidth) || 50;
  const ph = Number(data.productHeight) || 50;
  const rawSw = Number(data.sheetWidth) || 320;
  const rawSh = Number(data.sheetHeight) || 450;
  const gutterH = Number(data.gutterH) || 0;
  const gutterV = Number(data.gutterV) || 0;
  const repsH = Number(data.repetitionsH) || 1;
  const repsV = Number(data.repetitionsV) || 1;

  // Sheet is ALWAYS landscape (wider than tall)
  const sw = Math.max(rawSw, rawSh);
  const sh = Math.min(rawSw, rawSh);

  // Valid area
  const rawVw = Number(data.validWidth) || sw;
  const rawVh = Number(data.validHeight) || sh;
  const vw = Math.max(rawVw, rawVh);
  const vh = Math.min(rawVw, rawVh);

  // Scale sheet to fit diagram area
  const scaleX = DIAGRAM_MAX_W / sw;
  const scaleY = DIAGRAM_MAX_H / sh;
  const scale = Math.min(scaleX, scaleY);

  const sheetW = sw * scale;
  const sheetH = sh * scale;
  const cellW = pw * scale;
  const cellH = ph * scale;
  const gutH = gutterH * scale;
  const gutV = gutterV * scale;

  // Margin from sheet edge to valid area
  const marginX = ((sw - vw) / 2) * scale;
  const marginY = ((sh - vh) / 2) * scale;

  // Center cells within valid area
  const gridTotalW = repsH * cellW + Math.max(0, repsH - 1) * gutH;
  const gridTotalH = repsV * cellH + Math.max(0, repsV - 1) * gutV;
  const validW = vw * scale;
  const validH = vh * scale;
  const offsetX = marginX + Math.max(0, (validW - gridTotalW) / 2);
  const offsetY = marginY + Math.max(0, (validH - gridTotalH) / 2);

  // Build cells
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < repsV; row++) {
    for (let col = 0; col < repsH; col++) {
      const x = offsetX + col * (cellW + gutH);
      const y = offsetY + row * (cellH + gutV);

      cells.push(
        <View
          key={`cell-${row}-${col}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: cellW,
            height: cellH,
            backgroundColor: '#e0e0e0',
            borderWidth: 0.5,
            borderColor: '#555',
          }}
        />
      );
    }
  }

  return (
    <View style={styles.impositionBox}>
      <Text style={styles.impositionTitle}>{title}</Text>

      <View style={{
        width: sheetW,
        height: sheetH,
        borderWidth: 1,
        borderColor: '#333',
        backgroundColor: '#fff',
        position: 'relative',
      }}>
        {cells}
      </View>
    </View>
  );
};

// ─── Helper: 3-column grid of label:value pairs ─────────────

const DataGrid: React.FC<{ items: Array<{ label: string; value: string }> }> = ({ items }) => (
  <View style={styles.grid3}>
    {items.map((item, idx) => (
      <View key={idx} style={styles.gridItem}>
        <Text style={styles.gridLabel}>{item.label}:</Text>
        <Text style={styles.gridValue}>{item.value}</Text>
      </View>
    ))}
  </View>
);

// ─── Main Document ──────────────────────────────────────────

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
  const formatVal = (v: any): string => {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) return 'Ver imagen';
    return String(v);
  };

  return (
    <Document>
      {items.map((item, itemIndex) => {
        const sortedPrompts = [...(item.prompts || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        // Outputs already come pre-filtered by production visibility from the caller
        const outputs = [...(item.outputs || [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));

        // Detect imposition type
        const isSimple = item.imposition_data && typeof item.imposition_data.productWidth === 'number';
        const isComposite = item.composite_data?.components && Object.keys(item.composite_data.components).length > 0;

        const compositeImpositions = !isSimple && isComposite && item.imposition_data
          ? Object.entries(item.imposition_data).filter(([_, d]) => d && typeof (d as any).productWidth === 'number')
          : [];

        return (
          <Page key={itemIndex} size="A4" style={styles.page}>
            {/* ═══ HEADER ═══ */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {logoUrl && <Image src={logoUrl} style={styles.logo} />}
                {companyName && <Text style={styles.companyName}>{companyName}</Text>}

                <View style={{ marginTop: 6 }}>
                  <Text style={styles.clientTitle}>CLIENTE</Text>
                  {customerName && (
                    <View style={styles.clientRow}>
                      <Text style={styles.clientLabel}>Nombre:</Text>
                      <Text style={styles.clientValue}>{customerName}</Text>
                    </View>
                  )}
                  {customerEmail && (
                    <View style={styles.clientRow}>
                      <Text style={styles.clientLabel}>Email:</Text>
                      <Text style={styles.clientValue}>{customerEmail}</Text>
                    </View>
                  )}
                  {customerPhone && (
                    <View style={styles.clientRow}>
                      <Text style={styles.clientLabel}>Teléfono:</Text>
                      <Text style={styles.clientValue}>{customerPhone}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.headerRight}>
                <Text style={styles.otTitle}>ORDEN DE TRABAJO</Text>
                <Text style={styles.otNumber}>{orderNumber}</Text>
                {(orderDate || deliveryDate) && (
                  <View style={{ marginTop: 6 }}>
                    {orderDate && (
                      <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>F. Pedido:</Text>
                        <Text>{orderDate}</Text>
                      </View>
                    )}
                    {deliveryDate && (
                      <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>F. Entrega:</Text>
                        <Text>{deliveryDate}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.thickSeparator} />

            {/* ═══ ARTÍCULO ═══ */}
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.sectionTitle}>
                ARTÍCULO{items.length > 1 ? ` ${itemIndex + 1}` : ''}: {item.product_name}
              </Text>
            </View>

            {/* Prompts (Configuración) in 3-col grid */}
            {sortedPrompts.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.subsectionTitle}>Configuración</Text>
                <DataGrid
                  items={sortedPrompts.map(p => ({ label: p.label, value: formatVal(p.value) }))}
                />
              </View>
            )}

            {/* Outputs (Datos técnicos) in 3-col grid */}
            {outputs.length > 0 && (
              <>
                <View style={styles.thinSeparator} />
                <View style={{ marginBottom: 6 }}>
                  <Text style={styles.subsectionTitle}>Datos técnicos</Text>
                  <DataGrid
                    items={outputs.map(o => ({ label: o.name, value: formatVal(o.value) }))}
                  />
                </View>
              </>
            )}

            {/* ═══ IMPOSICIÓN (visual diagram) ═══ */}
            {item.imposition_data && (
              <>
                <View style={styles.thickSeparator} />
                <Text style={styles.sectionTitle}>IMPOSICIÓN</Text>

                {isSimple ? (
                  <View style={styles.impositionRow}>
                    <ImpositionDiagram data={item.imposition_data} title="IMPOSICIÓN" />
                  </View>
                ) : compositeImpositions.length > 0 ? (
                  <View style={styles.impositionRow}>
                    {compositeImpositions.map(([key, data]) => {
                      const alias = item.composite_data?.components?.[key]?.alias || key;
                      return <ImpositionDiagram key={key} data={data} title={alias.toUpperCase()} />;
                    })}
                  </View>
                ) : (
                  <View style={styles.impositionRow}>
                    <ImpositionDiagram data={item.imposition_data} title="IMPOSICIÓN" />
                  </View>
                )}
              </>
            )}

            <View style={styles.thickSeparator} />

            {/* ═══ OBSERVACIONES ═══ */}
            <View style={styles.observationsBlock}>
              <Text style={styles.observationsTitle}>OBSERVACIONES</Text>
              <Text style={styles.observationsPlaceholder}>
                Espacio para notas durante la producción...
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

// ─── Public API ─────────────────────────────────────────────

export const generateWorkOrderPDF = async (
  options: Omit<WorkOrderPDFOptions, 'logoUrl' | 'companyName'>
): Promise<void> => {
  try {
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

    const blob = await pdf(
      <WorkOrderDocument
        {...options}
        logoUrl={logoUrl}
        companyName={companyName}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
      />
    ).toBlob();

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
