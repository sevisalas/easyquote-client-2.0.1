import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CompositeOutput, OUTPUT_TYPES } from "@/hooks/useCompositeProductConfig";

interface CompositeOutputEditorProps {
  outputs: CompositeOutput[];
  organizationId: string;
  easyquoteProductId: string;
  onAdd: (output: Omit<CompositeOutput, "id" | "created_at" | "updated_at">) => Promise<any>;
  onUpdate: (output: Partial<CompositeOutput> & { id: string }) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  isAdding: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

interface EditingOutput {
  id?: string;
  name: string;
  label: string;
  type: string;
  formula: string;
}

const DEFAULT_OUTPUT: EditingOutput = {
  name: "",
  label: "",
  type: "price",
  formula: "",
};

export function CompositeOutputEditor({
  outputs,
  organizationId,
  easyquoteProductId,
  onAdd,
  onUpdate,
  onDelete,
  isAdding,
  isUpdating,
  isDeleting,
}: CompositeOutputEditorProps) {
  const [editingOutput, setEditingOutput] = useState<EditingOutput | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleStartCreate = () => {
    setEditingOutput({ ...DEFAULT_OUTPUT });
    setIsCreating(true);
  };

  const handleStartEdit = (output: CompositeOutput) => {
    setEditingOutput({
      id: output.id,
      name: output.name,
      label: output.label,
      type: output.type,
      formula: output.formula || "",
    });
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingOutput(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingOutput) return;

    if (!editingOutput.name.trim() || !editingOutput.label.trim()) {
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
          name: editingOutput.name.trim(),
          label: editingOutput.label.trim(),
          type: editingOutput.type,
          formula: editingOutput.formula || null,
          display_order: outputs.length,
        });
        toast({ title: "Resultado creado", description: "El resultado se ha añadido correctamente" });
      } else if (editingOutput.id) {
        await onUpdate({
          id: editingOutput.id,
          name: editingOutput.name.trim(),
          label: editingOutput.label.trim(),
          type: editingOutput.type,
          formula: editingOutput.formula || null,
        });
        toast({ title: "Resultado actualizado", description: "El resultado se ha actualizado" });
      }
      handleCancel();
    } catch (error) {
      console.error("Error saving output:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el resultado",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast({ title: "Resultado eliminado", description: "El resultado se ha eliminado" });
    } catch (error) {
      console.error("Error deleting output:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el resultado",
        variant: "destructive",
      });
    }
  };

  const isBusy = isAdding || isUpdating || isDeleting;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Resultados</h3>
          <p className="text-sm text-muted-foreground">
            Resultados que se mostrarán al usuario (precio total, descripción, etc.)
          </p>
        </div>
          <Button onClick={handleStartCreate} size="sm" disabled={editingOutput !== null}>
          <Plus className="h-4 w-4 mr-2" />
            Añadir resultado
        </Button>
      </div>

      {/* List of existing outputs */}
      {outputs.length === 0 && !editingOutput && (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground">No hay resultados definidos</p>
          <p className="text-xs text-muted-foreground mt-1">
            Añade resultados como "Precio Total", "Descripción", etc.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {outputs.map((output) => (
          <Card key={output.id} className={editingOutput?.id === output.id ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-4">
              {editingOutput?.id === output.id ? (
                <OutputForm
                  output={editingOutput}
                  onChange={setEditingOutput}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isBusy={isBusy}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{output.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {output.name} • {OUTPUT_TYPES.find((t) => t.value === output.type)?.label}
                        {output.formula && ` • Fórmula: ${output.formula.substring(0, 30)}...`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{output.type}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(output)}
                      disabled={editingOutput !== null}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(output.id)}
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

      {/* New output form */}
      {isCreating && editingOutput && (
        <Card className="ring-2 ring-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Nuevo resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <OutputForm
              output={editingOutput}
              onChange={setEditingOutput}
              onSave={handleSave}
              onCancel={handleCancel}
              isBusy={isBusy}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface OutputFormProps {
  output: EditingOutput;
  onChange: (output: EditingOutput) => void;
  onSave: () => void;
  onCancel: () => void;
  isBusy: boolean;
}

function OutputForm({ output, onChange, onSave, onCancel, isBusy }: OutputFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nombre interno</Label>
          <Input
            value={output.name}
            onChange={(e) => onChange({ ...output, name: e.target.value })}
            placeholder="precio_total"
          />
          <p className="text-xs text-muted-foreground mt-1">Usado para cálculos</p>
        </div>
        <div>
          <Label>Etiqueta visible</Label>
          <Input
            value={output.label}
            onChange={(e) => onChange({ ...output, label: e.target.value })}
            placeholder="Precio Total"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo</Label>
          <Select value={output.type} onValueChange={(value) => onChange({ ...output, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Fórmula de agregación (opcional)</Label>
        <Textarea
          value={output.formula}
          onChange={(e) => onChange({ ...output, formula: e.target.value })}
          placeholder="SUM(componente_1.precio, componente_2.precio)"
          rows={2}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Define cómo se calcula este output a partir de los componentes
        </p>
      </div>

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
