import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, XCircle, Search, Copy, Loader2 } from "lucide-react";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Product = {
  id: string;
  name: string;
  isActive?: boolean;
};

type ValidationIssue = {
  promptId: string;
  promptLabel: string;
  value: any;
  issue: string;
  severity: "error" | "warning" | "info";
  suggestion?: string;
};

type PromptData = {
  id: string;
  promptText?: string;
  promptCell?: string;
  promptType?: string;
  currentValue?: any;
  valueOptions?: any[];
  [key: string]: any;
};

// Validation rules for prompt values
function validatePromptValue(prompt: PromptData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const id = prompt.id;
  const label = prompt.promptText || prompt.promptCell || id;
  const value = prompt.currentValue;
  const type = prompt.promptType?.toLowerCase() || "";
  const options = prompt.valueOptions || [];

  // 1. Check for null/undefined values
  if (value === null || value === undefined) {
    issues.push({
      promptId: id,
      promptLabel: label,
      value,
      issue: "Valor nulo o indefinido",
      severity: "warning",
      suggestion: "Configurar un valor por defecto en el Excel"
    });
    return issues;
  }

  // 2. Check string values
  if (typeof value === "string") {
    const trimmed = value.trim();
    
    // Empty string
    if (trimmed === "") {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: "(vacío)",
        issue: "Cadena vacía",
        severity: "warning",
        suggestion: "Asignar un valor por defecto"
      });
    }
    
    // Starts with formula character
    if (/^[=+\-@]/.test(trimmed)) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: trimmed.substring(0, 50),
        issue: "Empieza con carácter de fórmula",
        severity: "error",
        suggestion: "Evitar que valores de texto empiecen con = + - @"
      });
    }
    
    // Contains control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: trimmed.substring(0, 30),
        issue: "Contiene caracteres de control",
        severity: "error",
        suggestion: "Limpiar caracteres invisibles del valor"
      });
    }
    
    // Very long string
    if (trimmed.length > 500) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: `${trimmed.length} caracteres`,
        issue: "Cadena muy larga",
        severity: "warning",
        suggestion: "Reducir longitud a menos de 500 caracteres"
      });
    }
    
    // Contains pipe or backslash
    if (/[|\\]/.test(trimmed)) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: trimmed.substring(0, 30),
        issue: "Contiene | o \\ (pueden causar problemas)",
        severity: "warning",
        suggestion: "Reemplazar por otros caracteres"
      });
    }

    // Contains newlines
    if (/[\r\n]/.test(value)) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: trimmed.substring(0, 30) + "...",
        issue: "Contiene saltos de línea",
        severity: "warning",
        suggestion: "Usar texto de una sola línea"
      });
    }
    
    // Check if value is in options (for select types)
    if (options.length > 0) {
      const optionValues = options.map(o => String(o.value ?? o.id ?? o.name ?? o).toLowerCase());
      if (!optionValues.includes(trimmed.toLowerCase())) {
        issues.push({
          promptId: id,
          promptLabel: label,
          value: trimmed,
          issue: "Valor no está en las opciones disponibles",
          severity: "warning",
          suggestion: "Verificar que el valor coincida con una opción válida"
        });
      }
    }
  }

  // 3. Check numeric values
  if (typeof value === "number") {
    if (!isFinite(value)) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: String(value),
        issue: "Número inválido (NaN o Infinity)",
        severity: "error",
        suggestion: "Usar un número válido"
      });
    }
    
    if (Math.abs(value) > 1e15) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: String(value),
        issue: "Número extremadamente grande",
        severity: "error",
        suggestion: "Reducir a un valor razonable"
      });
    }
    
    // For quantity/integer types, check if it's a whole number
    if ((type.includes("integer") || type.includes("quantity")) && !Number.isInteger(value)) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: String(value),
        issue: "Se espera un número entero pero tiene decimales",
        severity: "warning",
        suggestion: "Usar un número entero"
      });
    }

    // Negative numbers for quantity
    if (type.includes("quantity") && value < 0) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: String(value),
        issue: "Cantidad negativa",
        severity: "error",
        suggestion: "Las cantidades deben ser positivas"
      });
    }
  }

  // 4. Check for options configuration issues
  if (options.length > 0) {
    // Check for duplicate option values
    const valueSet = new Set<string>();
    const duplicates: string[] = [];
    for (const opt of options) {
      const optValue = String(opt.value ?? opt.id ?? opt.name ?? opt);
      if (valueSet.has(optValue)) {
        duplicates.push(optValue);
      }
      valueSet.add(optValue);
    }
    if (duplicates.length > 0) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: duplicates.join(", "),
        issue: "Opciones con valores duplicados",
        severity: "warning",
        suggestion: "Cada opción debe tener un valor único"
      });
    }
    
    // Check for empty option values
    const hasEmptyOption = options.some(opt => {
      const v = opt.value ?? opt.id ?? opt.name ?? opt;
      return v === "" || v === null || v === undefined;
    });
    if (hasEmptyOption) {
      issues.push({
        promptId: id,
        promptLabel: label,
        value: "(opción vacía)",
        issue: "Una opción tiene valor vacío",
        severity: "warning",
        suggestion: "Todas las opciones deben tener valor"
      });
    }
  }

  return issues;
}

