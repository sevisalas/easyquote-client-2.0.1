import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

interface Additional {
  id: string;
  name: string;
  description: string | null;
  type: "net_amount" | "quantity_multiplier" | "percentage";
  default_value: number;
  is_discount: boolean;
}

interface SelectedQuoteAdditional {
  id: string;
  name: string;
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom";
  value: number;
  isCustom?: boolean;
  is_discount?: boolean;
}

interface QuoteAdditionalsSelectorProps {
  selectedAdditionals: SelectedQuoteAdditional[];
  onChange: (additionals: SelectedQuoteAdditional[]) => void;
}

export default function QuoteAdditionalsSelector({ selectedAdditionals, onChange }: QuoteAdditionalsSelectorProps) {
  const [newAdditionalId, setNewAdditionalId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState(0);
  const [customType, setCustomType] = useState<"net_amount" | "percentage">("net_amount");

  const { data: availableAdditionals = [] } = useQuery({
    queryKey: ["additionals", "quote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("*")
        .eq("assignment_type", "quote")
        .order("name");

      if (error) throw error;
      return data as Additional[];
    },
  });

  const addPredefinedAdditional = () => {
    if (!newAdditionalId) return;

    const additional = availableAdditionals.find((a) => a.id === newAdditionalId);
    if (!additional) return;

    // Generate unique ID to allow multiple instances of the same additional
    const uniqueId = `${additional.id}_${Date.now()}`;

    const newSelected: SelectedQuoteAdditional = {
      id: uniqueId,
      name: additional.name,
      type: additional.type,
      value: additional.default_value,
      is_discount: additional.is_discount || false,
    };

    onChange([...selectedAdditionals, newSelected]);
    setNewAdditionalId("");
  };

  const addCustomAdditional = () => {
    if (!customName.trim()) return;

    const customId = `custom_${Date.now()}`;
    const newCustom: SelectedQuoteAdditional = {
      id: customId,
      name: customName.trim(),
      type: customType,
      value: customValue,
      isCustom: true,
    };

    onChange([...selectedAdditionals, newCustom]);
    setCustomName("");
    setCustomValue(0);
  };

  const removeAdditional = (id: string) => {
    onChange(selectedAdditionals.filter((sa) => sa.id !== id));
  };

  const updateAdditionalValue = (id: string, value: number) => {
    onChange(selectedAdditionals.map((sa) => (sa.id === id ? { ...sa, value } : sa)));
  };

  return (
    <div className="space-y-4">
      {/* Selected Additionals */}
      {selectedAdditionals.length > 0 && (
        <div className="space-y-2 max-w-2xl">
          {selectedAdditionals.map((additional) => (
            <div key={additional.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded border">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {additional.name}
                  {additional.isCustom && (
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Personalizado</span>
                  )}
                  {additional.is_discount && (
                    <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Descuento</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {additional.type === "net_amount"
                    ? "Importe neto"
                    : additional.type === "quantity_multiplier"
                      ? "Por cantidad total"
                      : "Porcentaje sobre subtotal"}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {additional.isCustom ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={additional.value}
                    onChange={(e) => updateAdditionalValue(additional.id, parseFloat(e.target.value) || 0)}
                    className="w-24 h-9"
                  />
                ) : (
                  <div className="w-24 h-9 flex items-center justify-end px-3 border rounded bg-muted/50">
                    <span className="font-medium">{additional.value}</span>
                  </div>
                )}
                <span className="text-sm text-muted-foreground w-4">
                  {additional.type === "net_amount" ? "€" : additional.type === "quantity_multiplier" ? "x" : "%"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => removeAdditional(additional.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Predefined Additional */}
      {availableAdditionals.length > 0 && (
        <div className="flex gap-2 items-center max-w-2xl">
          <Select value={newAdditionalId} onValueChange={setNewAdditionalId}>
            <SelectTrigger className="flex-1 h-9 justify-start">
              <SelectValue placeholder="Selecciona un ajuste..." />
            </SelectTrigger>
            <SelectContent>
              {availableAdditionals.map((additional) => (
                <SelectItem key={additional.id} value={additional.id}>
                  {additional.name} (
                  {additional.type === "net_amount"
                    ? "Importe"
                    : additional.type === "quantity_multiplier"
                      ? "Multiplicador"
                      : "Porcentaje"}
                  )
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={customType} onValueChange={(value: "net_amount" | "percentage") => setCustomType(value)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="net_amount">Importe</SelectItem>
              <SelectItem value="percentage">%</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="0.01" value={0} placeholder="0" className="w-24 h-9" readOnly />
          <Button onClick={addPredefinedAdditional} disabled={!newAdditionalId} className="h-9 px-4 shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>
      )}

      {/* Add Custom Additional */}
      <div className="flex gap-2 items-center max-w-2xl">
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Concepto personalizado"
          className="flex-1 h-9"
        />
        <Select value={customType} onValueChange={(value: "net_amount" | "percentage") => setCustomType(value)}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="net_amount">Importe</SelectItem>
            <SelectItem value="percentage">%</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          value={customValue}
          onChange={(e) => setCustomValue(parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-24 h-9"
        />
        <Button onClick={addCustomAdditional} disabled={!customName.trim()} className="h-9 px-4 shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>
    </div>
  );
}
