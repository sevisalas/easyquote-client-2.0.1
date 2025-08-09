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

export default function QuotePDF({ customer, main, items, template }: any) {
  const brand = (template?.brandColor as string) || "#0ea5e9";
  const company = (template?.companyName as string) || "";
  const logoUrl = (template?.logoUrl as string) || "";
  const footerText = (template?.footerText as string) || "";
  const today = new Date();
  const itemsArr = Array.isArray(items) ? items : [];
  const extrasTotal = itemsArr.reduce((acc, it) => {
    const v = typeof it?.price === "number" ? it.price : parseFloat(String(it?.price ?? "").replace(/\./g, "").replace(",", ".")) || 0;
    return acc + (Number.isNaN(v) ? 0 : v);
  }, 0);
  const mainPrice = typeof main?.price === "number" ? main.price : parseFloat(String(main?.price ?? "").replace(/\./g, "").replace(",", ".")) || 0;
  const total = mainPrice + extrasTotal;

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
          {!!company && <Text>Empresa: {company}</Text>}
          <Text>Fecha: {today.toLocaleDateString("es-ES")}</Text>
          <Text>Cliente: {customer?.name || ""}</Text>
        </View>

        <View style={styles.section}>
          <Text style={{ marginBottom: 6, fontSize: 13 }}>Artículo principal</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.th}>Producto</Text>
            <Text style={styles.th}>Precio</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.td}>{main?.product || "Producto"}</Text>
            <Text style={styles.td}>{fmtEUR(main?.price)}</Text>
          </View>
        </View>

        {itemsArr.length > 0 && (
          <View style={styles.section}>
            <Text style={{ marginBottom: 6, fontSize: 13 }}>Artículos adicionales</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.th}>Artículo</Text>
              <Text style={styles.th}>Precio</Text>
            </View>
            {itemsArr.map((it: any, i: number) => (
              <View key={i} style={styles.row}>
                <Text style={styles.td}>{it?.productId ? `Artículo ${i + 1}` : `Artículo ${i + 1}`}</Text>
                <Text style={styles.td}>{fmtEUR(it?.price)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={{ ...styles.row, borderTop: 1, paddingTop: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>Total</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, color: brand }}>{fmtEUR(total)}</Text>
          </View>
        </View>

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
