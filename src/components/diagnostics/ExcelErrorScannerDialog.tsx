import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Copy, FileSpreadsheet, Loader2, Link2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Standard Excel error values
const ERROR_RE = /^#(N\/?A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!|SPILL!|CALC!)$/i;

// Regex to extract sheet references: 'Sheet Name'!A1 or SheetName!A1
const SHEET_REF_RE = /(?:^|[,(])\s*'?([A-Za-z_][A-Za-z0-9_ ]*)'?!(\$?[A-Z]+\$?\d+)/gi;
// Regex to detect external file references [filename]
const EXTERNAL_REF_RE = /\[([^\]]+)\]/g;

// ============================================================
// SYNCFUSION XLSIO UNSUPPORTED FUNCTIONS
// These functions are NOT calculated by Syncfusion - they cause #NAME? or wrong results
// Source: https://help.syncfusion.com/file-formats/xlsio/working-with-formulas#supported-functions
// ============================================================
const SYNCFUSION_UNSUPPORTED_FUNCTIONS = [
  // Dynamic array functions (Excel 365/2021) - NEVER supported
  "XLOOKUP", "BUSCARX",
  "XMATCH", "COINCIDIRX",
  "FILTER", "FILTRAR",
  "SORT", "ORDENAR",  
  "SORTBY", "ORDENARPOR",
  "UNIQUE", "UNICOS",
  "SEQUENCE", "SECUENCIA",
  "RANDARRAY",
  "LET",
  "LAMBDA",
  "MAP",
  "REDUCE",
  "SCAN",
  "MAKEARRAY",
  "BYCOL",
  "BYROW",
  "ISOMITTED",
  // Text functions (Excel 2021+)
  "TEXTBEFORE",
  "TEXTAFTER", 
  "TEXTSPLIT",
  "VALUETOTEXT",
  "ARRAYTOTEXT",
  // Other modern functions
  "STOCKHISTORY",
  "IMAGE",
  "HSTACK",
  "VSTACK",
  "TOROW",
  "TOCOL",
  "WRAPROWS",
  "WRAPCOLS",
  "TAKE",
  "DROP",
  "EXPAND",
  "CHOOSECOLS",
  "CHOOSEROWS",
];

// Functions that MAY work but have known issues or version-dependent behavior
const SYNCFUSION_RISKY_FUNCTIONS = [
  // These are in Syncfusion docs as supported but have reported issues
  "IFS", "SI.CONJUNTO",           // Nested IF alternative - may fail in complex cases
  "SWITCH", "CAMBIAR",            // May have issues with many cases
  "MAXIFS", "MAX.SI.CONJUNTO",    // Multi-condition - version dependent
  "MINIFS", "MIN.SI.CONJUNTO",    // Multi-condition - version dependent
  "TEXTJOIN", "UNIRCADENAS",      // May fail with large ranges
  "CONCAT",                       // Use CONCATENATE for safety
  "FORMULATEXT",                  // May not work correctly
  "ISFORMULA",                    // May not work correctly
];

// Runtime error patterns removed - too many false positives on working files

// Data flow patterns removed - too many false positives on working files

