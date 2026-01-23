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
  const normalizeOutputs = (raw: any): OutputDef[] => {
    const list: any[] = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? Array.isArray(raw.items)
          ? raw.items
          : Array.isArray(raw.outputs)
            ? raw.outputs
            : Array.isArray(raw.outputValues)
              ? raw.outputValues
              : Array.isArray(raw.results)
                ? raw.results
                : []
        : [];

    return list
      .map((o: any) => {
        const type = String(o?.type ?? o?.outputType ?? "").trim();
        const label = String(
          o?.label ?? o?.name ?? o?.outputText ?? o?.nameCell ?? o?.valueCell ?? o?.id ?? o?.outputId ?? ""
        ).trim();
        const name = String(o?.name ?? o?.id ?? o?.outputId ?? label).trim();
        if (!name) return null;
        return { name, label: label || name, type: type || "unknown" } as OutputDef;
      })
      .filter(Boolean)
      .filter((o: any) => {
        const type = String(o.type || "").toLowerCase();
        const name = String(o.name || "").toLowerCase();
        // Excluir precio e imágenes
        const isPrice = type === "price" || name === "price" || name === "precio";
        const isImage = type === "image" || name === "image" || name === "imagen";
        return !isPrice && !isImage;
      }) as OutputDef[];
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
      const outputs = data?.outputValues ?? data?.outputs ?? [];
      return normalizeOutputs(outputs);
    },
    enabled: !!componentProductId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Cargar outputs del PADRE (producto compuesto)
  const { data: parentOutputs = [], isLoading: isLoadingParent, isError: isErrorParent } = useQuery({
    queryKey: ["parent-outputs-pricing", compositeProductId],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: compositeProductId,
        method: "GET",
      });
      if (error) throw new Error("No se pudieron cargar los outputs del padre");
      const outputs = data?.outputValues ?? data?.outputs ?? [];
      return normalizeOutputs(outputs);
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
        No hay outputs disponibles en el producto padre
      </div>
    );
  }

  // Verificar si hay agregaciones válidas (con target seleccionado)
  const validAggregationsCount = Object.values(aggregations).filter(t => t).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Mapeo de outputs (componente → padre)</p>
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
              <p className="text-xs text-muted-foreground">Padre (sumar a)</p>
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
