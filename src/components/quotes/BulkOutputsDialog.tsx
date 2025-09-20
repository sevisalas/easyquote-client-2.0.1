import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface OutputType {
  id: number;
  outputType: string;
}

interface BulkOutputData {
  sheet: string;
  nameCell: string;
  valueCell: string;
  outputTypeId: number;
}

interface BulkOutputsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (outputs: BulkOutputData[]) => void;
  outputTypes: OutputType[];
  isSaving: boolean;
  existingOutputs: any[];
}

export function BulkOutputsDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  outputTypes, 
  isSaving,
  existingOutputs = []
}: BulkOutputsDialogProps) {

  const getNextRow = () => {
    if (existingOutputs.length === 0) return 25;
    
    // Obtener todas las filas utilizadas de existing outputs
    const usedRows = existingOutputs
      .map(output => {
        const nameMatch = output.nameCell?.match(/(\d+)/);
        const valueMatch = output.valueCell?.match(/(\d+)/);
        return [
          nameMatch ? parseInt(nameMatch[1]) : 0,
          valueMatch ? parseInt(valueMatch[1]) : 0
        ];
      })
      .flat()
      .filter(row => row > 0);
    
    const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : 24;
    return maxRow + 1;
  };

  const createInitialOutput = (row: number) => ({
    sheet: "Main",
    nameCell: `A${row}`,
    valueCell: `B${row}`,
    outputTypeId: outputTypes[0]?.id || 0
  });

  const [outputs, setOutputs] = useState<BulkOutputData[]>([]);

  const addOutput = () => {
    const baseRow = getNextRow();
    const nextRow = baseRow + outputs.length;
    setOutputs([...outputs, createInitialOutput(nextRow)]);
  };

  const removeOutput = (index: number) => {
    setOutputs(outputs.filter((_, i) => i !== index));
  };

  const updateOutput = (index: number, field: keyof BulkOutputData, value: any) => {
    const updated = outputs.map((output, i) => 
      i === index ? { ...output, [field]: value } : output
    );
    setOutputs(updated);
  };

  const handleSave = () => {
    onSave(outputs);
  };

  const resetForm = () => {
    setOutputs([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  useEffect(() => {
    if (open && outputs.length === 0) {
      // No pre-cargar nada, empezar con lista vacía
    }
  }, [open, existingOutputs]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Añadir Datos de Salida Masivamente</DialogTitle>
          <DialogDescription>
            Configura múltiples datos de salida nuevos para el producto
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {outputs.length} dato{outputs.length !== 1 ? 's' : ''} nuevo{outputs.length !== 1 ? 's' : ''}
              </p>
              <Button onClick={addOutput} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            </div>

            <div className="space-y-3">
              {outputs.map((output, index) => {
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-sm">Nuevo Dato de Salida #{index + 1}</h4>
                      {outputs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOutput(index)}
                          className="text-destructive hover:text-destructive h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-2">
                        <Label className="text-xs">Hoja</Label>
                        <Input
                          value={output.sheet}
                          onChange={(e) => updateOutput(index, 'sheet', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Celda Rótulo</Label>
                        <Input
                          value={output.nameCell}
                          onChange={(e) => updateOutput(index, 'nameCell', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Celda Valor</Label>
                        <Input
                          value={output.valueCell}
                          onChange={(e) => updateOutput(index, 'valueCell', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={output.outputTypeId.toString()}
                          onValueChange={(value) => updateOutput(index, 'outputTypeId', parseInt(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {outputTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.outputType}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || outputs.length === 0}>
            {isSaving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar {outputs.length} Nuevo{outputs.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}