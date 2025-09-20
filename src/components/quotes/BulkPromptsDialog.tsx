import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PromptType {
  id: number;
  promptType: string;
}

interface BulkPromptData {
  sheet: string;
  promptCell: string;
  valueCell: string;
  promptType: number;
  valueRequired: boolean;
  valueOptionRange: string;
  valueQuantityAllowedDecimals: number;
  valueQuantityMin: number;
  valueQuantityMax: number;
  promptSeq: number;
}

interface BulkPromptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (prompts: BulkPromptData[]) => void;
  promptTypes: PromptType[];
  isSaving: boolean;
  existingPrompts: any[];
}

export function BulkPromptsDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  promptTypes, 
  isSaving,
  existingPrompts = []
}: BulkPromptsDialogProps) {
  
  const getNextSeq = () => {
    if (existingPrompts.length === 0) return 1;
    const maxSeq = Math.max(...existingPrompts.map(p => p.promptSeq || 0));
    return maxSeq + 1;
  };

  const getNextRow = () => {
    if (existingPrompts.length === 0) return 2;
    
    // Obtener todas las filas utilizadas de existing prompts
    const usedRows = existingPrompts
      .map(p => {
        const promptMatch = p.promptCell?.match(/(\d+)/);
        const valueMatch = p.valueCell?.match(/(\d+)/);
        return [
          promptMatch ? parseInt(promptMatch[1]) : 0,
          valueMatch ? parseInt(valueMatch[1]) : 0
        ];
      })
      .flat()
      .filter(row => row > 0);
    
    const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : 1;
    return maxRow + 1;
  };

  const createInitialPrompt = (seq: number, row: number) => ({
    sheet: "Main",
    promptCell: `A${row}`,
    valueCell: `B${row}`,
    promptType: promptTypes[0]?.id || 0,
    valueRequired: false,
    valueOptionRange: "",
    valueQuantityAllowedDecimals: 0,
    valueQuantityMin: 1,
    valueQuantityMax: 9999,
    promptSeq: seq
  });

  const [prompts, setPrompts] = useState<BulkPromptData[]>([]);

  const addPrompt = () => {
    const baseSeq = getNextSeq();
    const baseRow = getNextRow();
    const nextSeq = baseSeq + prompts.length;
    const nextRow = baseRow + prompts.length;
    setPrompts([...prompts, createInitialPrompt(nextSeq, nextRow)]);
  };

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const updatePrompt = (index: number, field: keyof BulkPromptData, value: any) => {
    const updated = prompts.map((prompt, i) => 
      i === index ? { ...prompt, [field]: value } : prompt
    );
    setPrompts(updated);
  };

  const handleSave = () => {
    onSave(prompts);
  };

  const resetForm = () => {
    const startSeq = getNextSeq();
    const startRow = getNextRow();
    setPrompts([
      createInitialPrompt(startSeq, startRow),
      createInitialPrompt(startSeq + 1, startRow + 1),
      createInitialPrompt(startSeq + 2, startRow + 2)
    ]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  useEffect(() => {
    if (open && prompts.length === 0) {
      resetForm();
    }
  }, [open, existingPrompts]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Añadir Datos de Entrada Masivamente</DialogTitle>
          <DialogDescription>
            Configura múltiples datos de entrada nuevos para el producto
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {prompts.length} dato{prompts.length !== 1 ? 's' : ''} nuevo{prompts.length !== 1 ? 's' : ''}
              </p>
              <Button onClick={addPrompt} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            </div>

            <div className="space-y-3">
              {prompts.map((prompt, index) => {
                const currentType = promptTypes.find(type => type.id === prompt.promptType);
                const isNumericType = currentType?.promptType === "Number" || currentType?.promptType === "Quantity";

                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-sm">Nuevo Dato #{index + 1}</h4>
                      {prompts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePrompt(index)}
                          className="text-destructive hover:text-destructive h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-1">
                        <Label className="text-xs">Hoja</Label>
                        <Input
                          value={prompt.sheet}
                          onChange={(e) => updatePrompt(index, 'sheet', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Rótulo</Label>
                        <Input
                          value={prompt.promptCell}
                          onChange={(e) => updatePrompt(index, 'promptCell', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Valor</Label>
                        <Input
                          value={prompt.valueCell}
                          onChange={(e) => updatePrompt(index, 'valueCell', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Orden</Label>
                        <Input
                          type="number"
                          value={prompt.promptSeq}
                          onChange={(e) => updatePrompt(index, 'promptSeq', parseInt(e.target.value) || 1)}
                          className="h-8 text-xs"
                        />
                      </div>

                      {!isNumericType && (
                        <div className="col-span-2">
                          <Label className="text-xs">Rango</Label>
                          <Input
                            value={prompt.valueOptionRange}
                            onChange={(e) => updatePrompt(index, 'valueOptionRange', e.target.value)}
                            placeholder="$E$2:$E$3"
                            className="h-8 text-xs"
                          />
                        </div>
                      )}

                      <div className="col-span-2">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={prompt.promptType.toString()}
                          onValueChange={(value) => updatePrompt(index, 'promptType', parseInt(value))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {promptTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.promptType}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-1">
                        <Label className="text-xs">Req.</Label>
                        <div className="flex items-center h-8">
                          <Switch
                            checked={prompt.valueRequired}
                            onCheckedChange={(checked) => updatePrompt(index, 'valueRequired', checked)}
                          />
                        </div>
                      </div>

                      {isNumericType && (
                        <>
                          <div className="col-span-1">
                            <Label className="text-xs">Decs.</Label>
                            <Input
                              type="number"
                              value={prompt.valueQuantityAllowedDecimals}
                              onChange={(e) => updatePrompt(index, 'valueQuantityAllowedDecimals', parseInt(e.target.value) || 0)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Min</Label>
                            <Input
                              type="number"
                              value={prompt.valueQuantityMin}
                              onChange={(e) => updatePrompt(index, 'valueQuantityMin', parseFloat(e.target.value) || 1)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Max</Label>
                            <Input
                              type="number"
                              value={prompt.valueQuantityMax}
                              onChange={(e) => updatePrompt(index, 'valueQuantityMax', parseFloat(e.target.value) || 9999)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </>
                      )}

                      {!isNumericType && <div className="col-span-3"></div>}
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
          <Button onClick={handleSave} disabled={isSaving || prompts.length === 0}>
            {isSaving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar {prompts.length} Nuevo{prompts.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}