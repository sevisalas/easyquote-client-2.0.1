import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2 } from "lucide-react"

interface Additional {
  id: string
  name: string
  description: string | null
  assignment_type: "article" | "quote"
  type: "net_amount" | "quantity_multiplier" | "percentage"
  default_value: number
  is_discount: boolean
  created_at: string
  updated_at: string
}

interface AdditionalForm {
  name: string
  description: string
  assignment_type: "article" | "quote"
  type: "net_amount" | "quantity_multiplier" | "percentage"
  default_value: number
  is_discount: boolean
}

const fetchAdditionals = async (): Promise<Additional[]> => {
  const { data, error } = await supabase
    .from("additionals")
    .select("*")
    .order("name")

  if (error) {
    console.error("Error fetching additionals:", error)
    throw error
  }

  return (data || []) as Additional[]
}

export default function Additionals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAdditional, setEditingAdditional] = useState<Additional | null>(null)
  const [form, setForm] = useState<AdditionalForm>({
    name: "",
    description: "",
    assignment_type: "article",
    type: "net_amount",
    default_value: 0,
    is_discount: false
  })

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: additionals = [], isLoading } = useQuery({
    queryKey: ["additionals"],
    queryFn: fetchAdditionals
  })

  const createMutation = useMutation({
    mutationFn: async (newAdditional: AdditionalForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("additionals")
        .insert({
          ...newAdditional,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["additionals"] })
      setIsDialogOpen(false)
      resetForm()
      toast({ title: "Ajuste creado correctamente" })
    },
    onError: (error) => {
      console.error("Error creating additional:", error)
      toast({ title: "Error al crear el ajuste", variant: "destructive" })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<AdditionalForm>) => {
      const { data, error } = await supabase
        .from("additionals")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["additionals"] })
      setIsDialogOpen(false)
      setEditingAdditional(null)
      resetForm()
      toast({ title: "Ajuste actualizado correctamente" })
    },
    onError: (error) => {
      console.error("Error updating additional:", error)
      toast({ title: "Error al actualizar el ajuste", variant: "destructive" })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("additionals")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["additionals"] })
      toast({ title: "Ajuste eliminado correctamente" })
    },
    onError: (error) => {
      console.error("Error deleting additional:", error)
      toast({ title: "Error al eliminar el ajuste", variant: "destructive" })
    }
  })

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      assignment_type: "article",
      type: "net_amount",
      default_value: 0,
      is_discount: false
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingAdditional) {
      updateMutation.mutate({ id: editingAdditional.id, ...form })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleEdit = (additional: Additional) => {
    setEditingAdditional(additional)
    setForm({
      name: additional.name,
      description: additional.description || "",
      assignment_type: additional.assignment_type,
      type: additional.type,
      default_value: additional.default_value,
      is_discount: additional.is_discount || false
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este ajuste?")) {
      deleteMutation.mutate(id)
    }
  }

  const openCreateDialog = () => {
    setEditingAdditional(null)
    resetForm()
    setIsDialogOpen(true)
  }

  if (isLoading) {
    return <div>Cargando...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los ajustes de presupuesto que se pueden aplicar a artículos o al subtotal del presupuesto
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Crear nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAdditional ? "Editar ajuste" : "Crear nuevo ajuste"}
              </DialogTitle>
              <DialogDescription>
                {editingAdditional 
                  ? "Modifica los datos del ajuste"
                  : "Crea un nuevo ajuste que podrás aplicar a artículos y presupuestos"
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="assignment_type">Asignar a</Label>
                <Select
                  value={form.assignment_type}
                  onValueChange={(value: "article" | "quote") => 
                    setForm({ ...form, assignment_type: value, type: "net_amount" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">Artículo</SelectItem>
                    <SelectItem value="quote">Presupuesto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value: "net_amount" | "quantity_multiplier" | "percentage") => 
                    setForm({ ...form, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="net_amount">Importe neto</SelectItem>
                     {form.assignment_type === "article" ? (
                       <SelectItem value="quantity_multiplier">Importe unitario (por cantidad)</SelectItem>
                     ) : (
                       <SelectItem value="percentage">Porcentaje sobre subtotal</SelectItem>
                     )}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="default_value">Valor por defecto</Label>
                <Input
                  id="default_value"
                  type="number"
                  step="0.01"
                  value={form.default_value}
                  onChange={(e) => setForm({ ...form, default_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_discount"
                  checked={form.is_discount}
                  onCheckedChange={(checked) => setForm({ ...form, is_discount: checked as boolean })}
                />
                <Label 
                  htmlFor="is_discount" 
                  className="text-sm font-normal cursor-pointer"
                >
                  ¿Considerar este ajuste como "Descuento"?
                </Label>
              </div>
            </form>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingAdditional ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2">
        {additionals.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">No hay ajustes configurados</p>
                <p className="text-xs">Crea tu primer ajuste de presupuesto para empezar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          additionals.map((additional) => (
            <Card key={additional.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{additional.name}</h3>
                  {additional.description && (
                    <p className="text-xs text-muted-foreground truncate">{additional.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(additional)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDelete(additional.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Asignar a:</span>
                    <span className="font-medium">{additional.assignment_type === "article" ? "Artículo" : "Presupuesto"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium">
                      {additional.type === "net_amount" 
                        ? "Importe Neto" 
                        : additional.type === "quantity_multiplier" 
                        ? "Importe Unitario"
                        : "Porcentaje del Subtotal"
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">
                      {additional.type === "percentage" 
                        ? `${additional.default_value}%` 
                        : `€${additional.default_value.toFixed(2)}`
                      }
                    </span>
                  </div>
                  {additional.is_discount && (
                    <div className="flex items-center gap-1 text-primary ml-auto">
                      <span className="font-medium">✓ Descuento</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}