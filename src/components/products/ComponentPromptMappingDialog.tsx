import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Link, Link2Off, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { resolveLivePromptCellLabels } from "@/lib/easyquoteExcelPromptLabels";
import type { CompositeComponent, PromptConnection, OutputAggregation } from "@/hooks/useCompositeProductConfig";
import { OutputAggregationSection } from "./OutputAggregationSection";

interface ComponentPromptMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: CompositeComponent;
  /** Prompts generales del producto padre (de composite_product_prompts o del Excel del padre) */
  parentPrompts: { name: string; label: string }[];
  /** Conexiones existentes */
  connections: PromptConnection[];
  /** Agregaciones de outputs existentes */
  outputAggregations: OutputAggregation[];
  organizationId: string;
  compositeProductId: string;
  onSave: (connections: Omit<PromptConnection, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  onSaveAggregations: (aggregations: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  isSaving?: boolean;
  isSavingAggregations?: boolean;
}

interface ComponentPromptDef {
  id: string;
  name: string;
  label: string;
  promptCell?: string;
  sequence?: number;
}

const USER_EDITABLE = "__user_editable__";

export function ComponentPromptMappingDialog({
  open,
  onOpenChange,
  component,
  parentPrompts,
  connections,
  outputAggregations,
  organizationId,
  compositeProductId,
  onSave,
  onSaveAggregations,
  isSaving,
  isSavingAggregations,
}: ComponentPromptMappingDialogProps) {
  const queryClient = useQueryClient();

  const getLocalCacheKey = (productId: string) => `easyquote:component-prompts:${productId}`;

  const loadLocalCachedPrompts = (productId: string): ComponentPromptDef[] => {
    try {
      const raw = localStorage.getItem(getLocalCacheKey(productId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((p) => p && typeof p === "object" && typeof p.id === "string" && typeof p.label === "string")
        .map((p) => ({
          id: String(p.id),
          name: String(p.name ?? p.id),
          label: String(p.label),
          promptCell: p.promptCell ? String(p.promptCell) : undefined,
          sequence: typeof p.sequence === "number" ? p.sequence : undefined,
        }));
    } catch {
      return [];
    }
  };

  const saveLocalCachedPrompts = (productId: string, prompts: ComponentPromptDef[]) => {
    try {
      localStorage.setItem(getLocalCacheKey(productId), JSON.stringify(prompts));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  };

  // Aviso cuando no podemos resolver nombres desde el Excel (o falta asociación producto→excel)
  const [labelResolutionWarning, setLabelResolutionWarning] = useState<string | null>(null);

  // Cargar los prompts del componente desde la definición (prompts/list) + resolución desde el Excel vivo
  const { data: componentPrompts = [], isLoading, isFetching } = useQuery({
    queryKey: ["component-prompts", component.component_product_id],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      setLabelResolutionWarning(null);

      // Si no hay token, al menos mostramos lo último cacheado localmente.
      if (!token) {
        return component.component_product_id
          ? loadLocalCachedPrompts(component.component_product_id)
          : [];
      }

      // Fuente base: prompts/list (definición)
      const defsRes = await invokeEasyQuoteFunction<any>("easyquote-prompts", {
        token,
        productId: component.component_product_id,
      });

      if (defsRes.error) {
        console.warn("[ComponentPromptMappingDialog] error leyendo prompts definiciones:", defsRes.error);
        setLabelResolutionWarning("No se pudo leer la definición de prompts desde EasyQuote. Se muestran los últimos datos disponibles.");
        return component.component_product_id
          ? loadLocalCachedPrompts(component.component_product_id)
          : [];
      }

      const promptDefs = Array.isArray(defsRes.data) ? defsRes.data : [];
      if (promptDefs.length === 0) {
        return [];
      }

      // Función helper para extraer el mejor label disponible
      const extractLabel = (p: any): string => {
        // Algunos entornos devuelven promptText; otros solo promptCell.
        return p.promptText || p.label || p.name || p.description || p.promptCell || String(p.id);
      };

      const merged = new Map<string, ComponentPromptDef>();

      // Base: `prompts` (definición Excel) - siempre añadimos los que faltan
      for (const d of promptDefs) {
        const id = String(d.id);
        const defLabel = extractLabel(d);

        merged.set(id, {
          id,
          name: id,
          label: defLabel,
          promptCell: d.promptCell ? String(d.promptCell) : undefined,
          sequence:
            typeof d.promptSeq === "number"
              ? d.promptSeq
              : typeof d.promptSequence === "number"
                ? d.promptSequence
                : undefined,
        });
      }

      let result = Array.from(merged.values());
      result.sort((a, b) => {
        const sa = a.sequence ?? Number.POSITIVE_INFINITY;
        const sb = b.sequence ?? Number.POSITIVE_INFINITY;
        if (sa !== sb) return sa - sb;
        return a.label.localeCompare(b.label);
      });

      // 2ª capa (clave): resolver labels desde el Excel REAL (vivo)
      // Esto hace que los nombres sigan al Excel incluso si EasyQuote aún no “etiqueta” los prompts.
      try {
        const cells = result.map((p) => p.promptCell).filter(Boolean) as string[];
        const labelMap = await resolveLivePromptCellLabels({
          token,
          productId: component.component_product_id,
          promptCells: cells,
        });

        if (labelMap && Object.keys(labelMap).length > 0) {
          result = result.map((p) => {
            const excelLabel = p.promptCell ? labelMap[p.promptCell] : undefined;
            if (!excelLabel) return p;
            // Solo sustituimos si el label del excel parece “humano”
            if (/^[A-Z]+\d+$/i.test(excelLabel)) return p;
            if (String(excelLabel).trim().length < 2) return p;
            return { ...p, label: String(excelLabel).trim() };
          });
        } else {
          // No error: simplemente no pudimos encontrar el Excel / relación producto→excel.
          const stillCellOnly = result.some((p) => p.label && /^[A-Z]+\d+$/i.test(p.label));
          if (stillCellOnly) {
            setLabelResolutionWarning(
               "Este componente sigue mostrando celdas (B10, B11…). Se pudo descargar el Excel, pero no se encontraron etiquetas cerca de esas celdas (normalmente están a la izquierda o encima). Revisa el Excel y su estructura.",
            );
          }
        }
      } catch (e) {
        console.warn("[ComponentPromptMappingDialog] Excel label resolution failed", e);
        setLabelResolutionWarning(
          "No se pudieron resolver los nombres desde el Excel. Se muestran los nombres devueltos por la API (pueden ser celdas).",
        );
      }

      // Guardar cache local (para offline / errores puntuales)
      if (component.component_product_id) {
        saveLocalCachedPrompts(component.component_product_id, result);
      }

      return result;
    },
    enabled: open && !!component.component_product_id,
    staleTime: 30 * 1000,
    retry: 2, // Reintentar 2 veces si falla
  });

  const handleRefreshPrompts = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["component-prompts", component.component_product_id],
    });
    toast.success("Recarga solicitada");
  };

  // Estado local para los mapeos: targetPromptName -> sourcePromptName (o USER_EDITABLE)
  const [mappings, setMappings] = useState<Record<string, string>>({});

  // Inicializar mappings desde las conexiones existentes
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    // Por defecto, todos editables por el usuario
    componentPrompts.forEach((cp) => {
      initial[cp.name] = USER_EDITABLE;
    });
    // Sobreescribir con las conexiones existentes
    connections
      .filter((c) => c.target_component_id === component.component_product_id)
      .forEach((c) => {
        initial[c.target_prompt_name] = c.source_prompt_name;
      });
    setMappings(initial);
  }, [open, componentPrompts, connections, component.component_product_id]);

  const handleMappingChange = (targetPromptName: string, sourcePromptName: string) => {
    setMappings((prev) => ({ ...prev, [targetPromptName]: sourcePromptName }));
  };

  const handleSave = async () => {
    // Construir las conexiones que NO son USER_EDITABLE
    const newConnections: Omit<PromptConnection, "id" | "created_at" | "updated_at">[] = [];
    for (const [targetPromptName, sourcePromptName] of Object.entries(mappings)) {
      if (sourcePromptName && sourcePromptName !== USER_EDITABLE) {
        newConnections.push({
          organization_id: organizationId,
          composite_product_id: compositeProductId,
          source_prompt_name: sourcePromptName,
          target_component_id: component.component_product_id,
          target_prompt_name: targetPromptName,
          transform_formula: null,
        });
      }
    }
    try {
      await onSave(newConnections);
      toast.success("Configuración guardada");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving connections:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  // Contar cuántos están mapeados vs editables
  const stats = useMemo(() => {
    const mapped = Object.values(mappings).filter((v) => v && v !== USER_EDITABLE).length;
    const total = Object.keys(mappings).length;
    return { mapped, editable: total - mapped, total };
  }, [mappings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar datos de entrada: {component.component_alias}</DialogTitle>
          <DialogDescription>
            Define qué datos del componente vienen del producto padre y cuáles serán editables por el usuario.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : componentPrompts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No se encontraron datos de entrada para este componente</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={handleRefreshPrompts}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Recargar desde API
            </Button>
          </div>
        ) : (
          <>
            {labelResolutionWarning && (
              <div className="mb-3 p-2 bg-warning/10 border border-warning/30 rounded-md text-xs text-warning-foreground">
                ⚠️ {labelResolutionWarning}
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Link className="h-3.5 w-3.5 text-primary" />
                  {stats.mapped} heredados del padre
                </span>
                <span className="flex items-center gap-1">
                  <Link2Off className="h-3.5 w-3.5" />
                  {stats.editable} editables por usuario
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleRefreshPrompts}
                disabled={isFetching}
                title="Recargar datos de entrada desde la API (útil si actualizaste el Excel)"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-3">
                {componentPrompts.map((cp) => {
                  const currentMapping = mappings[cp.name] || USER_EDITABLE;
                  const isMapped = currentMapping !== USER_EDITABLE;
                  return (
                    <div
                      key={cp.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isMapped ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{cp.label}</p>
                        {cp.promptCell && cp.promptCell !== cp.label && (
                          <p className="text-xs text-muted-foreground truncate">
                            Celda: {cp.promptCell}
                          </p>
                        )}
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                      <div className="w-56">
                        <Select
                          value={currentMapping}
                          onValueChange={(v) => handleMappingChange(cp.name, v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue>
                              {currentMapping === USER_EDITABLE ? (
                                <span className="flex items-center gap-2">
                                  <Link2Off className="h-3.5 w-3.5" />
                                  Editable por usuario
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <Link className="h-3.5 w-3.5 text-primary" />
                                  {parentPrompts.find(pp => pp.name === currentMapping)?.label || currentMapping}
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={USER_EDITABLE}>
                              <span className="flex items-center gap-2">
                                <Link2Off className="h-3.5 w-3.5" />
                                Editable por usuario
                              </span>
                            </SelectItem>
                            {parentPrompts.map((pp) => (
                              <SelectItem key={pp.name} value={pp.name}>
                                <span className="flex items-center gap-2">
                                  <Link className="h-3.5 w-3.5 text-primary" />
                                  {pp.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sección de agregación de outputs - dentro del scroll */}
              <Separator className="my-4" />
              <div className="pb-2">
                <h4 className="text-sm font-medium mb-3">Agregación de datos de salida</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecciona outputs de este componente para sumarlos en el producto padre
                </p>
                <OutputAggregationSection
                  componentProductId={component.component_product_id}
                  organizationId={organizationId}
                  compositeProductId={compositeProductId}
                  existingAggregations={outputAggregations}
                  onSave={onSaveAggregations}
                  isSaving={isSavingAggregations}
                />
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar datos de entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
