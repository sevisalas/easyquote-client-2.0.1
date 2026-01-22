import { Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompositeProductConfig, type PromptConnection } from "@/hooks/useCompositeProductConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CompatibleComponentsEditor } from "./CompatibleComponentsEditor";
import { toast } from "sonner";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";

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
    availableComponentProducts,
    organizationId,
    isLoading,
    addComponent,
    updateComponent,
    deleteComponent,
    upsertConnection,
    deleteConnectionsByComponent,
    isAddingComponent,
    isUpdatingComponent,
    isDeletingComponent,
    isUpsertingConnection,
  } = useCompositeProductConfig(easyquoteProductId);

  // Cargar los prompts del producto padre desde pricing API (para obtener labels reales)
  const { data: parentPrompts = [], isLoading: isLoadingParentPrompts } = useQuery({
    queryKey: ["composite-parent-prompts", easyquoteProductId],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any>("easyquote-pricing", {
        token,
        productId: easyquoteProductId,
      });
      if (error) {
        console.error("Error fetching parent prompts:", error);
        return [];
      }
      const prompts = data?.prompts || [];
      return prompts.map((p: any) => ({
        name: p.id, // Usamos el ID como nombre para las conexiones
        label: p.promptText || p.promptCell || p.id,
      }));
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
        onAdd={addComponent}
        onUpdate={updateComponent}
        onDelete={deleteComponent}
        onSaveConnections={handleSaveConnections}
        isAdding={isAddingComponent}
        isUpdating={isUpdatingComponent}
        isDeleting={isDeletingComponent}
        isSavingConnections={isUpsertingConnection}
      />
    </div>
  );
}
