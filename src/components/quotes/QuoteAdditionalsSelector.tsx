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
  type: "net_amount" | "quantity_multiplier" | "percentage"
  default_value: number
}

interface SelectedQuoteAdditional {
  id: string
  name: string
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom"
  value: number
  isCustom?: boolean
}

interface QuoteAdditionalsSelectorProps {
  selectedAdditionals: SelectedQuoteAdditional[]
  onChange: (additionals: SelectedQuoteAdditional[]) => void
}

export default function QuoteAdditionalsSelector({ selectedAdditionals, onChange }: QuoteAdditionalsSelectorProps) {
  const [newAdditionalId, setNewAdditionalId] = useState<string>("")
  const [customName, setCustomName] = useState("")
  const [customValue, setCustomValue] = useState(0)
  const [customType, setCustomType] = useState<"net_amount" | "quantity_multiplier" | "percentage">("net_amount")

  const { data: availableAdditionals = [] } = useQuery({
    queryKey: ["additionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("*")
        .eq("assignment_type", "quote")
        .order("name")

      if (error) throw error
      return data as Additional[]
    }
  })

  const addPredefinedAdditional = () => {
    if (!newAdditionalId) return

    const additional = availableAdditionals.find(a => a.id === newAdditionalId)
    if (!additional) return

    // Check if already added
    if (selectedAdditionals.some(sa => sa.id === additional.id)) return

    const newSelected: SelectedQuoteAdditional = {
      id: additional.id,
      name: additional.name,
      type: additional.type,
      value: additional.default_value
    }

    onChange([...selectedAdditionals, newSelected])
    setNewAdditionalId("")
  }

  const addCustomAdditional = () => {
    if (!customName.trim()) return

    const customId = `custom_${Date.now()}`
    const newCustom: SelectedQuoteAdditional = {
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
        <div className="space-y-3">
          <h4 className="font-medium">Ajustes del Presupuesto</h4>
          {selectedAdditionals.map((additional) => (
            <Card key={additional.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {additional.name}
                      {additional.isCustom && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Personalizado
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {additional.type === "net_amount" 
                        ? "Importe neto" 
                        : additional.type === "quantity_multiplier" 
                        ? "Por cantidad total" 
                        : "Porcentaje sobre subtotal"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAdditional(additional.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`quote-value-${additional.id}`} className="text-sm">
                    Valor:
                  </Label>
                  <Input
                    id={`quote-value-${additional.id}`}
                    type="number"
                    step="0.01"
                    value={additional.value}
                    onChange={(e) => updateAdditionalValue(additional.id, parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    {additional.type === "net_amount" 
                      ? "€" 
                      : additional.type === "quantity_multiplier" 
                      ? "x" 
                      : "%"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Predefined Additional */}
      {unselectedAdditionals.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Añadir Ajuste Predefinido</h4>
          <div className="flex gap-2">
            <Select value={newAdditionalId} onValueChange={setNewAdditionalId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un ajuste..." />
              </SelectTrigger>
              <SelectContent>
                {unselectedAdditionals.map((additional) => (
                  <SelectItem key={additional.id} value={additional.id}>
                    {additional.name} ({
                      additional.type === "net_amount" 
                        ? "Importe" 
                        : additional.type === "quantity_multiplier" 
                        ? "Multiplicador" 
                        : "Porcentaje"
                    })
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addPredefinedAdditional} disabled={!newAdditionalId}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Custom Additional */}
      <div className="space-y-3">
        <h4 className="font-medium">Añadir Ajuste Personalizado</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="quote-custom-name" className="text-sm">Concepto</Label>
            <Input
              id="quote-custom-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ej: Descuento especial"
            />
          </div>
          <div>
            <Label htmlFor="quote-custom-type" className="text-sm">Tipo</Label>
            <Select value={customType} onValueChange={(value: "net_amount" | "quantity_multiplier" | "percentage") => setCustomType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="net_amount">Importe Neto</SelectItem>
                <SelectItem value="quantity_multiplier">Multiplicador por Cantidad Total</SelectItem>
                <SelectItem value="percentage">Porcentaje sobre Subtotal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quote-custom-value" className="text-sm">Valor</Label>
            <Input
              id="quote-custom-value"
              type="number"
              step="0.01"
              value={customValue}
              onChange={(e) => setCustomValue(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={addCustomAdditional} 
              disabled={!customName.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}