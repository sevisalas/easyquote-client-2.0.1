import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { supabase } from "@/integrations/supabase/client";

// Tipo local para evitar acoplar este componente a exportaciones del hook.
interface OutputAggregation {
  id: string;
  organization_id: string;
  composite_product_id: string;
  source_output_name: string;
  target_output_name: string;
  target_output_label: string;
  aggregation_type: string;
  created_at: string;
  updated_at: string;
}

interface OutputAggregationSectionProps {
  componentProductId: string;
  organizationId: string;
  compositeProductId: string;
  existingAggregations: OutputAggregation[];
  onSave: (aggregations: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  isSaving?: boolean;
}

interface OutputDef {
  name: string;
  label: string;
  type: string;
}

function filterOutPriceAndImages(o: OutputDef): boolean {
  const type = String(o.type || "").toLowerCase();
  const name = String(o.name || "").toLowerCase();
  const isPrice = type === "price" || name === "price" || name === "precio";
  const isImage = type === "image" || name === "image" || name === "imagen";
  return !isPrice && !isImage;
}

/**
 * Sección para configurar qué outputs del componente se agregan (suman) 
 * a outputs del producto padre compuesto.
 */
export function OutputAggregationSection({
  componentProductId,
  organizationId,
  compositeProductId,
  existingAggregations,
  onSave,
  isSaving,
}: OutputAggregationSectionProps) {
  /**
   * Extrae lista de outputs de la respuesta de EasyQuote (múltiples formatos posibles).
   */
  const extractOutputList = (raw: any): any[] => {
    if (!raw || typeof raw !== "object") return [];
    
    // Caso 1: raw ya es un array
    if (Array.isArray(raw)) return raw;
    
    // Caso 2: la respuesta es un objeto con campos conocidos
    // EasyQuote pricing devuelve { prompts: [...], outputValues: [...], price: ... }
    if (Array.isArray(raw.outputValues)) return raw.outputValues;
    if (Array.isArray(raw.outputs)) return raw.outputs;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.results)) return raw.results;
    
    // Caso 3: raw.data contiene los campos
    if (raw.data && typeof raw.data === "object") {
      if (Array.isArray(raw.data.outputValues)) return raw.data.outputValues;
      if (Array.isArray(raw.data.outputs)) return raw.data.outputs;
      if (Array.isArray(raw.data)) return raw.data;
    }
    
