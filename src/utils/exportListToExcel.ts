import * as XLSX from "xlsx";

interface ExportColumn {
  header: string;
  key: string;
}

export function exportListToExcel(
  rows: Record<string, any>[],
  columns: ExportColumn[],
  fileName: string,
) {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) => columns.map((c) => row[c.key] ?? ""));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-width
  ws["!cols"] = columns.map((_, i) => ({
    wch: Math.max(
      headers[i].length,
      ...data.map((r) => String(r[i] ?? "").length),
      10,
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Listado");
  XLSX.writeFile(wb, fileName);
}
