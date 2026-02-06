import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Link, Link2Off, ArrowRight, RefreshCw, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
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
  apiUserId: string;
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
  customLabel?: string; // Label personalizado por el usuario
  promptCell?: string;
  sequence?: number;
}

const USER_EDITABLE = "__user_editable__";

// Hook para gestionar labels personalizados por producto
const useCustomLabels = (productId: string) => {
  const getStorageKey = () => `easyquote:custom-labels:${productId}`;
  
  const loadCustomLabels = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };
  
  const saveCustomLabel = (promptId: string, label: string) => {
    try {
      const existing = loadCustomLabels();
      existing[promptId] = label;
      localStorage.setItem(getStorageKey(), JSON.stringify(existing));
    } catch {
      // ignore storage failures
    }
  };
  
  return { loadCustomLabels, saveCustomLabel };
};

export function ComponentPromptMappingDialog({
  open,
  onOpenChange,
  component,
  parentPrompts,
  connections,
  outputAggregations,
  organizationId,
  apiUserId,
  compositeProductId,
  onSave,
  onSaveAggregations,
  isSaving,
  isSavingAggregations,
}: ComponentPromptMappingDialogProps) {
  const queryClient = useQueryClient();
  const { loadCustomLabels, saveCustomLabel } = useCustomLabels(component.component_product_id);
  
  // Estado para edición de labels
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");

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
          customLabel: p.customLabel ? String(p.customLabel) : undefined,
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

  // Cargar etiquetas personalizadas desde product_prompt_settings
  // IMPORTANTE: Ahora usamos api_user_id directamente (configuración compartida por grupo)
  const { data: dbCustomLabels = {} } = useQuery({
    queryKey: ["component-db-labels", component.component_product_id, apiUserId],
    queryFn: async () => {
      if (!apiUserId || !component.component_product_id) return {};
      
      const { data, error } = await supabase
        .from("product_prompt_settings")
        .select("prompt_name, label")
        .eq("api_user_id", apiUserId)
        .eq("easyquote_product_id", component.component_product_id);
      
      if (error) {
        console.warn("[ComponentPromptMappingDialog] Error loading DB labels:", error);
        return {};
      }
      
      const labelMap: Record<string, string> = {};
      for (const row of data || []) {
        if (row.label) {
          const key = String(row.prompt_name ?? "").replace(/\$/g, "").trim().toUpperCase();
          if (key) labelMap[key] = row.label;
        }
      }
      return labelMap;
    },
    enabled: open && !!component.component_product_id && !!apiUserId,
    staleTime: 60 * 1000,
  });

  // Regex para detectar referencias de celda Excel (ej: "$B$10", "B10", "$B10$")
  const isCellReference = (str: string): boolean => {
    if (!str) return false;
    const cleaned = str.replace(/\$/g, "").trim();
    // Patrón: letra(s) + número(s), ej: B10, AA5, C123
    return /^[A-Z]{1,3}\d+$/i.test(cleaned);
  };

  // Cargar los prompts del componente desde easyquote-prompts (definiciones completas, incluyendo campos condicionales)
  const { data: componentPrompts = [], isLoading, isFetching } = useQuery({
    queryKey: ["component-prompts", component.component_product_id, dbCustomLabels],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      setLabelResolutionWarning(null);

      // Si no hay token, al menos mostramos lo último cacheado localmente.
      if (!token) {
        return component.component_product_id
          ? loadLocalCachedPrompts(component.component_product_id)
          : [];
      }

      // Obtener TODAS las definiciones de prompts (incluyendo campos condicionales como Ancho/Alto)
      const defsRes = await invokeEasyQuoteFunction<any>("easyquote-prompts", {
        token,
        productId: component.component_product_id,
      });
      
      const defs = Array.isArray(defsRes.data) ? defsRes.data : [];
      
      if (defs.length === 0) {
        setLabelResolutionWarning("No se encontraron campos de entrada en la definición del producto.");
        return loadLocalCachedPrompts(component.component_product_id);
      }

      // También obtener pricing para enriquecer con promptText actualizado
      const pricingRes = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: component.component_product_id,
      });
      
      const promptsFromPricing = Array.isArray(pricingRes.data?.prompts) ? pricingRes.data.prompts : [];
      
      // Crear mapa de id -> promptText del pricing (más descriptivo)
      const pricingLabels = new Map<string, string>();
      for (const p of promptsFromPricing) {
        if (p.id && p.promptText) {
          pricingLabels.set(String(p.id), String(p.promptText));
        }
      }

      // Cargar labels personalizados de localStorage (fallback)
      const localCustomLabels = loadCustomLabels();

      // Usar las definiciones completas para incluir TODOS los campos
      const result: ComponentPromptDef[] = defs.map((d: any) => {
        const id = String(d.id);
        const promptCell = d.promptCell ? String(d.promptCell).replace(/\$/g, "").trim().toUpperCase() : undefined;
        
        // Prioridad de etiquetas:
        // 1. Etiqueta personalizada en BD (por celda)
        // 2. Etiqueta personalizada en localStorage
        // 3. promptText del pricing API (más descriptivo)
        // 4. promptText de la definición
        // 5. ID del prompt (último recurso)
        const dbLabel = promptCell ? dbCustomLabels[promptCell] : undefined;
        const localLabel = localCustomLabels[id];
        const pricingLabel = pricingLabels.get(id);
        const defLabel = d.promptText || d.label || d.name;
        
        // Elegir la mejor etiqueta disponible, evitando referencias de celda
        let label = dbLabel || localLabel || pricingLabel || defLabel || id;
        
        // Si la etiqueta parece ser una referencia de celda, usar el ID
        if (isCellReference(label)) {
          label = id;
        }

        return {
          id,
          name: id,
          label,
          customLabel: dbLabel || localLabel || undefined,
          // Solo guardar promptCell si existe y es diferente a la etiqueta mostrada
          promptCell: d.promptCell ? String(d.promptCell) : undefined,
          sequence: typeof d.promptSequence === "number" ? d.promptSequence : undefined,
        };
      });

      result.sort((a, b) => {
        const sa = a.sequence ?? Number.POSITIVE_INFINITY;
        const sb = b.sequence ?? Number.POSITIVE_INFINITY;
        if (sa !== sb) return sa - sb;
        return a.label.localeCompare(b.label);
      });

      // Guardar cache local (para offline / errores puntuales)
      if (component.component_product_id) {
        saveLocalCachedPrompts(component.component_product_id, result);
      }

      return result;
    },
    enabled: open && !!component.component_product_id,
    staleTime: 30 * 1000,
    retry: 2,
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
                  const displayLabel = cp.customLabel || cp.label;
                  const isEditing = editingLabelId === cp.id;
                  
                  return (
                    <div
                      key={cp.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isMapped ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingLabelValue}
                              onChange={(e) => setEditingLabelValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveCustomLabel(cp.id, editingLabelValue);
                                  queryClient.invalidateQueries({
                                    queryKey: ["component-prompts", component.component_product_id],
                                  });
                                  setEditingLabelId(null);
                                } else if (e.key === "Escape") {
                                  setEditingLabelId(null);
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                saveCustomLabel(cp.id, editingLabelValue);
                                queryClient.invalidateQueries({
                                  queryKey: ["component-prompts", component.component_product_id],
                                });
                                setEditingLabelId(null);
                              }}
                            >
                              <Check className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingLabelId(null)}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <p className="font-medium text-sm truncate">{displayLabel}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setEditingLabelId(cp.id);
                                setEditingLabelValue(displayLabel);
                              }}
                              title="Editar nombre del campo"
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                        {cp.customLabel && !isEditing && (
                          <p className="text-xs text-muted-foreground truncate">
                            Original: {cp.label}
                          </p>
                        )}
                        {/* Solo mostrar celda si es descriptiva y diferente del label */}
                        {cp.promptCell && !isCellReference(cp.promptCell) && cp.promptCell !== cp.label && !isEditing && (
                          <p className="text-xs text-muted-foreground truncate">
                            Ref: {cp.promptCell}
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
                                  {(parentPrompts.find((pp) => pp.name === currentMapping)?.label || "").trim() || currentMapping}
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
                            {parentPrompts.map((pp) => {
                              const display = (pp.label || "").trim() || pp.name;
                              return (
                                <SelectItem key={pp.name} value={pp.name}>
                                  <span className="flex items-center gap-2">
                                    <Link className="h-3.5 w-3.5 text-primary" />
                                    {display}
                                  </span>
                                </SelectItem>
                              );
                            })}
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
