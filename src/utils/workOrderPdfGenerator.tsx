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
    height: 1,
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
    fontSize: 10,
    color: '#444',
    marginRight: 4,
  },
  gridValue: {
    fontSize: 10,
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

// ─── Section definitions ────────────────────────────────────

const OT_SECTION_LABELS: Record<string, string> = {
  datos_destacados: 'DATOS DESTACADOS',
  impresion: 'IMPRESIÓN',
  acabados: 'ACABADOS',
  imposiciones: 'IMPOSICIONES',
  ajustes: 'AJUSTES',
  observaciones: 'OBSERVACIONES Y NOTAS',
};

const OT_SECTION_ORDER = ['datos_destacados', 'impresion', 'acabados', 'imposiciones', 'ajustes', 'observaciones'];

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
    product_id?: string;
    quantity: number;
    prompts?: Array<{ label: string; value: any; order?: number }>;
    outputs?: Array<{ name: string; type: string; value: any }>;
    description?: string;
    imposition_data?: any;
    composite_data?: any;
  }>;
  additionals?: Array<{ name: string; type: string; value: number; is_discount: boolean }>;
  logoUrl?: string;
  companyName?: string;
  adminOnlyLabels?: Set<string>;
  /** Map: normalized prompt label → ot_section */
  promptSections?: Map<string, string>;
  /** Map: normalized output name → ot_section */
  outputSections?: Map<string, string>;
  /** Whether to use section-based layout */
  useSections?: boolean;
}

// ─── Visual Imposition Diagram (mirrors ImpositionScheme.tsx logic) ──────

const DIAGRAM_DEFAULT_W = 300;
const DIAGRAM_DEFAULT_H = 170;

