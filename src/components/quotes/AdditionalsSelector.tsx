import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Plus } from "lucide-react"

interface Additional {
  id: string
  name: string
  description: string | null
  type: "net_amount" | "quantity_multiplier" | "capacity_divider" | "percentage"
  default_value: number
  is_discount: boolean
  capacity_value: number | null
}

interface SelectedAdditional {
  id: string
  name: string
  type: "net_amount" | "quantity_multiplier" | "capacity_divider" | "percentage" | "custom"
  value: number
  multiValues?: number[]  // Per-quantity values when multi-qty is enabled (for net_amount)
  isCustom?: boolean
  is_discount?: boolean
  capacity_value?: number | null
}

interface AdditionalsSelectorProps {
  selectedAdditionals: SelectedAdditional[]
  onChange: (additionals: SelectedAdditional[]) => void
  quantity?: number
  basePrice?: number
  multiEnabled?: boolean
  qtyCount?: number
  qtyLabels?: string[]  // e.g. ["500", "1000", "2000"]
}

export default function AdditionalsSelector({ selectedAdditionals, onChange, quantity = 1, basePrice = 0, multiEnabled = false, qtyCount = 3, qtyLabels = [] }: AdditionalsSelectorProps) {
  const [newAdditionalId, setNewAdditionalId] = useState<string>("")
  const [predefinedType, setPredefinedType] = useState<"net_amount" | "quantity_multiplier" | "capacity_divider" | "percentage">("net_amount")
  const [predefinedValue, setPredefinedValue] = useState<number>(0)
  const [predefinedCapacity, setPredefinedCapacity] = useState<number | null>(null)
  const [customName, setCustomName] = useState("")
  const [customValue, setCustomValue] = useState(0)
  const [customType, setCustomType] = useState<"net_amount" | "quantity_multiplier" | "capacity_divider" | "percentage">("net_amount")
  const [customCapacity, setCustomCapacity] = useState<number>(1)

  const { data: availableAdditionals = [] } = useQuery({
    queryKey: ["additionals", "article"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("*")
        .eq("is_active", true)
        .eq("assignment_type", "article")
        .order("name")

      if (error) throw error
      return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        type: (item.type as "net_amount" | "quantity_multiplier" | "capacity_divider" | "percentage") || "net_amount",
        default_value: item.default_value || 0,
        is_discount: item.is_discount || false,
        capacity_value: item.capacity_value || null
      }))
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })

  const addPredefinedAdditional = () => {
    if (!newAdditionalId) return

    const additional = availableAdditionals.find(a => a.id === newAdditionalId)
    if (!additional) return

    // Generate unique ID to allow multiple instances of the same additional
    const uniqueId = `${additional.id}_${Date.now()}`
    
    // Initialize multiValues by default if multiEnabled and net_amount
    const initialMultiValues = (multiEnabled && predefinedType === 'net_amount') 
      ? Array(qtyCount).fill(predefinedValue)
      : undefined
    
    const newSelected: SelectedAdditional = {
      id: uniqueId,
      name: additional.name,
      type: predefinedType,
      value: predefinedValue,
      multiValues: initialMultiValues,
      is_discount: additional.is_discount || false,
      capacity_value: predefinedType === 'capacity_divider' ? predefinedCapacity : null
    }

    onChange([...selectedAdditionals, newSelected])
    setNewAdditionalId("")
    setPredefinedValue(0)
    setPredefinedCapacity(null)
  }

  // Update predefined type and value when selection changes
  const handlePredefinedSelection = (additionalId: string) => {
    setNewAdditionalId(additionalId)
    const additional = availableAdditionals.find((a) => a.id === additionalId)
    if (additional) {
      setPredefinedType(additional.type)
      setPredefinedValue(additional.default_value)
      setPredefinedCapacity(additional.capacity_value)
    }
  }

  const addCustomAdditional = () => {
    if (!customName.trim()) return

    const customId = `custom_${Date.now()}`
    
    // Initialize multiValues by default if multiEnabled and net_amount
    const initialMultiValues = (multiEnabled && customType === 'net_amount')
      ? Array(qtyCount).fill(customValue)
      : undefined
    
    const newCustom: SelectedAdditional = {
      id: customId,
      name: customName.trim(),
      type: customType,
      value: customValue,
      multiValues: initialMultiValues,
      isCustom: true,
      capacity_value: customType === 'capacity_divider' ? customCapacity : null
    }

    onChange([...selectedAdditionals, newCustom])
    setCustomName("")
    setCustomValue(0)
    setCustomCapacity(1)
  }

  const removeAdditional = (id: string) => {
    onChange(selectedAdditionals.filter(sa => sa.id !== id))
  }

  const updateAdditionalValue = (id: string, value: number) => {
    onChange(selectedAdditionals.map(sa => 
      sa.id === id ? { ...sa, value, multiValues: undefined } : sa
    ))
  }

  const updateAdditionalMultiValue = (id: string, qtyIndex: number, value: number) => {
    onChange(selectedAdditionals.map(sa => {
      if (sa.id !== id) return sa;
      const mv = [...(sa.multiValues || Array(qtyCount).fill(sa.value))];
      const oldQ1Value = mv[0];
      mv[qtyIndex] = value;
      
      // If editing Q1 and all other values are the same as old Q1, update all to match
      if (qtyIndex === 0) {
        const allSameAsOldQ1 = mv.slice(1).every(v => v === oldQ1Value);
        if (allSameAsOldQ1) {
          return { ...sa, multiValues: Array(qtyCount).fill(value), value };
        }
      }
      
      return { ...sa, multiValues: mv, value: mv[0] ?? sa.value };
    }))
  }

  const toggleMultiMode = (id: string) => {
    onChange(selectedAdditionals.map(sa => {
      if (sa.id !== id || sa.type !== 'net_amount') return sa;
      if (sa.multiValues) {
        // Collapse back to single value (use first)
        return { ...sa, value: sa.multiValues[0] ?? sa.value, multiValues: undefined };
      } else {
        // Expand to multi: fill all with current value
        return { ...sa, multiValues: Array(qtyCount).fill(sa.value) };
      }
    }))
  }

  return (
    <div className="space-y-3">
      {/* Selected Additionals */}
      {selectedAdditionals.length > 0 && (
        <div className="space-y-1.5">
          {selectedAdditionals.map((additional) => {
            // Calculate subtotal for this additional
            let subtotal = 0;
            let subtotalLabel = "";

            if (additional.type === "net_amount") {
              subtotal = additional.value;
              subtotalLabel = `${subtotal.toFixed(2)} €`;
            } else if (additional.type === "percentage") {
              subtotal = (basePrice * additional.value) / 100;
              subtotalLabel = `${subtotal.toFixed(2)} €`;
            } else if (additional.type === "quantity_multiplier") {
              subtotal = additional.value * quantity;
              subtotalLabel = `${subtotal.toFixed(2)} €`;
            } else if (additional.type === "capacity_divider") {
              const capacity = additional.capacity_value || 1;
              const unitsNeeded = Math.ceil(quantity / capacity);
              subtotal = additional.value * unitsNeeded;
              subtotalLabel = `${subtotal.toFixed(2)} €`;
            }
            
              const isNetMulti = multiEnabled && additional.type === "net_amount" && !!additional.multiValues;
              const showMultiToggle = multiEnabled && additional.type === "net_amount";
              
              return (
              <div key={additional.id} className="p-1.5 border rounded space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {additional.name}
                      {additional.is_discount && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                          Descuento
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {additional.type === "net_amount" ? "Importe neto" : 
                       additional.type === "percentage" ? "Porcentaje" :
                       additional.type === "quantity_multiplier" ? "Precio unidad" :
                       additional.type === "capacity_divider" ? `Por capacidad (${additional.capacity_value || '?'} uds)` : "Personalizado"}
                    </div>
                  </div>
                  {/* Single value input (when NOT in multi mode for this additional) */}
                  {!isNetMulti && (
                    <div className="flex items-center gap-1 w-24">
                      {additional.isCustom ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={additional.value}
                          onChange={(e) => updateAdditionalValue(additional.id, parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="w-full h-9"
                        />
                      ) : (
                        <div className="w-full h-9 flex items-center justify-end px-3 border rounded bg-muted/50">
                          <span className="font-medium">{additional.value}</span>
                        </div>
                      )}
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {additional.type === "percentage" ? "%" :
                         additional.type === "net_amount" ? "€" : 
                         additional.type === "capacity_divider" ? "€/ud" : "x"}
                      </span>
                    </div>
                  )}
                  {/* Subtotal column (only for single mode) */}
                  {!isNetMulti && (
                    <div className="w-32 text-right">
                      <span className="text-sm font-semibold text-primary">
                        {subtotalLabel}
                      </span>
                    </div>
                  )}
                  {/* Multi toggle button for net_amount */}
                  {showMultiToggle && (
                    <Button
                      variant={isNetMulti ? "secondary" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => toggleMultiMode(additional.id)}
                      title={isNetMulti ? "Usar valor único" : "Valor por cantidad"}
                    >
                      {isNetMulti ? "1 valor" : "Por Qty"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeAdditional(additional.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {/* Per-quantity inputs for net_amount in multi mode */}
                {isNetMulti && additional.multiValues && (
                  <div className="flex gap-2 flex-wrap pl-2 pt-1 border-t items-center">
                    {additional.multiValues.slice(0, qtyCount).map((mv, qi) => (
                      <div key={qi} className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground w-10">
                          {qtyLabels[qi] ? `Q${qi + 1}` : `Q${qi + 1}`}
                          {qtyLabels[qi] && <span className="block text-[10px]">({qtyLabels[qi]})</span>}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={mv}
                          onChange={(e) => updateAdditionalMultiValue(additional.id, qi, parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="w-20 h-7 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">€</span>
                      </div>
                    ))}
                    {/* Repeat value button - copies Q1 to all others */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const q1Value = additional.multiValues?.[0] ?? additional.value;
                        onChange(selectedAdditionals.map(sa => {
                          if (sa.id !== additional.id) return sa;
                          return { ...sa, multiValues: Array(qtyCount).fill(q1Value) };
                        }));
                      }}
                      title="Repetir valor de Q1 en todas las cantidades"
                    >
                      <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Igualar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Predefined Additional */}
      {availableAdditionals.length > 0 && (
        <div className="flex gap-2 items-center">
          <Select value={newAdditionalId} onValueChange={handlePredefinedSelection}>
            <SelectTrigger className="w-64 h-9 justify-start">
              <SelectValue placeholder="Selecciona un ajuste..." />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {availableAdditionals.map((additional) => (
                <SelectItem key={additional.id} value={additional.id}>
                  {additional.name} ({additional.type === "net_amount" ? "Importe" : 
                                     additional.type === "quantity_multiplier" ? "Precio ud." : 
                                     `Capacidad: ${additional.capacity_value || '?'} uds`})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={predefinedType} 
            onValueChange={(value: "net_amount" | "quantity_multiplier") => setPredefinedType(value)}
            disabled={true}
          >
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              <SelectItem value="net_amount">Importe</SelectItem>
              <SelectItem value="quantity_multiplier">Precio ud.</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 w-24">
            <Input
              type="number"
              step="0.01"
              value={predefinedValue}
              onChange={(e) => setPredefinedValue(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              placeholder="Valor"
              className="w-full h-9"
              disabled={!newAdditionalId}
            />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
          <Button onClick={addPredefinedAdditional} disabled={!newAdditionalId} variant="secondary" className="h-9 px-4 min-w-[90px]">
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>
      )}

      {/* Add Custom Additional */}
      <div className="flex gap-2 items-center flex-wrap">
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Concepto personalizado"
          className="w-64 h-9"
        />
        <Select value={customType} onValueChange={(value: "net_amount" | "quantity_multiplier" | "capacity_divider" | "percentage") => setCustomType(value)}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="net_amount">Importe</SelectItem>
            <SelectItem value="percentage">Porcentaje</SelectItem>
            <SelectItem value="quantity_multiplier">Precio ud.</SelectItem>
            <SelectItem value="capacity_divider">Por capacidad</SelectItem>
          </SelectContent>
        </Select>
        {customType === 'capacity_divider' && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="1"
              step="1"
              value={customCapacity}
              onChange={(e) => setCustomCapacity(parseInt(e.target.value) || 1)}
              onFocus={(e) => e.target.select()}
              placeholder="Capacidad"
              className="w-16 h-9"
            />
            <span className="text-xs text-muted-foreground">uds</span>
          </div>
        )}
        <div className="flex items-center gap-1 w-24">
          <Input
            type="number"
            step="0.01"
            value={customValue}
            onChange={(e) => setCustomValue(parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            placeholder="Valor"
            className="w-full h-9"
          />
          <span className="text-sm text-muted-foreground">€</span>
        </div>
        <Button 
          onClick={addCustomAdditional} 
          disabled={!customName.trim()}
          variant="secondary"
          className="h-9 px-4 min-w-[90px]"
        >
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>
    </div>
  )
}