import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CompositePrompt, PROMPT_TYPES } from "@/hooks/useCompositeProductConfig";

interface CompositePromptEditorProps {
  prompts: CompositePrompt[];
  organizationId: string;
  easyquoteProductId: string;
  onAdd: (prompt: Omit<CompositePrompt, "id" | "created_at" | "updated_at">) => Promise<any>;
  onUpdate: (prompt: Partial<CompositePrompt> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  isAdding: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

interface EditingPrompt {
  id?: string;
  name: string;
  label: string;
  type: string;
  default_value: string;
  is_required: boolean;
  options: { label: string; value: string }[];
}

const DEFAULT_PROMPT: EditingPrompt = {
  name: "",
  label: "",
  type: "text",
  default_value: "",
  is_required: false,
  options: [],
};

export function CompositePromptEditor({
  prompts,
  organizationId,
  easyquoteProductId,
  onAdd,
  onUpdate,
  onDelete,
  isAdding,
  isUpdating,
  isDeleting,
}: CompositePromptEditorProps) {
  const [editingPrompt, setEditingPrompt] = useState<EditingPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleStartCreate = () => {
    setEditingPrompt({ ...DEFAULT_PROMPT });
    setIsCreating(true);
  };

  const handleStartEdit = (prompt: CompositePrompt) => {
    setEditingPrompt({
      id: prompt.id,
      name: prompt.name,
      label: prompt.label,
      type: prompt.type,
      default_value: prompt.default_value || "",
      is_required: prompt.is_required,
      options: (prompt.options as { label: string; value: string }[]) || [],
    });
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingPrompt(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingPrompt) return;

    if (!editingPrompt.name.trim() || !editingPrompt.label.trim()) {
      toast({
        title: "Error",
        description: "El nombre y la etiqueta son obligatorios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isCreating) {
        await onAdd({
          organization_id: organizationId,
          easyquote_product_id: easyquoteProductId,
          name: editingPrompt.name.trim(),
          label: editingPrompt.label.trim(),
          type: editingPrompt.type,
          default_value: editingPrompt.default_value || null,
          is_required: editingPrompt.is_required,
          options: editingPrompt.type === "select" ? editingPrompt.options : null,
          display_order: prompts.length,
        });
        toast({ title: "Campo creado", description: "El campo se ha añadido correctamente" });
      } else if (editingPrompt.id) {
        await onUpdate({
          id: editingPrompt.id,
          name: editingPrompt.name.trim(),
          label: editingPrompt.label.trim(),
          type: editingPrompt.type,
          default_value: editingPrompt.default_value || null,
          is_required: editingPrompt.is_required,
          options: editingPrompt.type === "select" ? editingPrompt.options : null,
        });
        toast({ title: "Campo actualizado", description: "El campo se ha actualizado" });
      }
      handleCancel();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el campo",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast({ title: "Campo eliminado", description: "El campo se ha eliminado" });
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el campo",
        variant: "destructive",
      });
    }
  };

  const handleAddOption = () => {
    if (!editingPrompt) return;
    setEditingPrompt({
      ...editingPrompt,
      options: [...editingPrompt.options, { label: "", value: "" }],
    });
  };

  const handleUpdateOption = (index: number, field: "label" | "value", value: string) => {
    if (!editingPrompt) return;
    const newOptions = [...editingPrompt.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setEditingPrompt({ ...editingPrompt, options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    if (!editingPrompt) return;
    setEditingPrompt({
      ...editingPrompt,
      options: editingPrompt.options.filter((_, i) => i !== index),
    });
  };

  const isBusy = isAdding || isUpdating || isDeleting;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Datos de Entrada Generales</h3>
          <p className="text-sm text-muted-foreground">
            Campos que el usuario completará para todo el producto compuesto
          </p>
        </div>
          <Button onClick={handleStartCreate} size="sm" disabled={editingPrompt !== null}>
          <Plus className="h-4 w-4 mr-2" />
            Añadir campo
        </Button>
      </div>

      {/* List of existing prompts */}
      {prompts.length === 0 && !editingPrompt && (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground">No hay campos definidos</p>
          <p className="text-xs text-muted-foreground mt-1">
            Añade campos como "Cantidad", "Formato", etc.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {prompts.map((prompt) => (
          <Card key={prompt.id} className={editingPrompt?.id === prompt.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4">
              {editingPrompt?.id === prompt.id ? (
                <PromptForm
                  prompt={editingPrompt}
                  onChange={setEditingPrompt}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onAddOption={handleAddOption}
                  onUpdateOption={handleUpdateOption}
                  onRemoveOption={handleRemoveOption}
                  isBusy={isBusy}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{prompt.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {prompt.name} • {PROMPT_TYPES.find((t) => t.value === prompt.type)?.label}
                        {prompt.is_required && " • Obligatorio"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{prompt.type}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(prompt)}
                      disabled={editingPrompt !== null}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(prompt.id)}
                      disabled={isBusy}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New prompt form */}
      {isCreating && editingPrompt && (
        <Card className="ring-2 ring-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nuevo campo</CardTitle>
          </CardHeader>
          <CardContent>
            <PromptForm
              prompt={editingPrompt}
              onChange={setEditingPrompt}
              onSave={handleSave}
              onCancel={handleCancel}
              onAddOption={handleAddOption}
              onUpdateOption={handleUpdateOption}
              onRemoveOption={handleRemoveOption}
              isBusy={isBusy}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PromptFormProps {
  prompt: EditingPrompt;
  onChange: (prompt: EditingPrompt) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, field: "label" | "value", value: string) => void;
  onRemoveOption: (index: number) => void;
  isBusy: boolean;
}

function PromptForm({
  prompt,
  onChange,
  onSave,
  onCancel,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  isBusy,
}: PromptFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nombre interno</Label>
          <Input
            value={prompt.name}
            onChange={(e) => onChange({ ...prompt, name: e.target.value })}
            placeholder="cantidad"
          />
          <p className="text-xs text-muted-foreground mt-1">Usado para conexiones</p>
        </div>
        <div>
          <Label>Etiqueta visible</Label>
          <Input
            value={prompt.label}
            onChange={(e) => onChange({ ...prompt, label: e.target.value })}
            placeholder="Cantidad de ejemplares"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Tipo</Label>
          <Select value={prompt.type} onValueChange={(value) => onChange({ ...prompt, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROMPT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor por defecto</Label>
          <Input
            value={prompt.default_value}
            onChange={(e) => onChange({ ...prompt, default_value: e.target.value })}
            placeholder="500"
          />
        </div>
        <div className="flex items-end pb-2">
          <div className="flex items-center space-x-2">
            <Switch
              checked={prompt.is_required}
              onCheckedChange={(checked) => onChange({ ...prompt, is_required: checked })}
            />
            <Label>Obligatorio</Label>
          </div>
        </div>
      </div>

      {/* Options for select type */}
      {prompt.type === "select" && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Opciones del desplegable</Label>
            <Button type="button" variant="outline" size="sm" onClick={onAddOption}>
              <Plus className="h-3 w-3 mr-1" />
              Añadir opción
            </Button>
          </div>
          {prompt.options.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay opciones. Añade al menos una.</p>
          ) : (
            <div className="space-y-2">
              {prompt.options.map((option, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={option.label}
                    onChange={(e) => onUpdateOption(index, "label", e.target.value)}
                    placeholder="Etiqueta"
                    className="flex-1"
                  />
                  <Input
                    value={option.value}
                    onChange={(e) => onUpdateOption(index, "value", e.target.value)}
                    placeholder="Valor"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveOption(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isBusy}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={isBusy}>
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
