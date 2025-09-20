import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Eye, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PromptType {
  id: number;
  promptType: string;
}

interface BulkPromptData {
  promptSheet: string;
  promptCell: string;
  valueSheet: string;
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
}

export function BulkPromptsDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  promptTypes, 
  isSaving 
}: BulkPromptsDialogProps) {
  const [prompts, setPrompts] = useState<BulkPromptData[]>([
    {
      promptSheet: "Main",
      promptCell: "A2",
      valueSheet: "Main", 
      valueCell: "B2",
      promptType: promptTypes[0]?.id || 0,
      valueRequired: false,
      valueOptionRange: "",
      valueQuantityAllowedDecimals: 0,
      valueQuantityMin: 1,
      valueQuantityMax: 9999,
      promptSeq: 1
    }
  ]);

  const addPrompt = () => {
    const nextSeq = Math.max(...prompts.map(p => p.promptSeq)) + 1;
    const nextRow = nextSeq + 1;
    
    setPrompts([...prompts, {
      promptSheet: "Main",
      promptCell: `A${nextRow}`,
      valueSheet: "Main",
      valueCell: `B${nextRow}`,
      promptType: promptTypes[0]?.id || 0,
      valueRequired: false,
      valueOptionRange: "",
      valueQuantityAllowedDecimals: 0,
      valueQuantityMin: 1,
      valueQuantityMax: 9999,
      promptSeq: nextSeq
    }]);
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
    setPrompts([{
      promptSheet: "Main",
      promptCell: "A2",
      valueSheet: "Main",
      valueCell: "B2",
      promptType: promptTypes[0]?.id || 0,
      valueRequired: false,
      valueOptionRange: "",
      valueQuantityAllowedDecimals: 0,
      valueQuantityMin: 1,
      valueQuantityMax: 9999,
      promptSeq: 1
    }]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Editor Masivo de Datos de Entrada</DialogTitle>
          <DialogDescription>
            Crea múltiples campos de entrada para el producto y previsualiza antes de guardar
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="editor" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Vista Previa ({prompts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Configura todos los campos de entrada necesarios
                </p>
                <Button onClick={addPrompt} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Campo
                </Button>
              </div>

              <div className="space-y-4">
                {prompts.map((prompt, index) => {
                  const currentType = promptTypes.find(type => type.id === prompt.promptType);
                  const isNumericType = currentType?.promptType === "Number" || currentType?.promptType === "Quantity";

                  return (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm">Campo #{index + 1}</CardTitle>
                          {prompts.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePrompt(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label>Hoja Prompt</Label>
                            <Input
                              value={prompt.promptSheet}
                              onChange={(e) => updatePrompt(index, 'promptSheet', e.target.value)}
                              placeholder="Main"
                            />
                          </div>
                          <div>
                            <Label>Celda Prompt</Label>
                            <Input
                              value={prompt.promptCell}
                              onChange={(e) => updatePrompt(index, 'promptCell', e.target.value)}
                              placeholder="A2"
                            />
                          </div>
                          <div>
                            <Label>Hoja Valor</Label>
                            <Input
                              value={prompt.valueSheet}
                              onChange={(e) => updatePrompt(index, 'valueSheet', e.target.value)}
                              placeholder="Main"
                            />
                          </div>
                          <div>
                            <Label>Celda Valor</Label>
                            <Input
                              value={prompt.valueCell}
                              onChange={(e) => updatePrompt(index, 'valueCell', e.target.value)}
                              placeholder="B2"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Tipo</Label>
                            <Select
                              value={prompt.promptType.toString()}
                              onValueChange={(value) => updatePrompt(index, 'promptType', parseInt(value))}
                            >
                              <SelectTrigger>
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
                          <div>
                            <Label>Orden</Label>
                            <Input
                              type="number"
                              value={prompt.promptSeq}
                              onChange={(e) => updatePrompt(index, 'promptSeq', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-6">
                            <Switch
                              checked={prompt.valueRequired}
                              onCheckedChange={(checked) => updatePrompt(index, 'valueRequired', checked)}
                            />
                            <Label>Requerido</Label>
                          </div>
                        </div>

                        {!isNumericType && (
                          <div>
                            <Label>Rango de Opciones</Label>
                            <Input
                              value={prompt.valueOptionRange}
                              onChange={(e) => updatePrompt(index, 'valueOptionRange', e.target.value)}
                              placeholder="$E$2:$E$3"
                            />
                          </div>
                        )}

                        {isNumericType && (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label>Decimales</Label>
                              <Input
                                type="number"
                                value={prompt.valueQuantityAllowedDecimals}
                                onChange={(e) => updatePrompt(index, 'valueQuantityAllowedDecimals', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <Label>Mínimo</Label>
                              <Input
                                type="number"
                                value={prompt.valueQuantityMin}
                                onChange={(e) => updatePrompt(index, 'valueQuantityMin', parseFloat(e.target.value) || 1)}
                              />
                            </div>
                            <div>
                              <Label>Máximo</Label>
                              <Input
                                type="number"
                                value={prompt.valueQuantityMax}
                                onChange={(e) => updatePrompt(index, 'valueQuantityMax', parseFloat(e.target.value) || 9999)}
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Vista Previa</h3>
                <p className="text-sm text-muted-foreground">
                  {prompts.length} campo{prompts.length !== 1 ? 's' : ''} configurado{prompts.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-3">
                {prompts.map((prompt, index) => {
                  const currentType = promptTypes.find(type => type.id === prompt.promptType);
                  const isNumericType = currentType?.promptType === "Number" || currentType?.promptType === "Quantity";

                  return (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium">Campo #{index + 1}</h4>
                          <div className="text-xs text-muted-foreground">
                            Orden: {prompt.promptSeq}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div><strong>Hoja:</strong> {prompt.promptSheet}</div>
                            <div><strong>Celda Prompt:</strong> {prompt.promptCell}</div>
                            <div><strong>Celda Valor:</strong> {prompt.valueCell}</div>
                          </div>
                          <div className="space-y-2">
                            <div><strong>Tipo:</strong> {currentType?.promptType}</div>
                            <div><strong>Requerido:</strong> {prompt.valueRequired ? 'Sí' : 'No'}</div>
                            {!isNumericType && prompt.valueOptionRange && (
                              <div><strong>Rango:</strong> {prompt.valueOptionRange}</div>
                            )}
                            {isNumericType && (
                              <div className="space-y-1">
                                <div><strong>Decimales:</strong> {prompt.valueQuantityAllowedDecimals}</div>
                                <div><strong>Min-Max:</strong> {prompt.valueQuantityMin} - {prompt.valueQuantityMax}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

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
                Guardar {prompts.length} Campo{prompts.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}