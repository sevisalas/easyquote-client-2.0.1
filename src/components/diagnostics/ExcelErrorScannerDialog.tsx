import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Copy, FileSpreadsheet, Loader2, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ERROR_RE = /^#(N\/?A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!|SPILL!|CALC!)$/i;

// Regex to extract sheet references from formulas: 'SheetName'!A1 or SheetName!A1
const SHEET_REF_RE = /'?([^'!\[\]]+)'?!([A-Z]+\d+)/gi;
// Regex to detect external file references [filename]
const EXTERNAL_REF_RE = /\[([^\]]+)\]/g;

type IssueType = "error" | "missing_sheet" | "external_ref" | "circular_suspect";

type ExcelCellIssue = {
  sheet: string;
  cell: string;
  error: string;
  formula?: string;
  raw?: unknown;
  type: IssueType;
  refChain?: string[];
};

function normalizeErrorString(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (ERROR_RE.test(s)) return s.toUpperCase();
  }
  return null;
}

function extractCellError(cell: any): string | null {
  const fromW = normalizeErrorString(cell?.w);
  if (fromW) return fromW;

  const fromV = normalizeErrorString(cell?.v);
  if (fromV) return fromV;

  if (cell?.t === "e") return String(cell?.w ?? cell?.v ?? "#ERROR");

  return null;
}

function sortA1(a: string, b: string) {
  const match = (s: string) => {
    const m = /^([A-Z]+)(\d+)$/i.exec(s);
    return m ? { col: m[1].toUpperCase(), row: Number(m[2]) } : { col: s.toUpperCase(), row: Number.MAX_SAFE_INTEGER };
  };
  const A = match(a);
  const B = match(b);
  if (A.col !== B.col) return A.col.localeCompare(B.col);
  return A.row - B.row;
}

// Extract all sheet references from a formula
function extractSheetRefs(formula: string): Array<{ sheet: string; cell: string }> {
  const refs: Array<{ sheet: string; cell: string }> = [];
  let match;
  const regex = new RegExp(SHEET_REF_RE.source, "gi");
  while ((match = regex.exec(formula)) !== null) {
    refs.push({ sheet: match[1], cell: match[2] });
  }
  return refs;
}

