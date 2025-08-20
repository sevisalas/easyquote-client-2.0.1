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
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2 } from "lucide-react"

interface Additional {
  id: string
  name: string
  description: string | null
  type: "net_amount" | "quantity_multiplier"
  default_value: number
  created_at: string
  updated_at: string
}

interface AdditionalForm {
  name: string
  description: string
  type: "net_amount" | "quantity_multiplier"
  default_value: number
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
    type: "net_amount",
    default_value: 0
  })

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: additionals = [], isLoading } = useQuery({
    queryKey: ["additionals"],
    queryFn: fetchAdditionals
  })

  const createMutation = useMutation({
    mutationFn: async (newAdditional: AdditionalForm) => {
      const { data, error } = await supabase
        .from("additionals")
        .insert([newAdditional])
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
      type: "net_amount",
      default_value: 0
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
      type: additional.type,
      default_value: additional.default_value
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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ajustes</h1>
          <p className="text-muted-foreground">
            Gestiona los ajustes de presupuesto que se pueden aplicar a artículos o al subtotal del presupuesto
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
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
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value: "net_amount" | "quantity_multiplier") => 
                    setForm({ ...form, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net_amount">Importe neto</SelectItem>
                    <SelectItem value="quantity_multiplier">Multiplicador por cantidad</SelectItem>
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

      <div className="grid gap-4">
        {additionals.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <p>No hay ajustes configurados</p>
                <p className="text-sm">Crea tu primer ajuste de presupuesto para empezar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          additionals.map((additional) => (
            <Card key={additional.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{additional.name}</CardTitle>
                    <CardDescription>{additional.description}</CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(additional)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(additional.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Tipo:</p>
                    <p>{additional.type === "net_amount" ? "Importe Neto" : "Multiplicador por Cantidad"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Valor por defecto:</p>
                    <p>€{additional.default_value.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}