const ImpositionDiagram: React.FC<{ data: any; title: string; maxWidth?: number; maxHeight?: number }> = ({ data, title, maxWidth, maxHeight }) => {
  if (!data || !data.repetitionsH || !data.repetitionsV) return null;

  const productWidth = Number(data.productWidth) || 50;
  const productHeight = Number(data.productHeight) || 50;
  const bleed = Number(data.bleed) || 0;
  const gutterH = Number(data.gutterH) || 0;
  const gutterV = Number(data.gutterV) || 0;
  const repsH = Number(data.repetitionsH) || 1;
  const repsV = Number(data.repetitionsV) || 1;
  const orientation = data.orientation || 'horizontal';
  const validWidth = Number(data.validWidth) || Number(data.sheetWidth) || 476;
  const validHeight = Number(data.validHeight) || Number(data.sheetHeight) || 325;

  // Product with bleed
  const productWithBleedW = productWidth + bleed * 2;
  const productWithBleedH = productHeight + bleed * 2;

  // Size according to orientation
  const prodW = orientation === 'horizontal' ? productWithBleedW : productWithBleedH;
  const prodH = orientation === 'horizontal' ? productWithBleedH : productWithBleedW;

  // Valid area is always landscape
  const vw = Math.max(validWidth, validHeight);
  const vh = Math.min(validWidth, validHeight);

  // Scale to fit diagram
  const margin = 4;
  const dMaxW = maxWidth || DIAGRAM_DEFAULT_W;
  const dMaxH = maxHeight || DIAGRAM_DEFAULT_H;
  const scaleX = (dMaxW - margin * 2) / vw;
  const scaleY = (dMaxH - margin * 2) / vh;
  const scale = Math.min(scaleX, scaleY);

  const scaledW = vw * scale;
  const scaledH = vh * scale;

  // Center grid within valid area (in real mm)
  const totalUsedW = repsH * prodW + Math.max(0, repsH - 1) * gutterH;
  const totalUsedH = repsV * prodH + Math.max(0, repsV - 1) * gutterV;
  const impOffX = (vw - totalUsedW) / 2;
  const impOffY = (vh - totalUsedH) / 2;

  // Build cells
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < repsV; row++) {
    for (let col = 0; col < repsH; col++) {
      const xMm = impOffX + col * (prodW + gutterH);
      const yMm = impOffY + row * (prodH + gutterV);

      // Bleed area
      cells.push(
        <View
          key={`bleed-${row}-${col}`}
          style={{
            position: 'absolute',
            left: xMm * scale,
            top: yMm * scale,
            width: prodW * scale,
            height: prodH * scale,
            backgroundColor: '#e5e7eb',
            borderWidth: 0.3,
            borderColor: '#9ca3af',
          }}
        />
      );

      // Product area (inside bleed)
      const innerW = orientation === 'horizontal' ? productWidth : productHeight;
      const innerH = orientation === 'horizontal' ? productHeight : productWidth;
      cells.push(
        <View
          key={`cell-${row}-${col}`}
          style={{
            position: 'absolute',
            left: (xMm + bleed) * scale,
            top: (yMm + bleed) * scale,
            width: innerW * scale,
            height: innerH * scale,
            backgroundColor: '#f3f4f6',
            borderWidth: 0.5,
            borderColor: '#6b7280',
          }}
        />
      );
    }
  }

  return (
    <View style={styles.impositionBox}>
      <Text style={styles.impositionTitle}>{title}</Text>

      {/* Valid area outline */}
      <View style={{
        width: scaledW,
        height: scaledH,
        borderWidth: 1.5,
        borderColor: '#d1d5db',
        backgroundColor: '#fafafa',
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
  additionals,
  logoUrl,
  companyName,
  adminOnlyLabels,
  promptSections,
  outputSections,
  useSections,
}) => {
  const formatVal = (v: any): string => {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) return 'Ver imagen';
    return String(v);
  };

  return (
    <Document>
      {items.map((item, itemIndex) => {
        // Filter out prompts with value "No" and sort by order
        const sortedPrompts = [...(item.prompts || [])]
          .filter(p => {
            const val = formatVal(p.value);
            if (val === 'No' || val === 'no') return false;
            // Filter admin_only prompts from work order PDF
            if (adminOnlyLabels && adminOnlyLabels.has(p.label.trim().toUpperCase())) return false;
            return true;
          })
          .sort((a, b) => (a.order || 0) - (b.order || 0));
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
                  <View style={styles.clientRow}>
                    <Text style={styles.clientLabel}>Email:</Text>
                    <Text style={styles.clientValue}>{customerEmail || ''}</Text>
                  </View>
                  <View style={styles.clientRow}>
                    <Text style={styles.clientLabel}>Teléfono:</Text>
                    <Text style={styles.clientValue}>{customerPhone || ''}</Text>
                  </View>
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
              {item.description && (
                <Text style={{ fontSize: 9, color: '#444', marginTop: 2 }}>{item.description}</Text>
              )}
            </View>

            <View style={styles.thinSeparator} />

            {/* ═══ DATA CONTENT ═══ */}
            {useSections ? (
              /* Section-based layout */
              <>
                {OT_SECTION_ORDER.map(sectionKey => {
                  // Gather prompts and outputs assigned to this section
                  const sectionPrompts = sortedPrompts.filter(p => 
                    (promptSections?.get(p.label.trim().toUpperCase()) || '') === sectionKey
                  );
                  const sectionOutputs = outputs.filter(o =>
                    (outputSections?.get(o.name.trim().toUpperCase()) || '') === sectionKey
                  );

                  // Special handling: imposiciones section includes the diagram
                  if (sectionKey === 'imposiciones') {
                    const hasImposition = item.imposition_data && (isSimple || compositeImpositions.length > 0);
                    if (sectionPrompts.length === 0 && sectionOutputs.length === 0 && !hasImposition) return null;
                    return (
                      <View key={sectionKey} style={{ marginBottom: 6 }}>
                        <View style={styles.thickSeparator} />
                        <Text style={styles.sectionTitle}>{OT_SECTION_LABELS[sectionKey]}</Text>
                        {(sectionPrompts.length > 0 || sectionOutputs.length > 0) && (
                          <DataGrid items={[
                            ...sectionPrompts.map(p => ({ label: p.label, value: formatVal(p.value) })),
                            ...sectionOutputs.map(o => ({ label: o.name, value: formatVal(o.value) })),
                          ]} />
                        )}
                        {hasImposition && (
                          <>
                            {isSimple ? (
                              <View style={styles.impositionRow}>
                                <ImpositionDiagram data={item.imposition_data} title="" />
                              </View>
                            ) : compositeImpositions.length > 0 ? (
                              <View style={styles.impositionRow}>
                                {compositeImpositions.map(([key, data]) => {
                                  const alias = item.composite_data?.components?.[key]?.alias || key;
                                  const halfW = Math.floor((DIAGRAM_DEFAULT_W - 20) / compositeImpositions.length);
                                  return <ImpositionDiagram key={key} data={data} title={alias.toUpperCase()} maxWidth={halfW} maxHeight={180} />;
                                })}
                              </View>
                            ) : null}
                          </>
                        )}
                      </View>
                    );
                  }

                  // Special handling: ajustes section includes additionals
                  if (sectionKey === 'ajustes') {
                    const hasAdditionals = additionals && additionals.length > 0;
                    if (sectionPrompts.length === 0 && sectionOutputs.length === 0 && !hasAdditionals) return null;
                    return (
                      <View key={sectionKey} style={{ marginBottom: 6 }}>
                        <View style={styles.thickSeparator} />
                        <Text style={styles.sectionTitle}>{OT_SECTION_LABELS[sectionKey]}</Text>
                        {(sectionPrompts.length > 0 || sectionOutputs.length > 0) && (
                          <DataGrid items={[
                            ...sectionPrompts.map(p => ({ label: p.label, value: formatVal(p.value) })),
                            ...sectionOutputs.map(o => ({ label: o.name, value: formatVal(o.value) })),
                          ]} />
                        )}
                        {hasAdditionals && (
                          <View style={styles.grid3}>
                            {additionals!.map((adj, idx) => (
                              <View key={idx} style={styles.gridItem}>
                                <Text style={styles.gridLabel}>{adj.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  }

                  if (sectionPrompts.length === 0 && sectionOutputs.length === 0) return null;
                  return (
                    <View key={sectionKey} style={{ marginBottom: 6 }}>
                      <View style={styles.thickSeparator} />
                      <Text style={styles.sectionTitle}>{OT_SECTION_LABELS[sectionKey]}</Text>
                      <DataGrid items={[
                        ...sectionPrompts.map(p => ({ label: p.label, value: formatVal(p.value) })),
                        ...sectionOutputs.map(o => ({ label: o.name, value: formatVal(o.value) })),
                      ]} />
                    </View>
                  );
                })}

                {/* Unclassified prompts/outputs (no section assigned) */}
                {(() => {
                  const unclassifiedPrompts = sortedPrompts.filter(p => 
                    !promptSections?.has(p.label.trim().toUpperCase()) || 
                    !promptSections.get(p.label.trim().toUpperCase())
                  );
                  const unclassifiedOutputs = outputs.filter(o =>
                    !outputSections?.has(o.name.trim().toUpperCase()) ||
                    !outputSections.get(o.name.trim().toUpperCase())
                  );
                  if (unclassifiedPrompts.length === 0 && unclassifiedOutputs.length === 0) return null;
                  return (
                    <View style={{ marginBottom: 6 }}>
                      <View style={styles.thickSeparator} />
                      <Text style={styles.sectionTitle}>OTROS DATOS</Text>
                      <DataGrid items={[
                        ...unclassifiedPrompts.map(p => ({ label: p.label, value: formatVal(p.value) })),
                        ...unclassifiedOutputs.map(o => ({ label: o.name, value: formatVal(o.value) })),
                      ]} />
                    </View>
                  );
                })()}
              </>
            ) : (
              /* Legacy flat layout */
              <>
                {(sortedPrompts.length > 0 || outputs.length > 0) && (
                  <View style={{ marginBottom: 6 }}>
                    <DataGrid
                      items={[
                        ...sortedPrompts.map(p => ({ label: p.label, value: formatVal(p.value) })),
                        ...outputs.map(o => ({ label: o.name, value: formatVal(o.value) })),
                      ]}
                    />
                  </View>
                )}

                {/* Imposition */}
                {item.imposition_data && (
                  <>
                    <View style={styles.thickSeparator} />
                    {isSimple ? (
                      <View style={styles.impositionRow}>
                        <ImpositionDiagram data={item.imposition_data} title="" />
                      </View>
                    ) : compositeImpositions.length > 0 ? (
                      <View style={styles.impositionRow}>
                        {compositeImpositions.map(([key, data]) => {
                          const alias = item.composite_data?.components?.[key]?.alias || key;
                          const halfW = Math.floor((DIAGRAM_DEFAULT_W - 20) / compositeImpositions.length);
                          return <ImpositionDiagram key={key} data={data} title={alias.toUpperCase()} maxWidth={halfW} maxHeight={180} />;
                        })}
                      </View>
                    ) : (
                      <View style={styles.impositionRow}>
                        <ImpositionDiagram data={item.imposition_data} title="" />
                      </View>
                    )}
                  </>
                )}

                <View style={styles.thickSeparator} />

                {/* Ajustes */}
                <View style={{ marginBottom: 6 }}>
                  <Text style={styles.sectionTitle}>AJUSTES PERSONALIZADOS</Text>
                  {additionals && additionals.length > 0 ? (
                    <View style={styles.grid3}>
                      {additionals.map((adj, idx) => (
                        <View key={idx} style={styles.gridItem}>
                          <Text style={styles.gridLabel}>{adj.name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            )}

            <View style={styles.thickSeparator} />

            {/* ═══ OBSERVACIONES ═══ */}
            <View style={{ marginTop: 6 }}>
              <Text style={styles.sectionTitle}>OBSERVACIONES</Text>
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
    let adminOnlyLabels = new Set<string>();

    if (options.orderId) {
      const { data: order } = await supabase
        .from('sales_orders')
        .select('customer_id, organization_id')
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

      // Load admin_only prompt labels to filter from OT PDF
      if (order?.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('api_user_id')
          .eq('id', order.organization_id)
          .maybeSingle();

        if (orgData?.api_user_id) {
          const { data: settings } = await supabase
            .from('product_prompt_settings')
            .select('prompt_name, label')
            .eq('api_user_id', orgData.api_user_id)
            .eq('admin_only', true);

          settings?.forEach(s => {
            if (s.label) adminOnlyLabels.add(s.label.trim().toUpperCase());
            if (s.prompt_name) adminOnlyLabels.add(s.prompt_name.trim().toUpperCase());
          });
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
        adminOnlyLabels={adminOnlyLabels}
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
