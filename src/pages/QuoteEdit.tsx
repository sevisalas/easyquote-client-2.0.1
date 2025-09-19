import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit } from "lucide-react";
import { format } from "date-fns";
import QuoteAdditionalsSelector from "@/components/quotes/QuoteAdditionalsSelector";
import QuoteItem from "@/components/quotes/QuoteItem";

interface QuoteItem {
  id: string;
  name?: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total_price?: number;
  isFromSelections?: boolean;
  // QuoteItem component compatibility
  productId?: string;
  prompts?: Record<string, any>;
  outputs?: any[];
  price?: number;
  multi?: any;
  itemDescription?: string;
  itemAdditionals?: any[];
}

interface SelectedQuoteAdditional {
  id: string
  name: string
  type: "net_amount" | "quantity_multiplier" | "custom"
  value: number
  isCustom?: boolean
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id?: string;
  product_name?: string;
  title?: string;
  description?: string;
  notes?: string;
  status: string;
  valid_until?: string;
  subtotal: number;
  final_price: number;
  items?: QuoteItem[];
  selections?: any;
  customer?: { name: string };
  quote_additionals?: any[];
}

const fetchQuote = async (id: string): Promise<Quote> => {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      items:quote_items(*),
      customer:customers(name),
      quote_additionals:quote_additionals(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Presupuesto no encontrado');
  
  console.log('Quote data loaded:', data); // Debug log
  return data as any;
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
  const [quoteAdditionals, setQuoteAdditionals] = useState<SelectedQuoteAdditional[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Check if user has EasyQuote token
  const hasToken = Boolean(localStorage.getItem("easyquote_token"));

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
      });
      
      console.log('Quote items:', quote.items); // Debug log
      console.log('Quote selections:', quote.selections); // Debug log
      console.log('Quote additionals:', quote.quote_additionals); // Debug log
      
      // Load quote additionals
      if (quote.quote_additionals && Array.isArray(quote.quote_additionals)) {
        const additionals = quote.quote_additionals.map((additional: any) => ({
          id: additional.additional_id || additional.id,
          name: additional.name,
          type: additional.type || 'net_amount',
          value: additional.value || 0,
          isCustom: !additional.additional_id
        }));
        setQuoteAdditionals(additionals);
      }
      
      // Combinar items y selections para mostrar todos los productos
      const allItems: QuoteItem[] = [];
      
      // Agregar items de la tabla quote_items
      if (quote.items && quote.items.length > 0) {
        const dbItems = quote.items.map((item: any) => ({
          id: item.id,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          total_price: item.total_price,
          // QuoteItem compatibility
          productId: item.product_id || '',
          prompts: typeof item.prompts === 'object' ? item.prompts : {},
          outputs: Array.isArray(item.outputs) ? item.outputs : [],
          price: item.total_price || item.subtotal,
          multi: item.multi || 1,
          itemDescription: item.product_name,
          itemAdditionals: Array.isArray(item.item_additionals) ? item.item_additionals : [],
        }));
        allItems.push(...dbItems);
      }
      
      // Agregar items del campo selections (formato anterior)
      if (Array.isArray(quote.selections) && quote.selections.length > 0) {
        const selectionItems = quote.selections.map((selection: any, index: number) => ({
          id: `selection-${index}`,
          product_name: selection.itemDescription || 
            (selection.outputs && selection.outputs.find((o: any) => o.name === 'PRODUCTO')?.value) ||
            `Artículo ${index + 1}`,
          description: selection.itemDescription || '',
          quantity: 1,
          unit_price: selection.price || 0,
          subtotal: selection.price || 0,
          isFromSelections: true, // Marcar como proveniente de selections
          // QuoteItem compatibility
          productId: selection.productId || '',
          prompts: selection.prompts || {},
          outputs: selection.outputs || [],
          price: selection.price || 0,
          multi: selection.multi || 1,
          itemDescription: selection.itemDescription || '',
          itemAdditionals: selection.itemAdditionals || [],
        }));
        allItems.push(...selectionItems);
      }
      
      setItems(allItems);
    }
  }, [quote]);

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: Partial<Quote>) => {
      console.log('Updating quote with data:', data); // Debug log
      console.log('Items to update:', items); // Debug log
      console.log('Additionals to update:', quoteAdditionals); // Debug log
      
      const { error } = await supabase
        .from('quotes')
        .update({
          customer_id: data.customer_id,
          title: data.title,
          description: data.description,
          notes: data.notes,
          status: data.status,
          valid_until: data.valid_until,
          subtotal: calculateSubtotal(),
          final_price: calculateSubtotal(),
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
          product_id: item.productId || null,
          prompts: item.prompts || {},
          outputs: item.outputs || [],
          multi: item.multi || 1,
          item_additionals: item.itemAdditionals || [],
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Update quote additionals
      await supabase
        .from('quote_additionals')
        .delete()
        .eq('quote_id', id);

      if (quoteAdditionals.length > 0) {
        const additionalsToInsert = quoteAdditionals.map((additional) => ({
          quote_id: id,
          additional_id: additional.isCustom ? null : additional.id,
          name: additional.name,
          type: additional.type,
          value: additional.value,
        }));

        const { error: additionalsError } = await supabase
          .from('quote_additionals')
          .insert(additionalsToInsert);

        if (additionalsError) throw additionalsError;
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
    return calculateSubtotal();
  };

  const handleInputChange = (field: keyof Quote, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (itemId: string | number, snapshot: any) => {
    setItems(prev => prev.map((item, index) => 
      (item.id === itemId || index.toString() === itemId.toString()) 
        ? {
            ...item,
            product_name: snapshot.itemDescription || item.product_name,
            description: snapshot.itemDescription || item.description,
            quantity: 1, // QuoteItem manages quantity differently
            unit_price: snapshot.price || 0,
            subtotal: snapshot.price || 0,
            total_price: snapshot.price || 0,
            // Update QuoteItem fields
            productId: snapshot.productId,
            prompts: snapshot.prompts,
            outputs: snapshot.outputs,
            price: snapshot.price,
            multi: snapshot.multi,
            itemDescription: snapshot.itemDescription,
            itemAdditionals: snapshot.itemAdditionals,
          }
        : item
    ));
  };

  const handleItemRemove = (itemId: string | number) => {
    setItems(prev => prev.filter((item, index) => 
      !(item.id === itemId || index.toString() === itemId.toString())
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
      // QuoteItem compatibility
      productId: '',
      prompts: {},
      outputs: [],
      price: 0,
      multi: 1,
      itemDescription: 'Nuevo artículo',
      itemAdditionals: [],
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleSave = () => {
    updateQuoteMutation.mutate(formData);
  };

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
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
              <CardTitle className="text-xl">Presupuesto: {quote.quote_number}</CardTitle>
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
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customer">cliente</Label>
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
              <Label htmlFor="status">estado</Label>
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
              <Label htmlFor="title">título</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Título del presupuesto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_until">válido hasta</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until || ''}
                onChange={(e) => handleInputChange('valid_until', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="description">descripción</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descripción del presupuesto"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">notas</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Notas adicionales"
                rows={2}
              />
            </div>
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
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id || index} className="bg-card border border-border rounded-lg p-3 border-r-4 border-r-secondary hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-foreground">Producto {index + 1}</h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEditItem(index)}
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:bg-primary/10"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleItemRemove(item.id || index)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {editingItemIndex === index ? (
                  <QuoteItem
                    hasToken={hasToken}
                    id={index}
                    initialData={{
                      productId: item.productId || '',
                      prompts: item.prompts || {},
                      outputs: item.outputs || [],
                      price: item.price || item.unit_price,
                      multi: item.multi || 1,
                      itemDescription: item.itemDescription || item.product_name,
                      itemAdditionals: item.itemAdditionals || [],
                    }}
                    onChange={handleItemChange}
                    onRemove={() => {}}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Descripción</Label>
                        <p className="text-foreground">{item.itemDescription || item.product_name || "Sin descripción"}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Precio</Label>
                        <p className="text-foreground font-medium">{fmtEUR(item.price || item.unit_price * item.quantity || 0)}</p>
                      </div>
                    </div>
                  </div>
                )}
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
              <Separator className="my-4" />
              
              <div className="bg-card rounded-lg p-4 border border-border border-r-4 border-r-secondary hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-foreground">Total del Presupuesto:</span>
                  <span className="text-2xl font-bold text-secondary">{fmtEUR(calculateSubtotal())}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quote Additionals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Adicionales del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteAdditionalsSelector
            selectedAdditionals={quoteAdditionals}
            onChange={setQuoteAdditionals}
          />
        </CardContent>
      </Card>

    </div>
  );
}