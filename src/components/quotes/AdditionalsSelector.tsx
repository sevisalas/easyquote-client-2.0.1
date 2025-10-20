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
  type: "net_amount" | "quantity_multiplier"
  default_value: number
  is_discount: boolean
}

interface SelectedAdditional {
  id: string
  name: string
  type: "net_amount" | "quantity_multiplier" | "custom"
  value: number
  isCustom?: boolean
  is_discount?: boolean
}

interface AdditionalsSelectorProps {
  selectedAdditionals: SelectedAdditional[]
  onChange: (additionals: SelectedAdditional[]) => void
}

export default function AdditionalsSelector({ selectedAdditionals, onChange }: AdditionalsSelectorProps) {
  const [newAdditionalId, setNewAdditionalId] = useState<string>("")
  const [newAdditionalValue, setNewAdditionalValue] = useState<number>(0)
  const [customName, setCustomName] = useState("")
  const [customValue, setCustomValue] = useState(0)
  const [customType, setCustomType] = useState<"net_amount" | "quantity_multiplier">("net_amount")

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
        type: (item.type as "net_amount" | "quantity_multiplier") || "net_amount",
        default_value: item.default_value || 0,
        is_discount: item.is_discount || false
      }))
    }
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
      type: additional.type,
      value: newAdditionalValue,
      is_discount: additional.is_discount || false
    }

    onChange([...selectedAdditionals, newSelected])
    setNewAdditionalId("")
    setNewAdditionalValue(0)
  }

  const addCustomAdditional = () => {
    if (!customName.trim()) return

    const customId = `custom_${Date.now()}`
    const newCustom: SelectedAdditional = {
      id: customId,
      name: customName.trim(),
      type: customType,
      value: customValue,
      isCustom: true
    }

    onChange([...selectedAdditionals, newCustom])
    setCustomName("")
    setCustomValue(0)
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
            <div key={additional.id} className="flex items-center gap-2 p-1.5 border rounded max-w-fit">
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
                  {additional.type === "net_amount" ? "Importe neto" : "Precio unidad"}
                </div>
              </div>
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
                  {additional.type === "net_amount" ? "€" : "x"}
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
          <Select 
            value={newAdditionalId} 
            onValueChange={(value) => {
              setNewAdditionalId(value)
              const additional = availableAdditionals.find(a => a.id === value)
              if (additional) {
                setNewAdditionalValue(additional.default_value)
              }
            }}
          >
            <SelectTrigger className="flex-1 h-9 justify-start">
              <SelectValue placeholder="Selecciona un ajuste..." />
            </SelectTrigger>
            <SelectContent>
              {availableAdditionals.map((additional) => (
                <SelectItem key={additional.id} value={additional.id}>
                  {additional.name} ({additional.type === "net_amount" ? "Importe" : "Precio ud."})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addPredefinedAdditional} disabled={!newAdditionalId} className="h-9 px-4 min-w-[90px]">
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>
      )}

      {/* Add Custom Additional */}
      <div className="flex gap-2 items-center">
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Concepto personalizado"
          className="w-64 h-9"
        />
        <Select value={customType} onValueChange={(value: "net_amount" | "quantity_multiplier") => setCustomType(value)}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="net_amount">Importe</SelectItem>
            <SelectItem value="quantity_multiplier">Precio ud.</SelectItem>
          </SelectContent>
        </Select>
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
          className="h-9 px-4 min-w-[90px]"
        >
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>
    </div>
  )
}