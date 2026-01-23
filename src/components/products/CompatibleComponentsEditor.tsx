import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, Package, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import type { CompositeComponent, PromptConnection, OutputAggregation } from "@/hooks/useCompositeProductConfig";
import { ComponentPromptMappingDialog } from "./ComponentPromptMappingDialog";

interface CompatibleComponentsEditorProps {
  easyquoteProductId: string;
  organizationId: string;
  components: CompositeComponent[];
  availableProducts: { id: string; name: string }[];
  /** Prompts generales del producto padre para mapear */
  parentPrompts: { name: string; label: string }[];
  /** Conexiones de prompts existentes */
  promptConnections: PromptConnection[];
  /** Agregaciones de outputs existentes */
  outputAggregations: OutputAggregation[];
  onAdd: (component: Omit<CompositeComponent, "id" | "created_at" | "updated_at">) => Promise<any>;
  onUpdate: (update: Partial<CompositeComponent> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  onSaveConnections: (componentProductId: string, connections: Omit<PromptConnection, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  onSaveAggregations: (aggregations: Omit<OutputAggregation, "id" | "created_at" | "updated_at">[]) => Promise<void>;
  isAdding?: boolean;
  isUpdating?: boolean;
  isDeleting?: boolean;
  isSavingConnections?: boolean;
  isSavingAggregations?: boolean;
}

export function CompatibleComponentsEditor({
  easyquoteProductId,
  organizationId,
  components,
  availableProducts,
  parentPrompts,
  promptConnections,
  outputAggregations,
  onAdd,
  onUpdate,
  onDelete,
  onSaveConnections,
  onSaveAggregations,
  isAdding,
  isUpdating,
  isDeleting,
  isSavingConnections,
  isSavingAggregations,
}: CompatibleComponentsEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [alias, setAlias] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [configuringComponent, setConfiguringComponent] = useState<CompositeComponent | null>(null);

  // Productos disponibles que aún no están añadidos
  const addedProductIds = new Set(components.map((c) => c.component_product_id));
  const unaddedProducts = availableProducts.filter((p) => !addedProductIds.has(p.id));

  const handleAdd = async () => {
    if (!selectedProductId || !alias.trim()) {
      toast.error("Selecciona un producto y escribe un alias");
      return;
    }

    // Verificar que el alias no esté duplicado
    if (components.some((c) => c.component_alias.toLowerCase() === alias.trim().toLowerCase())) {
      toast.error("Ya existe un componente con ese alias");
      return;
    }

    try {
      await onAdd({
        organization_id: organizationId,
        composite_product_id: easyquoteProductId,
        component_product_id: selectedProductId,
        component_alias: alias.trim(),
        display_order: components.length,
        is_optional: isOptional,
      });
      toast.success("Componente añadido");
      setIsDialogOpen(false);
      setSelectedProductId("");
      setAlias("");
      setIsOptional(false);
    } catch (error) {
      console.error("Error adding component:", error);
      toast.error("Error al añadir componente");
    }
  };

  const handleDelete = async (id: string, alias: string) => {
    if (!confirm(`¿Eliminar el componente "${alias}"?`)) return;
    try {
      await onDelete(id);
      toast.success("Componente eliminado");
    } catch (error) {
      console.error("Error deleting component:", error);
      toast.error("Error al eliminar componente");
    }
  };

  const handleToggleOptional = async (component: CompositeComponent) => {
    try {
      await onUpdate({ id: component.id, is_optional: !component.is_optional });
    } catch (error) {
      console.error("Error updating component:", error);
      toast.error("Error al actualizar componente");
    }
  };


  const getProductName = (productId: string) => {
    return availableProducts.find((p) => p.id === productId)?.name || productId;
  };

  // Contar conexiones por componente
  const getConnectionCount = (componentProductId: string) => {
    return promptConnections.filter((c) => c.target_component_id === componentProductId).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Componentes compatibles</h3>
          {components.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {components.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          disabled={unaddedProducts.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>

      {components.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay componentes compatibles definidos
          </p>
          {unaddedProducts.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-1">
              Hay {unaddedProducts.length} producto(s) marcados como componente disponibles
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Marca productos como "componente" para poder añadirlos aquí
            </p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {components.map((component) => (
            <div
              key={component.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {component.component_alias}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {getProductName(component.component_product_id)}
                </p>
              </div>

              {/* Botón Configurar */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setConfiguringComponent(component)}
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Configurar</span>
                {getConnectionCount(component.component_product_id) > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-1">
                    {getConnectionCount(component.component_product_id)}
                  </span>
                )}
              </Button>


              <div className="flex items-center gap-2">
                <Label htmlFor={`optional-${component.id}`} className="text-xs text-muted-foreground">
                  Opcional
                </Label>
                <Switch
                  id={`optional-${component.id}`}
                  checked={component.is_optional}
                  onCheckedChange={() => handleToggleOptional(component)}
                  disabled={isUpdating}
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(component.id, component.component_alias)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir componente compatible</DialogTitle>
            <DialogDescription>
              Selecciona un producto marcado como componente y asígnale un alias para este producto compuesto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Producto componente</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {unaddedProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alias del componente</Label>
              <Input
                placeholder="Ej: Cubierta, Interior 1, Guardas..."
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El alias identifica el rol de este componente en el producto compuesto
              </p>
            </div>


            <div className="flex items-center justify-between">
              <div>
                <Label>Opcional</Label>
                <p className="text-xs text-muted-foreground">
                  Si es opcional, puede omitirse al presupuestar
                </p>
              </div>
              <Switch checked={isOptional} onCheckedChange={setIsOptional} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isAdding || !selectedProductId || !alias.trim()}>
              {isAdding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Añadir componente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de configuración de prompts y outputs del componente */}
      {configuringComponent && (
        <ComponentPromptMappingDialog
          open={!!configuringComponent}
          onOpenChange={(open) => !open && setConfiguringComponent(null)}
          component={configuringComponent}
          parentPrompts={parentPrompts}
          connections={promptConnections}
          outputAggregations={outputAggregations}
          organizationId={organizationId}
          compositeProductId={easyquoteProductId}
          onSave={async (connections) => {
            await onSaveConnections(configuringComponent.component_product_id, connections);
          }}
          onSaveAggregations={onSaveAggregations}
          isSaving={isSavingConnections}
          isSavingAggregations={isSavingAggregations}
        />
      )}
    </div>
  );
}
