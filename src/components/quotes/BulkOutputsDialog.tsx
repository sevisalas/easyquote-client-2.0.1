import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Eye, Save } from "lucide-react";
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
}

export function BulkOutputsDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  outputTypes, 
  isSaving 
}: BulkOutputsDialogProps) {
  const [outputs, setOutputs] = useState<BulkOutputData[]>([
    {
      sheet: "Main",
      nameCell: "A25",
      valueCell: "B25",
      outputTypeId: outputTypes[0]?.id || 0
    }
  ]);

  const addOutput = () => {
    const nextRow = 25 + outputs.length;
    
    setOutputs([...outputs, {
      sheet: "Main",
      nameCell: `A${nextRow}`,
      valueCell: `B${nextRow}`,
      outputTypeId: outputTypes[0]?.id || 0
    }]);
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
    setOutputs([{
      sheet: "Main",
      nameCell: "A25",
      valueCell: "B25",
      outputTypeId: outputTypes[0]?.id || 0
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Editor Masivo de Datos de Salida</DialogTitle>
          <DialogDescription>
            Crea múltiples datos de salida para el producto y previsualiza antes de guardar
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="editor" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Vista Previa ({outputs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Configura todos los datos de salida necesarios
                </p>
                <Button onClick={addOutput} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Dato
                </Button>
              </div>

              <div className="space-y-4">
                {outputs.map((output, index) => {
                  const currentType = outputTypes.find(type => type.id === output.outputTypeId);

                  return (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm">Dato de Salida #{index + 1}</CardTitle>
                          {outputs.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOutput(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">Hoja</Label>
                            <Input
                              value={output.sheet}
                              onChange={(e) => updateOutput(index, 'sheet', e.target.value)}
                              placeholder="Main"
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Celda Rótulo</Label>
                            <Input
                              value={output.nameCell}
                              onChange={(e) => updateOutput(index, 'nameCell', e.target.value)}
                              placeholder="A25"
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Celda Valor</Label>
                            <Input
                              value={output.valueCell}
                              onChange={(e) => updateOutput(index, 'valueCell', e.target.value)}
                              placeholder="B25"
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select
                              value={output.outputTypeId.toString()}
                              onValueChange={(value) => updateOutput(index, 'outputTypeId', parseInt(value))}
                            >
                              <SelectTrigger className="text-xs h-8">
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
                  {outputs.length} dato{outputs.length !== 1 ? 's' : ''} configurado{outputs.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-3">
                {outputs.map((output, index) => {
                  const currentType = outputTypes.find(type => type.id === output.outputTypeId);

                  return (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium">Dato de Salida #{index + 1}</h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div><strong>Hoja:</strong> {output.sheet}</div>
                            <div><strong>Celda Rótulo:</strong> {output.nameCell}</div>
                          </div>
                          <div className="space-y-2">
                            <div><strong>Celda Valor:</strong> {output.valueCell}</div>
                            <div><strong>Tipo:</strong> {currentType?.outputType}</div>
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
          <Button onClick={handleSave} disabled={isSaving || outputs.length === 0}>
            {isSaving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar {outputs.length} Dato{outputs.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}