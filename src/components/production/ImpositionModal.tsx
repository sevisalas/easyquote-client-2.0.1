import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImpositionData, updateCalculatedValues } from "@/utils/impositionCalculator";
import { ImpositionForm } from "./ImpositionForm";
import { ImpositionScheme } from "./ImpositionScheme";

interface ImpositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ImpositionData;
  onSave: (data: ImpositionData) => void;
}

export function ImpositionModal({ open, onOpenChange, initialData, onSave }: ImpositionModalProps) {
  const [data, setData] = useState<ImpositionData>(() => updateCalculatedValues(initialData));

  const handleSave = () => {
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar imposición</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-[350px_1fr] gap-6">
          {/* Formulario a la izquierda */}
          <div>
            <ImpositionForm data={data} onChange={setData} />
          </div>
          
          {/* Visualización a la derecha */}
          <div className="flex flex-col items-center justify-center">
            <ImpositionScheme data={data} compact={false} />
            <p className="text-xs text-muted-foreground mt-2">
              Vista previa del esquema de imposición
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