// Extract external file references
function extractExternalRefs(formula: string): string[] {
  const refs: string[] = [];
  let match;
  const regex = new RegExp(EXTERNAL_REF_RE.source, "g");
  while ((match = regex.exec(formula)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

// Build a reference graph and detect potential circular references
function buildRefGraph(
  wb: XLSX.WorkBook
): Map<string, { formula: string; refs: string[] }> {
  const graph = new Map<string, { formula: string; refs: string[] }>();
  
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    
    for (const [addr, cell] of Object.entries(ws)) {
      if (addr.startsWith("!")) continue;
      const formula = (cell as any)?.f;
      if (!formula) continue;
      
      const fullAddr = `${sheetName}!${addr}`;
      const sheetRefs = extractSheetRefs(formula);
      const localRefs = formula.match(/[A-Z]+\d+/gi) || [];
      
      const allRefs: string[] = [
        ...sheetRefs.map(r => `${r.sheet}!${r.cell}`),
        ...localRefs.filter(r => !formula.includes(`!${r}`)).map(r => `${sheetName}!${r}`)
      ];
      
      graph.set(fullAddr, { formula, refs: allRefs });
    }
  }
  
  return graph;
}

// Trace reference chain from a cell (limited depth to avoid infinite loops)
function traceRefChain(
  startCell: string,
  graph: Map<string, { formula: string; refs: string[] }>,
  maxDepth: number = 10
): string[] {
  const chain: string[] = [startCell];
  const visited = new Set<string>([startCell]);
  let current = startCell;
  
  for (let i = 0; i < maxDepth; i++) {
    const node = graph.get(current);
    if (!node || node.refs.length === 0) break;
    
    // Follow first reference (simplified - real circular detection would check all paths)
    const nextRef = node.refs[0];
    if (visited.has(nextRef)) {
      chain.push(nextRef + " (circular?)");
      break;
    }
    
    visited.add(nextRef);
    chain.push(nextRef);
    current = nextRef;
  }
  
  return chain;
}

const TYPE_LABELS: Record<IssueType, { label: string; variant: "destructive" | "secondary" | "outline" | "default" }> = {
  error: { label: "Error", variant: "destructive" },
  missing_sheet: { label: "Hoja no existe", variant: "secondary" },
  external_ref: { label: "Ref externa", variant: "outline" },
  circular_suspect: { label: "Ref circular?", variant: "default" },
};

export function ExcelErrorScannerDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [issues, setIssues] = useState<ExcelCellIssue[]>([]);

  const sheetCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of issues) map.set(i.sheet, (map.get(i.sheet) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const typeCounts = useMemo(() => {
    const map = new Map<IssueType, number>();
    for (const i of issues) map.set(i.type, (map.get(i.type) ?? 0) + 1);
    return map;
  }, [issues]);

  const handlePickFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setIsScanning(true);
    setHasScanned(false);
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
      const sheetNamesLower = new Set(wb.SheetNames.map(s => s.toLowerCase()));
      const refGraph = buildRefGraph(wb);

      for (const sheetName of wb.SheetNames) {
        const ws: any = wb.Sheets[sheetName];
        if (!ws) continue;

        for (const [addr, cell] of Object.entries(ws)) {
          if (addr.startsWith("!")) continue;
          
          const formula = (cell as any)?.f ? String((cell as any).f) : undefined;
          
          // 1. Check for cell errors (#REF!, #N/A, etc.)
          const error = extractCellError(cell);
          if (error) {
            const fullAddr = `${sheetName}!${addr}`;
            const chain = refGraph.has(fullAddr) ? traceRefChain(fullAddr, refGraph) : undefined;
            
            found.push({
              sheet: sheetName,
              cell: addr,
              error,
              formula,
              raw: (cell as any)?.v,
              type: "error",
              refChain: chain && chain.length > 1 ? chain : undefined,
            });
            continue;
          }
          
          if (!formula) continue;
          
          // 2. Check for references to non-existent sheets
          const sheetRefs = extractSheetRefs(formula);
          for (const ref of sheetRefs) {
            if (!sheetNamesLower.has(ref.sheet.toLowerCase())) {
              found.push({
                sheet: sheetName,
                cell: addr,
                error: `Hoja "${ref.sheet}" no existe`,
                formula,
                type: "missing_sheet",
              });
              break;
            }
          }
          
          // 3. Check for external file references
          const externalRefs = extractExternalRefs(formula);
          if (externalRefs.length > 0) {
            found.push({
              sheet: sheetName,
              cell: addr,
              error: `Ref externa: ${externalRefs.join(", ")}`,
              formula,
              type: "external_ref",
            });
          }
        }
      }

      // 4. Detect potential circular references by checking for long chains
      for (const [addr, node] of refGraph.entries()) {
        const chain = traceRefChain(addr, refGraph, 15);
        if (chain.length > 8 || chain[chain.length - 1]?.includes("circular")) {
          const [sheet, cell] = addr.split("!");
          // Only add if not already reported as an error
          if (!found.some(f => f.sheet === sheet && f.cell === cell && f.type === "error")) {
            found.push({
              sheet,
              cell,
              error: `Cadena de ${chain.length} referencias`,
              formula: node.formula,
              type: "circular_suspect",
              refChain: chain,
            });
          }
        }
      }

      found.sort((a, b) => {
        // Sort by type priority, then sheet, then cell
        const typePriority: Record<IssueType, number> = { error: 0, missing_sheet: 1, external_ref: 2, circular_suspect: 3 };
        if (a.type !== b.type) return typePriority[a.type] - typePriority[b.type];
        if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
        return sortA1(a.cell, b.cell);
      });

      setIssues(found);

      const errorCount = found.filter(f => f.type === "error").length;
      const otherCount = found.length - errorCount;
      
      toast({
        title: "Análisis completado",
        description: found.length
          ? `${errorCount} error(es) + ${otherCount} advertencia(s) encontrados`
          : "No se han encontrado problemas en el archivo.",
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
      setHasScanned(true);
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

      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Analizador de errores de Excel</DialogTitle>
          <DialogDescription>
            Detecta errores (#N/A, #REF!), referencias a hojas inexistentes, referencias externas y cadenas de referencias problemáticas.
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

          <div className="grid lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1">
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Resumen</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {isScanning ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Analizando...
                    </span>
                  ) : issues.length ? (
                    `${issues.length} problema(s) en ${sheetCounts.length} hoja(s)`
                  ) : hasScanned ? (
                    "✓ No se encontraron problemas"
                  ) : (
                    "Sube un archivo para analizar"
                  )}
                </div>

                {typeCounts.size > 0 && (
                  <div className="mt-3 space-y-1">
                    {Array.from(typeCounts.entries()).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <Badge variant={TYPE_LABELS[type].variant} className="text-xs">
                          {TYPE_LABELS[type].label}
                        </Badge>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {sheetCounts.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Por hoja:</div>
                    {sheetCounts.slice(0, 6).map(([sheet, count]) => (
                      <div key={sheet} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[120px]" title={sheet}>
                          {sheet}
                        </span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-md border">
                <ScrollArea className="h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead className="w-[140px]">Hoja</TableHead>
                        <TableHead className="w-[70px]">Celda</TableHead>
                        <TableHead className="w-[180px]">Error</TableHead>
                        <TableHead>Fórmula / Cadena</TableHead>
                        <TableHead className="w-[56px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.length ? (
                        issues.map((i, idx) => (
                          <TableRow key={`${i.sheet}:${i.cell}:${idx}`}>
                            <TableCell>
                              <Badge variant={TYPE_LABELS[i.type].variant} className="text-xs">
                                {TYPE_LABELS[i.type].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{i.sheet}</TableCell>
                            <TableCell className="font-mono text-xs">{i.cell}</TableCell>
                            <TableCell className="font-mono text-xs text-destructive">{i.error}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {i.refChain && i.refChain.length > 1 ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Link2 className="h-3 w-3" />
                                    <span>Cadena de referencias:</span>
                                  </div>
                                  <div className="text-xs break-all">
                                    {i.refChain.join(" → ")}
                                  </div>
                                  {i.formula && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      ={i.formula}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="whitespace-pre-wrap break-words">
                                  {i.formula ? `=${i.formula}` : "(sin fórmula)"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => copyText(
                                  i.refChain && i.refChain.length > 1
                                    ? i.refChain.join(" -> ")
                                    : `${i.sheet}!${i.cell}${i.formula ? `\n=${i.formula}` : ""}`
                                )}
                                title="Copiar referencia"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-sm text-muted-foreground">
                            Sube un archivo para ver problemas.
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
