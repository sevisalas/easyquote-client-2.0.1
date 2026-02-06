import { Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompositeProductConfig, type PromptConnection, type OutputAggregation } from "@/hooks/useCompositeProductConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CompatibleComponentsEditor } from "./CompatibleComponentsEditor";
import { toast } from "sonner";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { supabase } from "@/integrations/supabase/client";
import { resolveLivePromptCellLabels } from "@/lib/easyquoteExcelPromptLabels";

interface CompositeProductConfigProps {
  easyquoteProductId: string;
  productName: string;
  availableProducts: { id: string; name: string }[];
}

export function CompositeProductConfig({ 
  easyquoteProductId, 
  productName,
  availableProducts,
}: CompositeProductConfigProps) {
  const {
    components,
    promptConnections,
    outputAggregations,
    availableComponentProducts,
    organizationId,
    isLoading,
    addComponent,
    updateComponent,
    deleteComponent,
    upsertConnection,
    deleteConnectionsByComponent,
    upsertAggregation,
    deleteAggregation,
    isAddingComponent,
    isUpdatingComponent,
    isDeletingComponent,
    isUpsertingConnection,
    isUpsertingAggregation,
  } = useCompositeProductConfig(easyquoteProductId);

  // Cargar TODOS los prompts del producto padre (incluidos condicionales/ocultos).
  // OJO: easyquote-pricing puede omitir prompts no visibles según condiciones, por eso
  // usamos easyquote-prompts como fuente completa y solo enriquecemos labels con pricing/Excel.
  const { data: parentPrompts = [], isLoading: isLoadingParentPrompts } = useQuery({
    queryKey: ["composite-parent-prompts", easyquoteProductId, organizationId],
    queryFn: async () => {
      const out: { name: string; label: string }[] = [];

      // Variable para guardar las etiquetas personalizadas de product_prompt_settings
      let customLabelsByPromptName = new Map<string, string>();

      // 0) Campos generales del producto compuesto (registrados en BD)
      try {
        if (organizationId && easyquoteProductId) {
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("api_user_id")
            .eq("id", organizationId)
            .single();

          if (!orgError && org?.api_user_id) {
            const { data: dbPrompts, error: dbError } = await supabase
              .from("composite_product_prompts")
              .select("name,label")
              .eq("api_user_id", org.api_user_id)
              .eq("easyquote_product_id", easyquoteProductId)
              .order("display_order", { ascending: true });

            if (!dbError && Array.isArray(dbPrompts)) {
              for (const p of dbPrompts) {
                const name = String(p.name ?? "").trim();
                if (!name) continue;
                out.push({ name, label: String(p.label ?? p.name) });
              }
            }
          }

          // Cargar etiquetas personalizadas de product_prompt_settings
          const { data: promptSettings, error: settingsError } = await supabase
            .from("product_prompt_settings")
            .select("prompt_name,label")
            .eq("organization_id", organizationId)
            .eq("easyquote_product_id", easyquoteProductId);

          if (!settingsError && Array.isArray(promptSettings)) {
            for (const s of promptSettings) {
              const promptName = String(s.prompt_name ?? "").trim().toUpperCase();
              const label = String(s.label ?? "").trim();
              if (promptName && label) {
                customLabelsByPromptName.set(promptName, label);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[CompositeProductConfig] Error cargando prompts generales de BD:", e);
      }

      const token = await getEasyQuoteToken();
      if (!token) return out;

      // 1) Fuente completa: definiciones (easyquote-prompts)
      const defsRes = await invokeEasyQuoteFunction<any>("easyquote-prompts", {
        token,
        productId: easyquoteProductId,
      });

      const defs = Array.isArray(defsRes.data) ? defsRes.data : [];
      if (defsRes.error) {
        console.warn("[CompositeProductConfig] Error leyendo definiciones del padre:", defsRes.error);
        return out;
      }

      // 2) Enriquecimiento de labels: pricing (solo los visibles) + Excel vivo
      const pricingLabelById = new Map<string, string>();
      try {
        const { data: pricingData, error: pricingError } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
          token,
          productId: easyquoteProductId,
          method: "GET",
        });

        if (!pricingError) {
          const pricingPrompts = Array.isArray(pricingData?.prompts) ? pricingData.prompts : [];
          for (const p of pricingPrompts) {
            const id = String(p?.id ?? "").trim();
            if (!id) continue;
            const lbl = String(p?.promptText ?? p?.promptCell ?? "").trim();
            if (lbl) pricingLabelById.set(id, lbl);
          }
        }
      } catch {
        // ignore: solo enriquecimiento
      }

      const defById = new Map<string, { id: string; promptCell?: string; rawLabel?: string }>();
      for (const d of defs) {
        const id = String(d?.id ?? "").trim();
        if (!id) continue;
        defById.set(id, {
          id,
          promptCell: d?.promptCell ? String(d.promptCell) : undefined,
          rawLabel: String(d?.promptText ?? d?.label ?? d?.name ?? d?.description ?? "").trim() || undefined,
        });
      }

      let excelLabelByCell: Record<string, string> = {};
      try {
        const cells = Array.from(defById.values())
          .map((p) => p.promptCell)
          .filter(Boolean) as string[];
        if (cells.length > 0) {
          excelLabelByCell = (await resolveLivePromptCellLabels({
            token,
            productId: easyquoteProductId,
            promptCells: cells,
          })) as Record<string, string>;
        }
      } catch {
        // ignore
      }

      const isCellLike = (v: string) => /^[A-Z]+\d+$/i.test(v);
      const isUuidLike = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

      const merged = new Map<string, { name: string; label: string }>();
      // primero BD (para que siempre exista aunque no esté en EasyQuote)
      for (const p of out) merged.set(p.name, p);

      for (const p of defById.values()) {
        const id = p.id;
        const normalizedId = id.replace(/\$/g, "").trim().toUpperCase();
        
        // PRIORIDAD: 1) Etiqueta personalizada de product_prompt_settings
        const customLabel = customLabelsByPromptName.get(normalizedId);
        
        const pricingLabel = pricingLabelById.get(id);
        const excelLabel = p.promptCell ? excelLabelByCell[p.promptCell] : undefined;
        const rawLabel = p.rawLabel;

        // Si hay etiqueta personalizada, usarla directamente
        let labelCandidate: string;
        if (customLabel) {
          labelCandidate = customLabel;
        } else {
          labelCandidate =
            (pricingLabel && !isUuidLike(pricingLabel) ? pricingLabel : undefined) ??
            (excelLabel && !isCellLike(excelLabel) ? excelLabel : undefined) ??
            (rawLabel && !isUuidLike(rawLabel) ? rawLabel : undefined) ??
            p.promptCell ??
            id;
        }

        merged.set(id, {
          name: id,
          label: String(labelCandidate).trim() || id,
        });
      }

      return Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label));
    },
    enabled: !!easyquoteProductId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || isLoadingParentPrompts || !organizationId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filtrar solo los productos que están marcados como componentes
  const componentProducts = availableProducts.filter(
    (p) => availableComponentProducts.includes(p.id)
  );

  // Guardar conexiones para un componente específico
  const handleSaveConnections = async (
    componentProductId: string, 
    connections: Omit<PromptConnection, "id" | "created_at" | "updated_at">[]
  ) => {
    try {
      // Primero eliminar todas las conexiones existentes para este componente
      await deleteConnectionsByComponent(componentProductId);
      
      // Luego insertar las nuevas conexiones
      for (const connection of connections) {
        await upsertConnection(connection);
      }
    } catch (error) {
      console.error("Error saving connections:", error);
      throw error;
    }
  };

  // Guardar agregaciones de outputs
  const handleSaveAggregations = async (
    aggregations: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[]
  ) => {
    try {
      // Obtener las agregaciones actuales para este producto
      const currentSourceNames = new Set(aggregations.map(a => a.source_output_name));
      
      // Eliminar las que ya no están en la nueva lista
      for (const existing of outputAggregations) {
        if (!currentSourceNames.has(existing.source_output_name)) {
          await deleteAggregation(existing.id);
        }
      }
      
      // Upsert las nuevas
      for (const agg of aggregations) {
        await upsertAggregation(agg);
      }
    } catch (error) {
      console.error("Error saving aggregations:", error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Configuración del producto compuesto</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Asocia componentes para "{productName}"
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Los <strong>datos de entrada</strong> y <strong>datos de salida</strong> de este producto 
          se definen en el Excel asociado, igual que cualquier otro producto. 
          Usa las pestañas superiores para configurarlos.
        </AlertDescription>
      </Alert>

      <CompatibleComponentsEditor
        easyquoteProductId={easyquoteProductId}
        organizationId={organizationId}
        components={components}
        availableProducts={componentProducts}
        parentPrompts={parentPrompts}
        promptConnections={promptConnections}
        outputAggregations={outputAggregations}
        onAdd={addComponent}
        onUpdate={updateComponent}
        onDelete={deleteComponent}
        onSaveConnections={handleSaveConnections}
        onSaveAggregations={handleSaveAggregations}
        isAdding={isAddingComponent}
        isUpdating={isUpdatingComponent}
        isDeleting={isDeletingComponent}
        isSavingConnections={isUpsertingConnection}
        isSavingAggregations={isUpsertingAggregation}
      />
    </div>
  );
}
