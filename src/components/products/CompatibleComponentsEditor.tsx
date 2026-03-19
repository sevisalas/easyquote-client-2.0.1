import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, Package, Settings, ChevronRight, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { CompositeComponent, PromptConnection, OutputAggregation } from "@/hooks/useCompositeProductConfig";
import { ComponentPromptMappingDialog } from "./ComponentPromptMappingDialog";

interface CompatibleComponentsEditorProps {
  easyquoteProductId: string;
  organizationId: string;
  apiUserId: string;
  components: CompositeComponent[];
  availableProducts: { id: string; name: string }[];
  parentPrompts: { name: string; label: string }[];
  promptConnections: PromptConnection[];
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
  apiUserId,
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
  const [isRequired, setIsRequired] = useState(true);
  const [configuringComponent, setConfiguringComponent] = useState<CompositeComponent | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  const addedProductIds = new Set(components.map((c) => c.component_product_id));
  const unaddedProducts = availableProducts.filter((p) => !addedProductIds.has(p.id));

  const handleAdd = async () => {
    if (!selectedProductId || !alias.trim()) {
      toast.error("Selecciona un producto y escribe un alias");
      return;
    }
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
        is_optional: !isRequired,
      });
      toast.success("Componente añadido");
      setIsDialogOpen(false);
      setSelectedProductId("");
      setAlias("");
      setIsRequired(true);
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

  const getConnectionCount = (componentProductId: string) => {
    return promptConnections.filter((c) => c.target_component_id === componentProductId).length;
  };

  const toggleExpanded = (id: string, open: boolean) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
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
        <div className="space-y-2">
          {components.map((component) => {
            const isExpanded = expandedComponents.has(component.id);
            const connectionCount = getConnectionCount(component.component_product_id);
            const productName = getProductName(component.component_product_id);

            return (
              <Collapsible
                key={component.id}
                open={isExpanded}
                onOpenChange={(open) => toggleExpanded(component.id, open)}
              >
                <div className="border rounded-lg bg-background">
                  {/* Summary header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 text-left hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors" type="button">
                        <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <span className="font-medium truncate">{component.component_alias}</span>
                        <span className="text-sm text-muted-foreground truncate">({productName})</span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${component.is_optional ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          {component.is_optional ? 'Opcional' : 'Obligatorio'}
                        </span>
                        {connectionCount > 0 && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Link className="h-3.5 w-3.5" />
                              <span className="text-xs">{connectionCount}</span>
                            </span>
                          </TooltipTrigger><TooltipContent>{connectionCount} conexión(es) de datos</TooltipContent></Tooltip></TooltipProvider>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => setConfiguringComponent(component)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Configurar</span>
                      </Button>
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
                  </div>

                  {/* Expanded details */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4 border-t">
                      <div className="pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Detalles del componente</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs">Alias</Label>
                            <Input
                              className="h-9 mt-1"
                              defaultValue={component.component_alias}
                              onBlur={async (e) => {
                                const newAlias = e.target.value.trim();
                                if (newAlias && newAlias !== component.component_alias) {
                                  try {
                                    await onUpdate({ id: component.id, component_alias: newAlias });
                                  } catch { toast.error("Error al actualizar alias"); }
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Producto asociado</Label>
                            <p className="text-sm mt-2 text-muted-foreground">{productName}</p>
                          </div>
                          <div className="flex items-end gap-4 pb-1">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`req-comp-${component.id}`}
                                checked={!component.is_optional}
                                onCheckedChange={() => handleToggleOptional(component)}
                                disabled={isUpdating}
                              />
                              <Label htmlFor={`req-comp-${component.id}`} className="text-sm cursor-pointer">Obligatorio</Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {connectionCount > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Conexiones de datos</p>
                          <p className="text-sm text-muted-foreground">
                            {connectionCount} dato(s) del padre conectados a este componente.{" "}
                            <button
                              className="text-primary hover:underline"
                              onClick={() => setConfiguringComponent(component)}
                            >
                              Ver configuración →
                            </button>
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Add component dialog — kept as dialog since it's a creation action */}
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
                <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                <SelectContent>
                  {unaddedProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alias del componente</Label>
              <Input placeholder="Ej: Cubierta, Interior 1, Guardas..." value={alias} onChange={(e) => setAlias(e.target.value)} />
              <p className="text-xs text-muted-foreground">El alias identifica el rol de este componente en el producto compuesto</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Obligatorio</Label>
                <p className="text-xs text-muted-foreground">Si es obligatorio, siempre se incluirá al presupuestar</p>
              </div>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={isAdding || !selectedProductId || !alias.trim()}>
              {isAdding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Añadir componente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {configuringComponent && (
        <ComponentPromptMappingDialog
          open={!!configuringComponent}
          onOpenChange={(open) => !open && setConfiguringComponent(null)}
          component={configuringComponent}
          parentPrompts={parentPrompts}
          connections={promptConnections}
          outputAggregations={outputAggregations}
          organizationId={organizationId}
          apiUserId={apiUserId}
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
