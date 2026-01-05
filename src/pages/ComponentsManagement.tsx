import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Boxes, Search, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";

interface Component {
  id: string;
  organization_id: string;
  name: string;
  component_type: string;
  easyquote_product_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EasyQuoteProduct {
  id: string;
  name: string;
  isActive: boolean;
}

const COMPONENT_TYPES = [
  { value: 'cubierta', label: 'Cubierta' },
  { value: 'interior', label: 'Interior' },
  { value: 'sobrecubierta', label: 'Sobrecubierta' },
  { value: 'guardas', label: 'Guardas' },
  { value: 'encarte', label: 'Encarte' },
  { value: 'otro', label: 'Otro' },
];

export default function ComponentsManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    component_type: "otro",
    easyquote_product_id: "",
    description: "",
    is_active: true,
  });

  // Obtener organization_id del usuario
  const { data: organizationId } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Primero buscar si es owner de una organización
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)
        .maybeSingle();

      if (org) return org.id;

      // Si no, buscar membresía
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return member?.organization_id || null;
    }
  });

  // Obtener componentes
  const { data: components = [], isLoading: loadingComponents } = useQuery({
    queryKey: ['components', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      return data as Component[];
    },
    enabled: !!organizationId
  });

  // Obtener productos de EasyQuote
  const { data: easyquoteProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['easyquote-products-for-components'],
    queryFn: async () => {
      const { data, error } = await invokeEasyQuoteFunction<EasyQuoteProduct[]>('easyquote-products', {});
      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      return data || [];
    }
  });

  // Mutación para crear/actualizar componente
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organizationId) throw new Error('No organization');

      const payload = {
        ...data,
        organization_id: organizationId,
        easyquote_product_id: data.easyquote_product_id || null,
      };

      if (editingComponent) {
        const { error } = await supabase
          .from('components')
          .update(payload)
          .eq('id', editingComponent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('components')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      toast({ title: editingComponent ? "Componente actualizado" : "Componente creado" });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('components')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      toast({ title: "Componente eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingComponent(null);
    setFormData({
      name: "",
      component_type: "otro",
      easyquote_product_id: "",
      description: "",
      is_active: true,
    });
  };

  const handleEdit = (component: Component) => {
    setEditingComponent(component);
    setFormData({
      name: component.name,
      component_type: component.component_type,
      easyquote_product_id: component.easyquote_product_id || "",
      description: component.description || "",
      is_active: component.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredComponents = components.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.component_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProductName = (productId: string | null) => {
    if (!productId) return "—";
    const product = easyquoteProducts.find(p => p.id === productId);
    return product?.name || productId;
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'cubierta': return 'bg-blue-100 text-blue-800';
      case 'interior': return 'bg-green-100 text-green-800';
      case 'sobrecubierta': return 'bg-purple-100 text-purple-800';
      case 'guardas': return 'bg-orange-100 text-orange-800';
      case 'encarte': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Boxes className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Componentes</h1>
            <p className="text-muted-foreground text-sm">
              Piezas reutilizables para componer productos en presupuestos
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) handleCloseDialog();
          else setIsDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo componente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingComponent ? "Editar componente" : "Nuevo componente"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Cubierta Tapa Dura 350g"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de componente</Label>
                <Select
                  value={formData.component_type}
                  onValueChange={(value) => setFormData({ ...formData, component_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product">Producto EasyQuote (Excel)</Label>
                <Select
                  value={formData.easyquote_product_id}
                  onValueChange={(value) => setFormData({ ...formData, easyquote_product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin vincular</SelectItem>
                    {easyquoteProducts.filter(p => p.isActive).map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vincula este componente a un archivo Excel para calcular precios
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional del componente..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Activo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingComponent ? "Guardar cambios" : "Crear componente"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar componentes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredComponents.length} componente{filteredComponents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingComponents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay componentes creados</p>
              <p className="text-sm">Crea tu primer componente para empezar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Producto EasyQuote</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.map((component) => (
                  <TableRow key={component.id}>
                    <TableCell className="font-medium">
                      {component.name}
                      {component.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {component.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getTypeBadgeColor(component.component_type)}>
                        {COMPONENT_TYPES.find(t => t.value === component.component_type)?.label || component.component_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getProductName(component.easyquote_product_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={component.is_active ? "default" : "secondary"}>
                        {component.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(component)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('¿Eliminar este componente?')) {
                              deleteMutation.mutate(component.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
