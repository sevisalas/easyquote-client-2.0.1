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
  type: "net_amount" | "quantity_multiplier" | "capacity_divider"
  default_value: number
  is_discount: boolean
  capacity_value: number | null
}

interface SelectedAdditional {
  id: string
  name: string
  type: "net_amount" | "quantity_multiplier" | "capacity_divider" | "custom"
  value: number
  isCustom?: boolean
  is_discount?: boolean
  capacity_value?: number | null
}

interface AdditionalsSelectorProps {
  selectedAdditionals: SelectedAdditional[]
  onChange: (additionals: SelectedAdditional[]) => void
}

export default function AdditionalsSelector({ selectedAdditionals, onChange }: AdditionalsSelectorProps) {
  const [newAdditionalId, setNewAdditionalId] = useState<string>("")
  const [predefinedType, setPredefinedType] = useState<"net_amount" | "quantity_multiplier" | "capacity_divider">("net_amount")
  const [predefinedValue, setPredefinedValue] = useState<number>(0)
  const [predefinedCapacity, setPredefinedCapacity] = useState<number | null>(null)
  const [customName, setCustomName] = useState("")
  const [customValue, setCustomValue] = useState(0)
  const [customType, setCustomType] = useState<"net_amount" | "quantity_multiplier" | "capacity_divider">("net_amount")
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
        type: (item.type as "net_amount" | "quantity_multiplier" | "capacity_divider") || "net_amount",
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
    
    const newSelected: SelectedAdditional = {
      id: uniqueId,
      name: additional.name,
      type: predefinedType,
      value: predefinedValue,
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
    const newCustom: SelectedAdditional = {
      id: customId,
      name: customName.trim(),
      type: customType,
      value: customValue,
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
      sa.id === id ? { ...sa, value } : sa
    ))
  }

  return (
    <div className="space-y-3">
      {/* Selected Additionals */}
      {selectedAdditionals.length > 0 && (
        <div className="space-y-1.5">
          {selectedAdditionals.map((additional) => (
            <div key={additional.id} className="flex items-center gap-2 p-1.5 border rounded">
              <div className="w-64">
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
                   additional.type === "quantity_multiplier" ? "Precio unidad" :
                   additional.type === "capacity_divider" ? `Por capacidad (${additional.capacity_value || '?'} uds)` : "Personalizado"}
                </div>
              </div>
              <div className="w-28" />
              <div className="flex items-center gap-1 w-24">
                {additional.isCustom ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={additional.value}
                    onChange={(e) => updateAdditionalValue(additional.id, parseFloat(e.target.value) || 0)}
                    className="w-full h-9"
                  />
                ) : (
                  <div className="w-full h-9 flex items-center justify-end px-3 border rounded bg-muted/50">
                    <span className="font-medium">{additional.value}</span>
                  </div>
                )}
                <span className="text-sm text-muted-foreground">
                  {additional.type === "net_amount" ? "€" : 
                   additional.type === "capacity_divider" ? "€/ud" : "x"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
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
        <Select value={customType} onValueChange={(value: "net_amount" | "quantity_multiplier" | "capacity_divider") => setCustomType(value)}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="net_amount">Importe</SelectItem>
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