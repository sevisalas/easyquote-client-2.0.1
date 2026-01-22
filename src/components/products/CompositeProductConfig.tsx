import { Loader2, Info } from "lucide-react";
import { useCompositeProductConfig } from "@/hooks/useCompositeProductConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CompatibleComponentsEditor } from "./CompatibleComponentsEditor";

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
    availableComponentProducts,
    organizationId,
    isLoading,
    addComponent,
    updateComponent,
    deleteComponent,
    isAddingComponent,
    isUpdatingComponent,
    isDeletingComponent,
  } = useCompositeProductConfig(easyquoteProductId);

  if (isLoading || !organizationId) {
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
        onAdd={addComponent}
        onUpdate={updateComponent}
        onDelete={deleteComponent}
        isAdding={isAddingComponent}
        isUpdating={isUpdatingComponent}
        isDeleting={isDeletingComponent}
      />
    </div>
  );
}
