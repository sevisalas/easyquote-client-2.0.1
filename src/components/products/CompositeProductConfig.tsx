import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileInput, FileOutput, Puzzle } from "lucide-react";
import { useCompositeProductConfig } from "@/hooks/useCompositeProductConfig";
import { CompositePromptEditor } from "./CompositePromptEditor";
import { CompositeOutputEditor } from "./CompositeOutputEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CompositeProductConfigProps {
  easyquoteProductId: string;
  productName: string;
}

export function CompositeProductConfig({ easyquoteProductId, productName }: CompositeProductConfigProps) {
  const {
    prompts,
    outputs,
    components,
    organizationId,
    isLoading,
    promptsLoading,
    outputsLoading,
    addPrompt,
    updatePrompt,
    deletePrompt,
    isAddingPrompt,
    isUpdatingPrompt,
    isDeletingPrompt,
    addOutput,
    updateOutput,
    deleteOutput,
    isAddingOutput,
    isUpdatingOutput,
    isDeletingOutput,
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
        <h2 className="text-xl font-semibold">Configuración del Producto Compuesto</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define los campos generales y asocia componentes para "{productName}"
        </p>
      </div>

      <Tabs defaultValue="inputs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inputs" className="flex items-center gap-2">
            <FileInput className="h-4 w-4" />
            Inputs Generales
            {prompts.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {prompts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="outputs" className="flex items-center gap-2">
            <FileOutput className="h-4 w-4" />
            Outputs Generales
            {outputs.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {outputs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="components" className="flex items-center gap-2">
            <Puzzle className="h-4 w-4" />
            Componentes
            {components.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {components.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="space-y-4">
          <Alert>
            <AlertDescription>
              Los <strong>Inputs Generales</strong> son los campos que el usuario verá primero al configurar 
              este producto. Estos valores se pueden propagar a los componentes individuales.
            </AlertDescription>
          </Alert>
          <CompositePromptEditor
            prompts={prompts}
            organizationId={organizationId}
            easyquoteProductId={easyquoteProductId}
            onAdd={addPrompt}
            onUpdate={updatePrompt}
            onDelete={deletePrompt}
            isAdding={isAddingPrompt}
            isUpdating={isUpdatingPrompt}
            isDeleting={isDeletingPrompt}
          />
        </TabsContent>

        <TabsContent value="outputs" className="space-y-4">
          <Alert>
            <AlertDescription>
              Los <strong>Outputs Generales</strong> son los resultados finales que se mostrarán al usuario, 
              como el precio total calculado a partir de todos los componentes.
            </AlertDescription>
          </Alert>
          <CompositeOutputEditor
            outputs={outputs}
            organizationId={organizationId}
            easyquoteProductId={easyquoteProductId}
            onAdd={addOutput}
            onUpdate={updateOutput}
            onDelete={deleteOutput}
            isAdding={isAddingOutput}
            isUpdating={isUpdatingOutput}
            isDeleting={isDeletingOutput}
          />
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <Alert>
            <AlertDescription>
              Asocia productos EasyQuote como <strong>componentes</strong> de este producto compuesto. 
              Cada componente aportará su precio y outputs al cálculo total.
            </AlertDescription>
          </Alert>
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <Puzzle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Próximamente</p>
            <p className="text-xs text-muted-foreground mt-1">
              La asociación de componentes estará disponible en la siguiente fase
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
