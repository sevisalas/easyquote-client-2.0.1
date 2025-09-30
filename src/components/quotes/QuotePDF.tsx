import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  h1: { fontSize: 18, marginBottom: 8 },
  meta: { marginBottom: 12 },
  section: { marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  tableHeader: { flexDirection: "row", borderBottom: 1, paddingBottom: 4, marginBottom: 6 },
  th: { flex: 1, fontWeight: 700 },
  td: { flex: 1 },
});

const fmtEUR = (n: any) => {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(num)) return String(n ?? "");
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num);
};

export default function QuotePDF({ customer, main, items, template, quote }: any) {
  const brand = (template?.brandColor as string) || "#0ea5e9";
  const company = (template?.companyName as string) || "";
  const logoUrl = (template?.logoUrl as string) || "";
  const footerText = (template?.footerText as string) || "";
  const today = new Date();
  // Solo usar los items reales
  const allItems = Array.isArray(items) ? items : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: 12 }}>
          {logoUrl ? (
            <Image src={logoUrl} style={{ width: 120, height: 36 }} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{company || ""}</Text>
          )}
          <View style={{ height: 3, backgroundColor: brand, marginTop: 6 }} />
        </View>

        <Text style={{ ...styles.h1, color: brand }}>Presupuesto</Text>
        <View style={styles.meta}>
          {quote?.quote_number && <Text>Número: {quote.quote_number}</Text>}
          {!!company && <Text>Empresa: {company}</Text>}
          <Text>Fecha: {today.toLocaleDateString("es-ES")}</Text>
          <Text>Cliente: {customer?.name || ""}</Text>
        </View>

        {allItems.length > 0 && (
          <View style={styles.section}>
            <Text style={{ marginBottom: 6, fontSize: 13 }}>Artículos</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.th}>Producto</Text>
              <Text style={styles.th}>Descripción</Text>
              <Text style={styles.th}>Precio</Text>
            </View>
            {allItems.map((item: any, i: number) => {
              const description = item?.itemDescription || item?.product_name || item?.name || `Artículo ${i + 1}`;
              
              return (
                <View key={i} style={{ marginBottom: 12 }}>
                  {/* Descripción del artículo */}
                  <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{description}</Text>
                  
                  {/* Opciones de cantidad */}
                  {item?.multi && typeof item.multi === 'object' && Array.isArray(item.multi.rows) && (
                    <View style={{ marginLeft: 8, marginTop: 4 }}>
                      {item.multi.rows
                        .filter((row: any) => row && row.qty > 0)
                        .map((row: any, idx: number) => (
                          <Text key={idx} style={{ fontSize: 10, marginBottom: 2 }}>
                            {row.qty} unidades × {fmtEUR(row.unit)} = {fmtEUR(row.totalStr)}
                          </Text>
                        ))}
                    </View>
                  )}
                  
                  {/* Precio (solo Price output) */}
                  {item?.outputs && item.outputs.find((output: any) => output.name === "Price") && (
                    <View style={{ marginLeft: 12, marginTop: 4, backgroundColor: "#f0f9ff", padding: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Precio:</Text>
                      <Text style={{ fontSize: 9 }}>
                        • {item.outputs.find((output: any) => output.name === "Price").value}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Totales */}
        {allItems.length > 0 && (
          <View style={{ marginTop: 20, marginLeft: 'auto', width: '40%' }}>
            <View style={{ borderTop: 1, borderColor: '#e5e7eb', paddingTop: 8 }}>
              {(() => {
                const subtotal = allItems.reduce((sum, item) => sum + (parseFloat(item?.total_price || 0)), 0);
                const iva = subtotal * 0.21; // 21% IVA
                const total = subtotal + iva;
                
                return (
                  <>
                    <View style={styles.row}>
                      <Text style={{ fontSize: 10 }}>Subtotal:</Text>
                      <Text style={{ fontSize: 10, fontWeight: 700 }}>{fmtEUR(subtotal)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={{ fontSize: 10 }}>IVA (21%):</Text>
                      <Text style={{ fontSize: 10, fontWeight: 700 }}>{fmtEUR(iva)}</Text>
                    </View>
                    <View style={{ ...styles.row, borderTop: 1, borderColor: brand, paddingTop: 4, marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: brand }}>TOTAL:</Text>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: brand }}>{fmtEUR(total)}</Text>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        )}

        {footerText ? (
          <View style={{ position: "absolute", bottom: 24, left: 32, right: 32 }}>
            <View style={{ height: 1, backgroundColor: "#e5e7eb", marginBottom: 6 }} />
            <Text style={{ fontSize: 9, color: "#6b7280" }}>{footerText}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
