import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

interface QuoteItem {
  id: string;
  name?: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total_price?: number;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id?: string;
  title?: string;
  description?: string;
  notes?: string;
  status: string;
  valid_until?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  final_price: number;
  items?: QuoteItem[];
  customer?: { name: string };
}

const fetchQuote = async (id: string): Promise<Quote> => {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      items:quote_items(*),
      customer:customers(name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Presupuesto no encontrado');
  
  console.log('Quote data loaded:', data); // Debug log
  return data;
};

const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data;
};

const statusOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'sent', label: 'Enviado' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' }
];

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export default function QuoteEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<Partial<Quote>>({});
  const [items, setItems] = useState<QuoteItem[]>([]);

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  useEffect(() => {
    if (quote) {
      console.log('Setting form data with quote:', quote); // Debug log
      setFormData({
        quote_number: quote.quote_number,
        customer_id: quote.customer_id,
        title: quote.title,
        description: quote.description,
        notes: quote.notes,
        status: quote.status,
        valid_until: quote.valid_until,
        discount_amount: quote.discount_amount,
        tax_amount: quote.tax_amount,
      });
      
      console.log('Quote items:', quote.items); // Debug log
      setItems(quote.items || []);
    }
  }, [quote]);

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: Partial<Quote>) => {
      console.log('Updating quote with data:', data); // Debug log
      console.log('Items to update:', items); // Debug log
      
      const { error } = await supabase
        .from('quotes')
        .update({
          customer_id: data.customer_id,
          title: data.title,
          description: data.description,
          notes: data.notes,
          status: data.status,
          valid_until: data.valid_until,
          discount_amount: data.discount_amount || 0,
          tax_amount: data.tax_amount || 0,
          subtotal: calculateSubtotal(),
          final_price: calculateTotal(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Delete existing items and insert new ones to simplify the update process
      await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', id);

      // Insert all current items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          quote_id: id,
          product_name: item.product_name,
          description: item.description || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
          total_price: item.quantity * item.unit_price,
          position: index,
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      toast.success('Presupuesto actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/presupuestos/${id}`);
    },
    onError: (error) => {
      toast.error('Error al actualizar el presupuesto');
      console.error('Error:', error);
    },
  });

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = formData.discount_amount || 0;
    const tax = formData.tax_amount || 0;
    return subtotal - discount + tax;
  };

  const handleInputChange = (field: keyof Quote, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map((item, i) => 
      i === index 
        ? { 
            ...item, 
            [field]: value,
            subtotal: field === 'quantity' || field === 'unit_price' 
              ? (field === 'quantity' ? value : item.quantity) * (field === 'unit_price' ? value : item.unit_price)
              : item.subtotal
          }
        : item
    ));
  };

  const addItem = () => {
    const newItem: QuoteItem = {
      id: `temp-${Date.now()}`,
      product_name: 'Nuevo artículo',
      description: '',
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    updateQuoteMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando presupuesto...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto py-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Presupuesto no encontrado</p>
            <Button onClick={() => navigate('/presupuestos')} className="mt-4">
              Volver a Presupuestos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Editar Presupuesto #{quote.quote_number}</CardTitle>
              <CardDescription className="text-sm">
                Modifica los detalles del presupuesto
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={updateQuoteMutation.isPending}
                size="sm"
              >
                {updateQuoteMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button onClick={() => navigate(`/presupuestos/${id}`)} size="sm" variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quote Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Información del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente</Label>
              <Select
                value={formData.customer_id || ''}
                onValueChange={(value) => handleInputChange('customer_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status || 'draft'}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Título del presupuesto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_until">Válido hasta</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until || ''}
                onChange={(e) => handleInputChange('valid_until', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descripción del presupuesto"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Notas adicionales"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Artículos del Presupuesto</CardTitle>
            <Button onClick={addItem} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir artículo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id || index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Artículo {index + 1}</h4>
                  <Button
                    onClick={() => removeItem(index)}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del producto</Label>
                    <Input
                      value={item.product_name}
                      onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                      placeholder="Nombre del producto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={item.description || ''}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Descripción del artículo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio unitario</Label>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="mt-4 text-right">
                  <p className="text-sm text-muted-foreground">
                    Subtotal: <span className="font-semibold">{fmtEUR(item.quantity * item.unit_price)}</span>
                  </p>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay artículos en este presupuesto</p>
                <Button onClick={addItem} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Añadir primer artículo
                </Button>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <>
              <Separator className="my-6" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount">Descuento (€)</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={formData.discount_amount || 0}
                    onChange={(e) => handleInputChange('discount_amount', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax">Impuestos (€)</Label>
                  <Input
                    id="tax"
                    type="number"
                    value={formData.tax_amount || 0}
                    onChange={(e) => handleInputChange('tax_amount', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total final</Label>
                  <div className="p-2 bg-muted rounded-md">
                    <p className="text-lg font-semibold">{fmtEUR(calculateTotal())}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-muted-foreground space-y-1">
                <p>Subtotal: {fmtEUR(calculateSubtotal())}</p>
                <p>Descuento: -{fmtEUR(formData.discount_amount || 0)}</p>
                <p>Impuestos: +{fmtEUR(formData.tax_amount || 0)}</p>
                <Separator className="my-2" />
                <p className="text-base font-semibold text-foreground">
                  Total: {fmtEUR(calculateTotal())}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}