// Regex to extract function names from formulas
const FUNCTION_RE = /([A-Z][A-Z0-9_.]+)\s*\(/gi;

type IssueType = 
  | "error" 
  | "missing_sheet" 
  | "external_ref" 
  | "circular_suspect" 
  | "syncfusion_unsupported"
  | "syncfusion_risky";

type IssueSeverity = "error" | "warning" | "info";

type ExcelCellIssue = {
  sheet: string;
  cell: string;
  error: string;
  formula?: string;
  raw?: unknown;
  type: IssueType;
  severity: IssueSeverity;
  refChain?: string[];
  suggestion?: string;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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
  const simpleRef = /(?:^|[,(:+\-*/=<>& ])'?([A-Za-z_][A-Za-z0-9_]*)'?!(\$?[A-Z]+\$?\d+)/gi;
  
  let match;
  while ((match = simpleRef.exec(formula)) !== null) {
    const sheetName = match[1].trim();
    if (!["IF", "AND", "OR", "NOT", "SUM", "VLOOKUP", "HLOOKUP", "INDEX", "MATCH", "IFERROR", "SUMIF", "COUNTIF"].includes(sheetName.toUpperCase())) {
      refs.push({ sheet: sheetName, cell: match[2] });
    }
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

// Extract unsupported Syncfusion functions
function extractSyncfusionUnsupportedFunctions(formula: string): string[] {
  const funcs: string[] = [];
  const seen = new Set<string>();
  let match;
  const regex = new RegExp(FUNCTION_RE.source, "gi");
  while ((match = regex.exec(formula)) !== null) {
    const funcName = match[1].toUpperCase();
    if (!seen.has(funcName) && SYNCFUSION_UNSUPPORTED_FUNCTIONS.map(f => f.toUpperCase()).includes(funcName)) {
      seen.add(funcName);
      funcs.push(funcName);
    }
  }
  return funcs;
}

// Extract risky Syncfusion functions
function extractSyncfusionRiskyFunctions(formula: string): string[] {
  const funcs: string[] = [];
  const seen = new Set<string>();
  let match;
  const regex = new RegExp(FUNCTION_RE.source, "gi");
  while ((match = regex.exec(formula)) !== null) {
    const funcName = match[1].toUpperCase();
    if (!seen.has(funcName) && SYNCFUSION_RISKY_FUNCTIONS.map(f => f.toUpperCase()).includes(funcName)) {
      seen.add(funcName);
      funcs.push(funcName);
    }
  }
  return funcs;
}


// Build a reference graph and detect potential circular references
function buildRefGraph(wb: XLSX.WorkBook): Map<string, { formula: string; refs: string[] }> {
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

// Trace reference chain from a cell
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

// Get all functions used in the workbook
function getAllFunctions(wb: XLSX.WorkBook): Map<string, number> {
  const funcCount = new Map<string, number>();
  
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    
    for (const [addr, cell] of Object.entries(ws)) {
      if (addr.startsWith("!")) continue;
      const formula = (cell as any)?.f;
      if (!formula) continue;
      
      let match;
      const regex = new RegExp(FUNCTION_RE.source, "gi");
      while ((match = regex.exec(formula)) !== null) {
        const funcName = match[1].toUpperCase();
        funcCount.set(funcName, (funcCount.get(funcName) || 0) + 1);
      }
    }
  }
  
  return funcCount;
}

const TYPE_LABELS: Record<IssueType, { label: string; variant: "destructive" | "secondary" | "outline" | "default" }> = {
  error: { label: "Error", variant: "destructive" },
  syncfusion_unsupported: { label: "No soportada", variant: "destructive" },
  syncfusion_risky: { label: "Riesgo", variant: "secondary" },
  missing_sheet: { label: "Hoja falta", variant: "secondary" },
  external_ref: { label: "Ref externa", variant: "outline" },
  circular_suspect: { label: "Circular?", variant: "default" },
};

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  error: "text-destructive",
  warning: "text-yellow-600 dark:text-yellow-500",
  info: "text-blue-600 dark:text-blue-400"
};

export function ExcelErrorScannerDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [issues, setIssues] = useState<ExcelCellIssue[]>([]);
  const [allFunctions, setAllFunctions] = useState<Map<string, number>>(new Map());
  const [sheetInfo, setSheetInfo] = useState<Array<{ name: string; cells: number; formulas: number }>>([]);
  const [activeTab, setActiveTab] = useState<"issues" | "functions" | "sheets">("issues");

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

  const severityCounts = useMemo(() => {
    const map = new Map<IssueSeverity, number>();
    for (const i of issues) map.set(i.severity, (map.get(i.severity) ?? 0) + 1);
    return map;
  }, [issues]);

  // Categorize functions
  const functionAnalysis = useMemo(() => {
    const unsupported: Array<[string, number]> = [];
    const risky: Array<[string, number]> = [];
    const supported: Array<[string, number]> = [];
    
    for (const [func, count] of allFunctions) {
      const upper = func.toUpperCase();
      if (SYNCFUSION_UNSUPPORTED_FUNCTIONS.map(f => f.toUpperCase()).includes(upper)) {
        unsupported.push([func, count]);
      } else if (SYNCFUSION_RISKY_FUNCTIONS.map(f => f.toUpperCase()).includes(upper)) {
        risky.push([func, count]);
      } else {
        supported.push([func, count]);
      }
    }
    
    return {
      unsupported: unsupported.sort((a, b) => b[1] - a[1]),
      risky: risky.sort((a, b) => b[1] - a[1]),
      supported: supported.sort((a, b) => b[1] - a[1])
    };
  }, [allFunctions]);

  const handlePickFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setIsScanning(true);
    setHasScanned(false);
    setIssues([]);
    setAllFunctions(new Map());
    setSheetInfo([]);

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
      const sheets: Array<{ name: string; cells: number; formulas: number }> = [];

      for (const sheetName of wb.SheetNames) {
        const ws: any = wb.Sheets[sheetName];
        if (!ws) continue;

        let cellCount = 0;
        let formulaCount = 0;

        for (const [addr, cell] of Object.entries(ws)) {
          if (addr.startsWith("!")) continue;
          cellCount++;
          
          const formula = (cell as any)?.f ? String((cell as any).f) : undefined;
          if (formula) formulaCount++;
          
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
              severity: "error",
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
                severity: "error",
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
              severity: "error",
            });
          }
          
          // 4. Check for Syncfusion unsupported functions
          const syncfusionUnsupported = extractSyncfusionUnsupportedFunctions(formula);
          if (syncfusionUnsupported.length > 0) {
            found.push({
              sheet: sheetName,
              cell: addr,
              error: `No soportada: ${syncfusionUnsupported.join(", ")}`,
              formula,
              type: "syncfusion_unsupported",
              severity: "error",
              suggestion: "Reemplazar por función equivalente soportada (ver documentación)"
            });
          }
          
          // 5. Check for risky Syncfusion functions
          const riskyFuncs = extractSyncfusionRiskyFunctions(formula);
          if (riskyFuncs.length > 0) {
            found.push({
              sheet: sheetName,
              cell: addr,
              error: `Función con riesgo: ${riskyFuncs.join(", ")}`,
              formula,
              type: "syncfusion_risky",
              severity: "warning",
              suggestion: "Probar exhaustivamente con diferentes valores de entrada"
            });
          }
          
          // Runtime and data flow checks removed - too many false positives
        }
        
        sheets.push({ name: sheetName, cells: cellCount, formulas: formulaCount });
      }

      // 8. Detect potential circular references
      for (const [addr, node] of refGraph.entries()) {
        const chain = traceRefChain(addr, refGraph, 15);
        if (chain.length > 8 || chain[chain.length - 1]?.includes("circular")) {
          const [sheet, cell] = addr.split("!");
          if (!found.some(f => f.sheet === sheet && f.cell === cell && f.type === "error")) {
            found.push({
              sheet,
              cell,
              error: `Cadena de ${chain.length} referencias`,
              formula: node.formula,
              type: "circular_suspect",
              severity: "warning",
              refChain: chain,
            });
          }
        }
      }

      // Sort by severity, then type, then sheet, then cell
      found.sort((a, b) => {
        const severityPriority: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
        if (a.severity !== b.severity) return severityPriority[a.severity] - severityPriority[b.severity];
        
        const typePriority: Record<IssueType, number> = { 
          error: 0,
          syncfusion_unsupported: 1,
          missing_sheet: 2,
          external_ref: 3,
          syncfusion_risky: 4,
          circular_suspect: 5
        };
        if (a.type !== b.type) return typePriority[a.type] - typePriority[b.type];
        if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
        return sortA1(a.cell, b.cell);
      });

      setIssues(found);
      setAllFunctions(getAllFunctions(wb));
      setSheetInfo(sheets);

      const errorCount = found.filter(f => f.severity === "error").length;
      const warningCount = found.filter(f => f.severity === "warning").length;
      
      toast({
        title: "Análisis completado",
        description: found.length
          ? `${errorCount} error(es), ${warningCount} advertencia(s)`
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
      toast({ title: "Copiado", description: text.substring(0, 50) + (text.length > 50 ? "..." : "") });
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

      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Analizador de compatibilidad Excel - Syncfusion XlsIO</DialogTitle>
          <DialogDescription>
            Detecta errores, funciones no soportadas, riesgos de runtime y problemas de flujo de datos que pueden causar fallos en la API.
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
            <div className="flex items-center justify-between">
              {fileName ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="break-all">{fileName}</span>
                </div>
              ) : <div />}
            </div>
          </div>

          {hasScanned && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="issues" className="flex items-center gap-2">
                  Problemas
                  {issues.length > 0 && (
                    <Badge variant={severityCounts.get("error") ? "destructive" : "secondary"} className="text-xs">
                      {issues.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="functions" className="flex items-center gap-2">
                  Funciones
                  {functionAnalysis.unsupported.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {functionAnalysis.unsupported.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sheets">
                  Hojas ({sheetInfo.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="issues" className="mt-4">
                <div className="grid lg:grid-cols-4 gap-4">
                  {/* Summary sidebar */}
                  <div className="lg:col-span-1">
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="text-sm font-medium">Resumen</div>
                      
                      {isScanning ? (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Analizando...
                        </div>
                      ) : issues.length ? (
                        <div className="text-sm text-muted-foreground">
                          {issues.length} problema(s) en {sheetCounts.length} hoja(s)
                        </div>
                      ) : (
                        <div className="text-sm text-green-600">✓ No se encontraron problemas</div>
                      )}

                      {severityCounts.size > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground">Por severidad:</div>
                          {severityCounts.get("error") && (
                            <div className="flex justify-between text-xs">
                              <span className="text-destructive">● Errores</span>
                              <span>{severityCounts.get("error")}</span>
                            </div>
                          )}
                          {severityCounts.get("warning") && (
                            <div className="flex justify-between text-xs">
                              <span className="text-yellow-600">● Advertencias</span>
                              <span>{severityCounts.get("warning")}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {typeCounts.size > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground">Por tipo:</div>
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
                        <div className="space-y-1 pt-2 border-t">
                          <div className="text-xs font-medium text-muted-foreground">Por hoja:</div>
                          {sheetCounts.slice(0, 5).map(([sheet, count]) => (
                            <div key={sheet} className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[100px]" title={sheet}>{sheet}</span>
                              <span className="text-muted-foreground">{count}</span>
                            </div>
                          ))}
                          {sheetCounts.length > 5 && (
                            <div className="text-xs text-muted-foreground">+{sheetCounts.length - 5} más</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Issues table */}
                  <div className="lg:col-span-3">
                    <div className="rounded-md border">
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[90px]">Tipo</TableHead>
                              <TableHead className="w-[120px]">Hoja</TableHead>
                              <TableHead className="w-[60px]">Celda</TableHead>
                              <TableHead className="w-[200px]">Problema</TableHead>
                              <TableHead>Fórmula / Sugerencia</TableHead>
                              <TableHead className="w-[40px]"></TableHead>
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
                                  <TableCell className="font-mono text-xs truncate max-w-[120px]" title={i.sheet}>
                                    {i.sheet}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{i.cell}</TableCell>
                                  <TableCell className={`text-xs ${SEVERITY_COLORS[i.severity]}`}>
                                    {i.error}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {i.refChain && i.refChain.length > 1 ? (
                                      <Collapsible>
                                        <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                                          <Link2 className="h-3 w-3" />
                                          <span>Ver cadena ({i.refChain.length})</span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-1">
                                          <div className="text-xs break-all bg-muted p-2 rounded">
                                            {i.refChain.join(" → ")}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ) : (
                                      <div className="space-y-1">
                                        {i.formula && (
                                          <div className="font-mono text-xs text-muted-foreground truncate max-w-[300px]" title={`=${i.formula}`}>
                                            ={i.formula}
                                          </div>
                                        )}
                                        {i.suggestion && (
                                          <div className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-1">
                                            <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                            <span>{i.suggestion}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => copyText(`${i.sheet}!${i.cell}${i.formula ? `\n=${i.formula}` : ""}`)}
                                      title="Copiar"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="text-sm text-center text-muted-foreground py-8">
                                  {hasScanned ? "✓ No se encontraron problemas" : "Sube un archivo para analizar"}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="functions" className="mt-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Unsupported functions */}
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="destructive">No soportadas</Badge>
                      <span className="text-xs text-muted-foreground">({functionAnalysis.unsupported.length})</span>
                    </div>
                    <ScrollArea className="h-[250px]">
                      {functionAnalysis.unsupported.length > 0 ? (
                        <div className="space-y-1">
                          {functionAnalysis.unsupported.map(([func, count]) => (
                            <div key={func} className="flex justify-between text-sm">
                              <span className="font-mono text-destructive">{func}</span>
                              <span className="text-muted-foreground">×{count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-green-600">✓ Ninguna función no soportada</div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Risky functions */}
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary">Con riesgo</Badge>
                      <span className="text-xs text-muted-foreground">({functionAnalysis.risky.length})</span>
                    </div>
                    <ScrollArea className="h-[250px]">
                      {functionAnalysis.risky.length > 0 ? (
                        <div className="space-y-1">
                          {functionAnalysis.risky.map(([func, count]) => (
                            <div key={func} className="flex justify-between text-sm">
                              <span className="font-mono text-yellow-600">{func}</span>
                              <span className="text-muted-foreground">×{count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Ninguna función con riesgo conocido</div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Supported functions */}
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">Soportadas</Badge>
                      <span className="text-xs text-muted-foreground">({functionAnalysis.supported.length})</span>
                    </div>
                    <ScrollArea className="h-[250px]">
                      {functionAnalysis.supported.length > 0 ? (
                        <div className="space-y-1">
                          {functionAnalysis.supported.slice(0, 30).map(([func, count]) => (
                            <div key={func} className="flex justify-between text-sm">
                              <span className="font-mono text-green-600">{func}</span>
                              <span className="text-muted-foreground">×{count}</span>
                            </div>
                          ))}
                          {functionAnalysis.supported.length > 30 && (
                            <div className="text-xs text-muted-foreground pt-2">
                              +{functionAnalysis.supported.length - 30} funciones más
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No se detectaron funciones</div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sheets" className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre de hoja</TableHead>
                        <TableHead className="text-right">Celdas</TableHead>
                        <TableHead className="text-right">Fórmulas</TableHead>
                        <TableHead className="text-right">Problemas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheetInfo.map((sheet) => {
                        const issueCount = sheetCounts.find(([name]) => name === sheet.name)?.[1] || 0;
                        return (
                          <TableRow key={sheet.name}>
                            <TableCell className="font-mono">{sheet.name}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{sheet.cells.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{sheet.formulas.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              {issueCount > 0 ? (
                                <Badge variant="destructive">{issueCount}</Badge>
                              ) : (
                                <span className="text-green-600">✓</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {!hasScanned && !isScanning && (
            <div className="text-center py-8 text-muted-foreground">
              Sube un archivo Excel para analizar su compatibilidad con Syncfusion XlsIO
            </div>
          )}

          {isScanning && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Analizando archivo...</span>
            </div>
          )}
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
