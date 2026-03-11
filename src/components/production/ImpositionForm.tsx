import { useEffect, useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImpositionData, updateCalculatedValues, VALID_PAGES_PER_SHEET, calculateImposition } from "@/utils/impositionCalculator";
import { BookOpen, Lock, Unlock } from "lucide-react";

interface ImpositionFormProps {
  data: ImpositionData;
  onChange: (data: ImpositionData) => void;
}

export function ImpositionForm({ data, onChange }: ImpositionFormProps) {
  const [localData, setLocalData] = useState<ImpositionData>(() => updateCalculatedValues(data));

  useEffect(() => {
    setLocalData(updateCalculatedValues(data));
  }, [data]);

  const applyChange = useCallback((updates: Partial<ImpositionData>) => {
    setLocalData(prev => {
      const merged = { ...prev, ...updates };
      const withCalc = updateCalculatedValues(merged);
      onChange(withCalc);
      return withCalc;
    });
  }, [onChange]);

  const handleNumericChange = (field: keyof ImpositionData, value: string) => {
    applyChange({ [field]: parseFloat(value) || 0 });
  };

  const calcResult = calculateImposition(localData);
  const hasPageAdjust = localData.pagesPerSheet && localData.pagesPerSheet > 0;
  const isManual = !!localData.isManual;

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
              onChange={(e) => handleNumericChange('productWidth', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="productHeight" className="text-xs">Alto (mm)</Label>
            <Input
              id="productHeight"
              type="number"
              value={localData.productHeight}
              onChange={(e) => handleNumericChange('productHeight', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="bleed" className="text-xs">Sangrado (mm)</Label>
            <Input
              id="bleed"
              type="number"
              value={localData.bleed}
              onChange={(e) => handleNumericChange('bleed', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Área válida */}
      <div>
        <h4 className="font-semibold text-sm mb-2">Área válida de impresión</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="validWidth" className="text-xs">Ancho válido (mm)</Label>
            <Input
              id="validWidth"
              type="number"
              value={localData.validWidth}
              onChange={(e) => handleNumericChange('validWidth', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="validHeight" className="text-xs">Alto válido (mm)</Label>
            <Input
              id="validHeight"
              type="number"
              value={localData.validHeight}
              onChange={(e) => handleNumericChange('validHeight', e.target.value)}
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
              onChange={(e) => handleNumericChange('gutterH', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="gutterV" className="text-xs">Vertical (mm)</Label>
            <Input
              id="gutterV"
              type="number"
              value={localData.gutterV}
              onChange={(e) => handleNumericChange('gutterV', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      </div>

      {/* Manual mode toggle + controls */}
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm flex items-center gap-1.5">
            {isManual ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
            Cuadre {isManual ? 'manual' : 'automático'}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Manual</span>
            <Switch
              checked={isManual}
              onCheckedChange={(checked) => applyChange({ isManual: checked })}
            />
          </div>
        </div>

        {/* Orientation selector */}
        <div className="mb-3">
          <Label className="text-xs">Orientación del producto</Label>
          <Select
            value={localData.orientation || 'horizontal'}
            onValueChange={(val) => applyChange({ orientation: val as 'horizontal' | 'vertical', isManual: true })}
            disabled={!isManual}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="vertical">Vertical (rotado 90°)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Manual reps */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <Label htmlFor="repetitionsH" className="text-xs">Poses por fila</Label>
            <Input
              id="repetitionsH"
              type="number"
              min={1}
              value={localData.repetitionsH || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                applyChange({ repetitionsH: val, isManual: true });
              }}
              disabled={!isManual}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="repetitionsV" className="text-xs">Poses por columna</Label>
            <Input
              id="repetitionsV"
              type="number"
              min={1}
              value={localData.repetitionsV || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                applyChange({ repetitionsV: val, isManual: true });
              }}
              disabled={!isManual}
              className="h-8"
            />
          </div>
        </div>

        {/* Págs/pliego (encuadernación) */}
        <div className="mb-3">
          <Label className="text-xs flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Págs/pliego (encuadernación)
          </Label>
          <Select
            value={String(localData.pagesPerSheet || 0)}
            onValueChange={(val) => applyChange({ pagesPerSheet: parseInt(val) })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Sin ajuste" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sin ajuste</SelectItem>
              {VALID_PAGES_PER_SHEET.map(v => (
                <SelectItem key={v} value={String(v)}>{v} págs/pliego</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Valores calculados */}
      <div className="pt-2 border-t">
        <h4 className="font-semibold text-sm mb-2">Resultado</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Repeticiones:</span>
            <span className="font-medium">
              {calcResult.repetitionsH} × {calcResult.repetitionsV} = {calcResult.totalRepetitions}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Aprovechamiento:</span>
            <span className="font-medium">{calcResult.utilization.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">Orientación:</span>
            <span className="font-medium">{calcResult.orientation === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
          </div>
        </div>
        
        {/* Ajuste por encuadernación */}
        {hasPageAdjust && calcResult.adjustedPagesPerSheet && (
          <div className="mt-2 p-2 rounded bg-accent/50 border border-accent text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-accent-foreground">
              <BookOpen className="h-3 w-3" />
              Ajuste encuadernación
            </div>
            {calcResult.rawTotalRepetitions && (
              <p className="text-muted-foreground">
                Cálculo bruto: {calcResult.rawTotalRepetitions}/cara × 2 = {calcResult.rawTotalRepetitions * 2} págs
              </p>
            )}
            <p className="font-medium">
              Ajustado: {calcResult.adjustedPagesPerSheet} págs/pliego ({calcResult.totalRepetitions}/cara)
            </p>
            <p className="text-muted-foreground text-[10px]">
              Válidos: {VALID_PAGES_PER_SHEET.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
