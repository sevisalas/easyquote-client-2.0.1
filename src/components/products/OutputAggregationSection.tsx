import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import type { OutputAggregation } from "@/hooks/useCompositeProductConfig";

interface OutputAggregationSectionProps {
  componentProductId: string;
  organizationId: string;
  compositeProductId: string;
  existingAggregations: OutputAggregation[];
  onSave: (aggregations: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  isSaving?: boolean;
}

interface ComponentOutputDef {
  name: string;
  label: string;
  type: string;
}

/**
 * Sección para configurar qué outputs del componente se agregan (suman) 
 * al producto padre compuesto.
 */
export function OutputAggregationSection({
  componentProductId,
  organizationId,
  compositeProductId,
  existingAggregations,
  onSave,
  isSaving,
}: OutputAggregationSectionProps) {
  // Cargar los outputs del componente desde la API
  const { data: componentOutputs = [], isLoading } = useQuery({
    queryKey: ["component-outputs-pricing", componentProductId],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: componentProductId,
        method: "GET",
      });
      if (error) {
        console.error("Error fetching component outputs:", error);
        return [];
      }
      // Los outputs vienen en data.outputs
      const outputs = data?.outputs || [];
      // Filtrar solo outputs numéricos (no precio, no imagen)
      return outputs
        .filter((o: any) => {
          const type = (o.type || "").toLowerCase();
          return type !== "price" && type !== "image";
        })
        .map((o: any) => ({
          name: o.name,
          label: o.label || o.name,
          type: o.type,
        })) as ComponentOutputDef[];
    },
    enabled: !!componentProductId,
    staleTime: 5 * 60 * 1000,
  });

  // Estado local: source_output_name -> { target_output_name, target_output_label }
  const [aggregations, setAggregations] = useState<
    Record<string, { targetName: string; targetLabel: string }>
  >({});

  // Inicializar desde existentes
  useEffect(() => {
    const initial: Record<string, { targetName: string; targetLabel: string }> = {};
    existingAggregations.forEach((agg) => {
      initial[agg.source_output_name] = {
        targetName: agg.target_output_name,
        targetLabel: agg.target_output_label,
      };
    });
    setAggregations(initial);
  }, [existingAggregations]);

  const handleAddAggregation = (sourceOutputName: string, label: string) => {
    setAggregations((prev) => ({
      ...prev,
      [sourceOutputName]: {
        targetName: `total_${sourceOutputName}`,
        targetLabel: `Total ${label}`,
      },
    }));
  };

  const handleRemoveAggregation = (sourceOutputName: string) => {
    setAggregations((prev) => {
      const next = { ...prev };
      delete next[sourceOutputName];
      return next;
    });
  };

  const handleLabelChange = (sourceOutputName: string, newLabel: string) => {
    setAggregations((prev) => ({
      ...prev,
      [sourceOutputName]: {
        ...prev[sourceOutputName],
        targetLabel: newLabel,
      },
    }));
  };

  const handleSave = async () => {
    const toSave: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[] = [];
    for (const [sourceOutputName, config] of Object.entries(aggregations)) {
      toSave.push({
        organization_id: organizationId,
        composite_product_id: compositeProductId,
        source_output_name: sourceOutputName,
        target_output_name: config.targetName,
        target_output_label: config.targetLabel,
        aggregation_type: "sum",
      });
    }
    await onSave(toSave);
  };

  // Outputs configurados como agregados
  const configuredOutputNames = new Set(Object.keys(aggregations));
  const availableOutputs = componentOutputs.filter(
    (o) => !configuredOutputNames.has(o.name)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (componentOutputs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No hay outputs numéricos disponibles en este componente
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Outputs a agregar (sumar)</p>
        <span className="text-xs text-muted-foreground">
          {configuredOutputNames.size} configurados
        </span>
      </div>

      {/* Lista de agregaciones configuradas */}
      {Object.entries(aggregations).map(([sourceOutputName, config]) => {
        const output = componentOutputs.find((o) => o.name === sourceOutputName);
        return (
          <div
            key={sourceOutputName}
            className="flex items-center gap-2 p-2 rounded-lg border bg-accent/5"
          >
            <ArrowUp className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {output?.label || sourceOutputName}
              </p>
              <Input
                value={config.targetLabel}
                onChange={(e) => handleLabelChange(sourceOutputName, e.target.value)}
                placeholder="Etiqueta en el padre"
                className="h-7 text-sm mt-1"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleRemoveAggregation(sourceOutputName)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      {/* Selector para añadir nuevas agregaciones */}
      {availableOutputs.length > 0 && (
        <Select
          value=""
          onValueChange={(name) => {
            const output = componentOutputs.find((o) => o.name === name);
            if (output) {
              handleAddAggregation(name, output.label);
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            <span>Añadir output para agregar</span>
          </SelectTrigger>
          <SelectContent>
            {availableOutputs.map((output) => (
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
          disabled={isSaving}
          className="w-full"
        >
          {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Guardar agregaciones
        </Button>
      )}
    </div>
  );
}
