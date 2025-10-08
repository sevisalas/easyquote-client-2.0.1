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
}

interface SelectedAdditional {
  id: string
  name: string
  type: "net_amount" | "quantity_multiplier" | "custom"
  value: number
  isCustom?: boolean
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
    queryKey: ["additionals"],
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
        default_value: item.default_value || 0
      }))
    }
  })

  const addPredefinedAdditional = () => {
    if (!newAdditionalId) return

    const additional = availableAdditionals.find(a => a.id === newAdditionalId)
    if (!additional) return

    // Check if already added
    if (selectedAdditionals.some(sa => sa.id === additional.id)) return

    const newSelected: SelectedAdditional = {
      id: additional.id,
      name: additional.name,
      type: additional.type,
      value: newAdditionalValue
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

  // Filter available additionals to exclude already selected ones
  const unselectedAdditionals = availableAdditionals.filter(
    additional => !selectedAdditionals.some(sa => sa.id === additional.id)
  )

  return (
    <div className="space-y-4">
      {/* Selected Additionals */}
      {selectedAdditionals.length > 0 && (
        <div className="space-y-2">
          {selectedAdditionals.map((additional) => (
            <div key={additional.id} className="flex items-center gap-2 p-2 border rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium">{additional.name}</div>
                <div className="text-xs text-muted-foreground">
                  {additional.type === "net_amount" ? "Importe neto" : "Precio unidad"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={additional.value}
                  onChange={(e) => updateAdditionalValue(additional.id, parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  {additional.type === "net_amount" ? "€" : "x"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAdditional(additional.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Predefined Additional */}
      {unselectedAdditionals.length > 0 && (
        <div className="flex gap-2">
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
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecciona un ajuste..." />
            </SelectTrigger>
            <SelectContent>
              {unselectedAdditionals.map((additional) => (
                <SelectItem key={additional.id} value={additional.id}>
                  {additional.name} ({additional.type === "net_amount" ? "Importe" : "Precio ud."})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {newAdditionalId && (
            <div className="flex items-center gap-1 w-32">
              <Input
                type="number"
                step="0.01"
                value={newAdditionalValue}
                onChange={(e) => setNewAdditionalValue(parseFloat(e.target.value) || 0)}
                placeholder="Valor"
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">€</span>
            </div>
          )}
          <Button onClick={addPredefinedAdditional} disabled={!newAdditionalId} className="w-28">
            <Plus className="h-4 w-4 mr-2" />
            Añadir
          </Button>
        </div>
      )}

      {/* Add Custom Additional */}
      <div className="flex gap-2">
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Concepto personalizado"
          className="flex-1"
        />
        <Select value={customType} onValueChange={(value: "net_amount" | "quantity_multiplier") => setCustomType(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="net_amount">Importe</SelectItem>
            <SelectItem value="quantity_multiplier">Precio ud.</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 w-32">
          <Input
            type="number"
            step="0.01"
            value={customValue}
            onChange={(e) => setCustomValue(parseFloat(e.target.value) || 0)}
            placeholder="Valor"
            className="w-full"
          />
          <span className="text-sm text-muted-foreground">€</span>
        </div>
        <Button 
          onClick={addCustomAdditional} 
          disabled={!customName.trim()}
          className="w-28"
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir
        </Button>
      </div>
    </div>
  )
}