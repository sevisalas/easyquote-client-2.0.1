import { Loader2, Puzzle, Info } from "lucide-react";
import { useCompositeProductConfig } from "@/hooks/useCompositeProductConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CompositeProductConfigProps {
  easyquoteProductId: string;
  productName: string;
}

export function CompositeProductConfig({ easyquoteProductId, productName }: CompositeProductConfigProps) {
  const {
    components,
    organizationId,
    isLoading,
    componentsLoading,
  } = useCompositeProductConfig(easyquoteProductId);

  if (isLoading || !organizationId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Componentes</h3>
          {components.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {components.length}
            </span>
          )}
        </div>
        
        <Alert>
          <AlertDescription>
            Asocia productos EasyQuote como <strong>componentes</strong> de este producto compuesto. 
            Cada componente aportará su precio y resultados al cálculo total.
          </AlertDescription>
        </Alert>
        
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Puzzle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Próximamente</p>
          <p className="text-xs text-muted-foreground mt-1">
            La asociación de componentes estará disponible en la siguiente fase
          </p>
        </div>
      </div>
    </div>
  );
}
