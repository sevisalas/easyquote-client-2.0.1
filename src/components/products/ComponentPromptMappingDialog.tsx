import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Link, Link2Off, ArrowRight } from "lucide-react";
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
import { toast } from "sonner";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import type { CompositeComponent, PromptConnection } from "@/hooks/useCompositeProductConfig";

interface ComponentPromptMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: CompositeComponent;
  /** Prompts generales del producto padre (de composite_product_prompts o del Excel del padre) */
  parentPrompts: { name: string; label: string }[];
  /** Conexiones existentes */
  connections: PromptConnection[];
  organizationId: string;
  compositeProductId: string;
  onSave: (connections: Omit<PromptConnection, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  isSaving?: boolean;
}

interface ComponentPromptDef {
  id: string;
  name: string;
  label: string;
  promptCell?: string;
}

const USER_EDITABLE = "__user_editable__";

export function ComponentPromptMappingDialog({
  open,
  onOpenChange,
  component,
  parentPrompts,
  connections,
  organizationId,
  compositeProductId,
  onSave,
  isSaving,
}: ComponentPromptMappingDialogProps) {
  // Cargar los prompts del componente desde la API de pricing (que devuelve labels reales)
  const { data: componentPrompts = [], isLoading } = useQuery({
    queryKey: ["component-prompts-pricing", component.component_product_id],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      // Usamos easyquote-pricing GET para obtener los prompts con labels reales
      const { data, error } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: component.component_product_id,
        method: "GET",
      });
      if (error) {
        console.error("Error fetching component prompts:", error);
        return [];
      }
      // Los prompts vienen en data.prompts con su label/texto real
      const prompts = data?.prompts || [];
      return prompts.map((p: any) => ({
        id: p.id,
        name: p.id, // Usamos el ID para las conexiones (consistente con el padre)
        label: p.promptText || p.promptCell || p.id,
        promptCell: p.promptCell,
      })) as ComponentPromptDef[];
    },
    enabled: open && !!component.component_product_id,
    staleTime: 5 * 60 * 1000,
  });

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
            No se encontraron datos de entrada para este componente
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Link className="h-3.5 w-3.5 text-primary" />
                {stats.mapped} heredados del padre
              </span>
              <span className="flex items-center gap-1">
                <Link2Off className="h-3.5 w-3.5" />
                {stats.editable} editables por usuario
              </span>
            </div>

            <ScrollArea className="max-h-[400px] pr-4">
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
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
