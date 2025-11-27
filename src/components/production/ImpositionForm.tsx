import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ImpositionData, updateCalculatedValues } from "@/utils/impositionCalculator";

interface ImpositionFormProps {
  data: ImpositionData;
  onChange: (data: ImpositionData) => void;
}

export function ImpositionForm({ data, onChange }: ImpositionFormProps) {
  const [localData, setLocalData] = useState<ImpositionData>(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleChange = (field: keyof ImpositionData, value: number) => {
    const updated = { ...localData, [field]: value };
    const withCalculations = updateCalculatedValues(updated);
    setLocalData(withCalculations);
    onChange(withCalculations);
  };

  return (
    <div className="space-y-4">
      {/* Producto */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Producto</h4>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="productWidth" className="text-xs">Ancho (mm)</Label>
            <Input
              id="productWidth"
              type="number"
              value={localData.productWidth}
              onChange={(e) => handleChange('productWidth', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="productHeight" className="text-xs">Alto (mm)</Label>
            <Input
              id="productHeight"
              type="number"
              value={localData.productHeight}
              onChange={(e) => handleChange('productHeight', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="bleed" className="text-xs">Sangrado (mm)</Label>
            <Input
              id="bleed"
              type="number"
              value={localData.bleed}
              onChange={(e) => handleChange('bleed', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Pliego */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Pliego</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="sheetWidth" className="text-xs">Ancho hoja (mm)</Label>
            <Input
              id="sheetWidth"
              type="number"
              value={localData.sheetWidth}
              onChange={(e) => handleChange('sheetWidth', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="sheetHeight" className="text-xs">Alto hoja (mm)</Label>
            <Input
              id="sheetHeight"
              type="number"
              value={localData.sheetHeight}
              onChange={(e) => handleChange('sheetHeight', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="validWidth" className="text-xs">Ancho válido (mm)</Label>
            <Input
              id="validWidth"
              type="number"
              value={localData.validWidth}
              onChange={(e) => handleChange('validWidth', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="validHeight" className="text-xs">Alto válido (mm)</Label>
            <Input
              id="validHeight"
              type="number"
              value={localData.validHeight}
              onChange={(e) => handleChange('validHeight', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Calles */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Calles</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="gutterH" className="text-xs">Horizontal (mm)</Label>
            <Input
              id="gutterH"
              type="number"
              value={localData.gutterH}
              onChange={(e) => handleChange('gutterH', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="gutterV" className="text-xs">Vertical (mm)</Label>
            <Input
              id="gutterV"
              type="number"
              value={localData.gutterV}
              onChange={(e) => handleChange('gutterV', parseFloat(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Valores calculados */}
      <div className="pt-2 border-t">
        <h4 className="font-semibold text-sm mb-2">Resultado</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Repeticiones:</span>
            <span className="font-medium">
              {localData.repetitionsH} × {localData.repetitionsV} = {localData.totalRepetitions}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aprovechamiento:</span>
            <span className="font-medium">{localData.utilization?.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
