import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Copy, FileSpreadsheet, Loader2 } from "lucide-react";

const ERROR_RE = /^#(N\/?A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!|SPILL!|CALC!)$/i;

type ExcelCellIssue = {
  sheet: string;
  cell: string;
  error: string;
  formula?: string;
  raw?: unknown;
};

function normalizeErrorString(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (ERROR_RE.test(s)) return s.toUpperCase();
  }
  return null;
}

function extractCellError(cell: any): string | null {
  // SheetJS uses cell.t === 'e' for errors; cell.v often contains a short code, cell.w is rendered text.
  const fromW = normalizeErrorString(cell?.w);
  if (fromW) return fromW;

  const fromV = normalizeErrorString(cell?.v);
  if (fromV) return fromV;

  // Sometimes errors come as t='e' but v isn't '#REF!' etc; still surface it.
  if (cell?.t === "e") return String(cell?.w ?? cell?.v ?? "#ERROR");

  return null;
}

function sortA1(a: string, b: string) {
  // Basic A1 sort (column letters then row). Good enough for diagnostics.
  const match = (s: string) => {
    const m = /^([A-Z]+)(\d+)$/i.exec(s);
    return m ? { col: m[1].toUpperCase(), row: Number(m[2]) } : { col: s.toUpperCase(), row: Number.MAX_SAFE_INTEGER };
  };
  const A = match(a);
  const B = match(b);
  if (A.col !== B.col) return A.col.localeCompare(B.col);
  return A.row - B.row;
}

export function ExcelErrorScannerDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [issues, setIssues] = useState<ExcelCellIssue[]>([]);

  const sheetCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of issues) map.set(i.sheet, (map.get(i.sheet) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const handlePickFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setIsScanning(true);
    setIssues([]);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {
        type: "array",
        cellFormula: true,
        cellNF: false,
        cellText: true,
      });

      const found: ExcelCellIssue[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws: any = wb.Sheets[sheetName];
        if (!ws) continue;

        for (const [addr, cell] of Object.entries(ws)) {
          if (addr.startsWith("!")) continue;
          const error = extractCellError(cell);
          if (!error) continue;

          found.push({
            sheet: sheetName,
            cell: addr,
            error,
            formula: (cell as any)?.f ? String((cell as any).f) : undefined,
            raw: (cell as any)?.v,
          });
        }
      }

      found.sort((a, b) => {
        if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
        return sortA1(a.cell, b.cell);
      });

      setIssues(found);

      toast({
        title: "Análisis completado",
        description: found.length
          ? `Se han encontrado ${found.length} celda(s) con errores (#N/A, #REF!, etc.)`
          : "No se han encontrado errores de Excel en las celdas.",
      });
    } catch (e: any) {
      console.error("ExcelErrorScannerDialog: scan failed", e);
      toast({
        title: "Error al analizar el Excel",
        description: e?.message ?? "No se pudo leer el archivo",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: text });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 w-full sm:w-auto">
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline">Analizar Excel</span>
          <span className="sm:hidden">Excel</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Analizador de errores de Excel</DialogTitle>
          <DialogDescription>
            Sube un XLSX y te listamos las celdas con errores (#N/A, #REF!, etc.) con su hoja y fórmula.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="excel-file">Archivo XLSX</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
              disabled={isScanning}
            />
            {fileName ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="break-all">{fileName}</span>
              </div>
            ) : null}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Resumen</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {isScanning ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Analizando...
                    </span>
                  ) : issues.length ? (
                    `${issues.length} error(es) en ${sheetCounts.length} hoja(s)`
                  ) : (
                    "Sin resultados todavía"
                  )}
                </div>

                {sheetCounts.length ? (
                  <div className="mt-3 space-y-1">
                    {sheetCounts.slice(0, 8).map(([sheet, count]) => (
                      <div key={sheet} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[180px]" title={sheet}>
                          {sheet}
                        </span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-md border">
                <ScrollArea className="h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[170px]">Hoja</TableHead>
                        <TableHead className="w-[90px]">Celda</TableHead>
                        <TableHead className="w-[90px]">Error</TableHead>
                        <TableHead>Fórmula</TableHead>
                        <TableHead className="w-[56px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.length ? (
                        issues.map((i, idx) => (
                          <TableRow key={`${i.sheet}:${i.cell}:${idx}`}>
                            <TableCell className="font-mono text-xs">{i.sheet}</TableCell>
                            <TableCell className="font-mono text-xs">{i.cell}</TableCell>
                            <TableCell className="font-mono text-xs">{i.error}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-pre-wrap break-words">
                              {i.formula ?? "(sin fórmula)"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => copyText(`${i.sheet}!${i.cell}${i.formula ? `\n=${i.formula}` : ""}`)}
                                title="Copiar referencia"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-sm text-muted-foreground">
                            Sube un archivo para ver errores.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