    console.warn("[OutputAggregationSection] Unknown response structure:", Object.keys(raw));
    return [];
  };

  const normalizeOutputs = (raw: any): OutputDef[] => {
    const list = extractOutputList(raw);
    
    console.log("[OutputAggregationSection] normalizeOutputs: extracted list count =", list.length);
    if (list.length > 0) {
      console.log("[OutputAggregationSection] sample output keys:", Object.keys(list[0]));
    }

    return list
      .map((o: any) => {
        // Tipo: puede venir como type, outputType
        const type = String(o?.type ?? o?.outputType ?? "").trim();
        
        // Label: intentar múltiples campos posibles
        // nameCell suele contener la celda donde está la etiqueta (ej: "E5")
        // outputText suele contener el texto real de la etiqueta
        const label = String(
          o?.outputText ?? o?.label ?? o?.name ?? o?.nameCell ?? o?.id ?? o?.outputId ?? ""
        ).trim();
        
        // Name/ID: identificador único (puede ser UUID o nombre)
        const name = String(o?.id ?? o?.outputId ?? o?.name ?? label).trim();
        
        if (!name) return null;
        
        return { name, label: label || name, type: type || "unknown" } as OutputDef;
      })
      .filter(Boolean)
      .filter(filterOutPriceAndImages) as OutputDef[];
  };

  // Cargar outputs del COMPONENTE
  const { data: componentOutputs = [], isLoading: isLoadingComponent, isError: isErrorComponent } = useQuery({
    queryKey: ["component-outputs-pricing", componentProductId],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: componentProductId,
        method: "GET",
      });
      if (error) throw new Error("No se pudieron cargar los outputs del componente");
      return normalizeOutputs(data);
    },
    enabled: !!componentProductId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Cargar outputs del PADRE (producto compuesto)
  const { data: parentOutputs = [], isLoading: isLoadingParent, isError: isErrorParent } = useQuery({
    queryKey: ["parent-outputs", compositeProductId, organizationId],
    queryFn: async () => {
      // 1) Preferimos los outputs “generales” configurados en BD (pestaña Datos de salida).
      //    Esto evita depender de que EasyQuote devuelva outputs en el pricing del padre.
      try {
        if (organizationId && compositeProductId) {
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("api_user_id")
            .eq("id", organizationId)
            .single();

          if (!orgError && org?.api_user_id) {
            const { data: dbOutputs, error: dbError } = await supabase
              .from("composite_product_outputs")
              .select("name,label,type")
              .eq("api_user_id", org.api_user_id)
              .eq("easyquote_product_id", compositeProductId)
              .order("display_order", { ascending: true });

            if (!dbError && Array.isArray(dbOutputs) && dbOutputs.length > 0) {
              return dbOutputs
                .map((o) => ({
                  name: String(o.name),
                  label: String(o.label ?? o.name),
                  type: String(o.type ?? "unknown"),
                }))
                .filter(filterOutPriceAndImages);
            }
          }
        }
      } catch {
        // Si falla BD, hacemos fallback a EasyQuote.
      }

      // 2) Fallback: EasyQuote pricing (por si no hay outputs en BD todavía)
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: compositeProductId,
        method: "GET",
      });
      if (error) throw new Error("No se pudieron cargar los outputs del producto principal");
      return normalizeOutputs(data);
    },
    enabled: !!compositeProductId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Estado local: source_output_name -> target_output_name (del padre)
  const [aggregations, setAggregations] = useState<Record<string, string>>({});

  // Inicializar desde existentes
  useEffect(() => {
    const initial: Record<string, string> = {};
    existingAggregations.forEach((agg) => {
      initial[agg.source_output_name] = agg.target_output_name;
    });
    setAggregations(initial);
  }, [existingAggregations]);

  const handleAddAggregation = (sourceOutputName: string) => {
    // Por defecto, intentar mapear al output con el mismo nombre si existe
    const matchingParent = parentOutputs.find(p => p.name === sourceOutputName);
    setAggregations((prev) => ({
      ...prev,
      [sourceOutputName]: matchingParent?.name || "",
    }));
  };

  const handleRemoveAggregation = (sourceOutputName: string) => {
    setAggregations((prev) => {
      const next = { ...prev };
      delete next[sourceOutputName];
      return next;
    });
  };

  const handleTargetChange = (sourceOutputName: string, targetOutputName: string) => {
    setAggregations((prev) => ({
      ...prev,
      [sourceOutputName]: targetOutputName,
    }));
  };

  const handleSave = async () => {
    const toSave: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[] = [];
    for (const [sourceOutputName, targetOutputName] of Object.entries(aggregations)) {
      if (!targetOutputName) continue; // Solo guardar si hay un target seleccionado
      const targetOutput = parentOutputs.find(p => p.name === targetOutputName);
      toSave.push({
        organization_id: organizationId,
        composite_product_id: compositeProductId,
        source_output_name: sourceOutputName,
        target_output_name: targetOutputName,
        target_output_label: targetOutput?.label || targetOutputName,
        aggregation_type: "sum",
      });
    }
    await onSave(toSave);
  };

  // Outputs configurados como agregados
  const configuredOutputNames = new Set(Object.keys(aggregations));
  const availableComponentOutputs = componentOutputs.filter(
    (o) => !configuredOutputNames.has(o.name)
  );

  const isLoading = isLoadingComponent || isLoadingParent;
  const isError = isErrorComponent || isErrorParent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-destructive text-center py-4">
        Error al cargar los outputs. Verifica que los productos estén configurados correctamente.
      </div>
    );
  }

  if (componentOutputs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No hay outputs disponibles en este componente
      </div>
    );
  }

  if (parentOutputs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No hay outputs generales disponibles para mapear. Define primero los “Datos de salida” del producto compuesto.
      </div>
    );
  }

  // Verificar si hay agregaciones válidas (con target seleccionado)
  const validAggregationsCount = Object.values(aggregations).filter(t => t).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Mapeo de outputs (componente → general)</p>
        <span className="text-xs text-muted-foreground">
          {validAggregationsCount} configurados
        </span>
      </div>

      {/* Lista de agregaciones configuradas */}
      {Object.entries(aggregations).map(([sourceOutputName, targetOutputName]) => {
        const sourceOutput = componentOutputs.find((o) => o.name === sourceOutputName);
        return (
          <div
            key={sourceOutputName}
            className="flex items-center gap-2 p-2 rounded-lg border bg-accent/5"
          >
            {/* Output del componente (origen) */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Componente</p>
              <p className="text-sm font-medium truncate">
                {sourceOutput?.label || sourceOutputName}
              </p>
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

            {/* Selector de output del padre (destino) */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">General (sumar a)</p>
              <Select
                value={targetOutputName}
                onValueChange={(value) => handleTargetChange(sourceOutputName, value)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Seleccionar output..." />
                </SelectTrigger>
                <SelectContent>
                  {parentOutputs.map((output) => (
                    <SelectItem key={output.name} value={output.name}>
                      {output.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
              onClick={() => handleRemoveAggregation(sourceOutputName)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      {/* Selector para añadir nuevas agregaciones */}
      {availableComponentOutputs.length > 0 && (
        <Select
          value=""
          onValueChange={(name) => handleAddAggregation(name)}
        >
          <SelectTrigger className="h-8 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            <span>Añadir output del componente</span>
          </SelectTrigger>
          <SelectContent>
            {availableComponentOutputs.map((output) => (
              <SelectItem key={output.name} value={output.name}>
                {output.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Botón guardar */}
      {configuredOutputNames.size > 0 && (
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || validAggregationsCount === 0}
          className="w-full"
        >
          {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Guardar agregaciones
        </Button>
      )}
    </div>
  );
}