export function PromptDataValidator() {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [productName, setProductName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch products when dialog opens
  useEffect(() => {
    if (open && products.length === 0) {
      fetchProducts();
    }
  }, [open]);

  const getProductLabel = (p: any) =>
    p?.name ??
    p?.title ??
    p?.displayName ??
    p?.productName ??
    p?.product_name ??
    p?.nombre ??
    p?.Nombre ??
    p?.description ??
    "";

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const token = await getEasyQuoteToken();
      if (!token) return;
      
      const { data, error } = await invokeEasyQuoteFunction<any[]>("easyquote-products", { token });
      if (error || !data) return;
      
      const activeProducts = data
        .filter((p: any) => p?.isActive === true)
        .map((p: any) => ({
          id: p.id,
          name: getProductLabel(p) || p.id,
          isActive: p.isActive,
        }))
        .sort((a: Product, b: Product) => a.name.localeCompare(b.name));
      
      setProducts(activeProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const analyzeProduct = async () => {
    if (!productId) {
      toast({ title: "Selecciona un producto", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setPrompts([]);
    setIssues([]);
    setProductName("");

    try {
      const token = await getEasyQuoteToken();
      if (!token) {
        toast({ title: "No se pudo obtener token de EasyQuote", variant: "destructive" });
        return;
      }

      // Fetch product pricing to get current prompt values
      const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
        body: { token, productId: productId.trim(), inputs: [] }
      });

      if (error) {
        toast({ title: "Error al obtener datos del producto", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.isApiError) {
        toast({ title: "Error de API", description: data.error, variant: "destructive" });
        return;
      }

      const promptsData = data?.prompts || data?.inputs || [];
      setPrompts(promptsData);
      const selectedProduct = products.find((p) => p.id === productId);
      setProductName(data?.productName || selectedProduct?.name || productId);

      // Validate all prompts
      const allIssues: ValidationIssue[] = [];
      for (const prompt of promptsData) {
        const promptIssues = validatePromptValue(prompt);
        allIssues.push(...promptIssues);
      }

      setIssues(allIssues);

      const errorCount = allIssues.filter(i => i.severity === "error").length;
      const warningCount = allIssues.filter(i => i.severity === "warning").length;

      toast({
        title: "Análisis completado",
        description: allIssues.length 
          ? `${errorCount} error(es), ${warningCount} advertencia(s)`
          : "No se encontraron problemas"
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Error inesperado", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyPromptData = async () => {
    const text = JSON.stringify(prompts, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado al portapapeles" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Validar Datos de Entrada</span>
          <span className="sm:hidden">Datos</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Validador de datos de entrada</DialogTitle>
          <DialogDescription>
            Analiza los valores actuales de los datos de entrada de un producto para detectar valores que pueden causar errores en la API.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Product selector */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Seleccionar producto</Label>
              <Select value={productId} onValueChange={setProductId} disabled={loadingProducts}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProducts ? "Cargando productos..." : "Selecciona un producto"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={analyzeProduct} disabled={isLoading || !productId}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : "Analizar"}
            </Button>
          </div>

          {/* Summary */}
          {prompts.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-bold">{prompts.length}</div>
                <div className="text-xs text-muted-foreground">Campos</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className={`text-2xl font-bold ${errorCount > 0 ? "text-destructive" : "text-green-600"}`}>
                  {errorCount}
                </div>
                <div className="text-xs text-muted-foreground">Errores</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className={`text-2xl font-bold ${warningCount > 0 ? "text-yellow-600" : "text-green-600"}`}>
                  {warningCount}
                </div>
                <div className="text-xs text-muted-foreground">Advertencias</div>
              </div>
            </div>
          )}

          {/* Issues table */}
          {issues.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Problemas detectados:</div>
              <div className="rounded-md border">
                <ScrollArea className="h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Tipo</TableHead>
                        <TableHead className="w-[180px]">Campo</TableHead>
                        <TableHead className="w-[120px]">Valor</TableHead>
                        <TableHead>Problema</TableHead>
                        <TableHead>Sugerencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.map((issue, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {issue.severity === "error" ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : issue.severity === "warning" ? (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warn</Badge>
                            ) : (
                              <Badge variant="outline">Info</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[180px]" title={issue.promptLabel}>
                            {issue.promptLabel}
                          </TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[120px]" title={String(issue.value)}>
                            {String(issue.value)}
                          </TableCell>
                          <TableCell className="text-xs">{issue.issue}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{issue.suggestion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Prompts table */}
          {prompts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Todos los campos ({productName}):</div>
                <Button variant="ghost" size="sm" onClick={copyPromptData}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar JSON
                </Button>
              </div>
              <div className="rounded-md border">
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Celda</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor actual</TableHead>
                        <TableHead>Opciones</TableHead>
                        <TableHead className="w-[60px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prompts.map((p, idx) => {
                        const hasIssue = issues.some(i => i.promptId === p.id);
                        const hasError = issues.some(i => i.promptId === p.id && i.severity === "error");
                        return (
                          <TableRow key={p.id || idx}>
                            <TableCell className="text-xs font-mono">{p.promptText || "-"}</TableCell>
                            <TableCell className="text-xs font-mono">{p.promptCell || "-"}</TableCell>
                            <TableCell className="text-xs">{p.promptType || "-"}</TableCell>
                            <TableCell className="text-xs font-mono truncate max-w-[150px]" title={String(p.currentValue)}>
                              {p.currentValue === null ? "(null)" : p.currentValue === undefined ? "(undefined)" : String(p.currentValue)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {(p.valueOptions?.length || 0) > 0 ? `${p.valueOptions?.length} opciones` : "-"}
                            </TableCell>
                            <TableCell>
                              {hasError ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : hasIssue ? (
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          {prompts.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Introduce un ID de producto y pulsa "Analizar" para ver los datos de entrada
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
