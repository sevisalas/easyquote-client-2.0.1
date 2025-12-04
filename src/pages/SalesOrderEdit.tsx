import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useSalesOrders, SalesOrder, SalesOrderItem } from "@/hooks/useSalesOrders";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import QuoteAdditionalsSelector from "@/components/quotes/QuoteAdditionalsSelector";
import { supabase } from "@/integrations/supabase/client";
import QuoteItem from "@/components/quotes/QuoteItem";

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

type SelectedAdditional = {
  id: string;
  name: string;
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom";
  value: number;
  isCustom?: boolean;
};

export default function SalesOrderEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { 
    fetchSalesOrderById, 
    fetchSalesOrderItems,
    recalculateSalesOrderTotals 
  } = useSalesOrders();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [orderAdditionals, setOrderAdditionals] = useState<SelectedAdditional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    description: "",
    notes: "",
    delivery_date: "",
  });
  const [hasToken] = useState(true);

  useEffect(() => {
    if (id) {
      loadOrderData();
    }
  }, [id]);

  const loadOrderData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const orderData = await fetchSalesOrderById(id);
      if (!orderData) {
        toast.error("Pedido no encontrado");
        navigate("/pedidos");
        return;
      }

      if (orderData.status !== 'draft') {
        toast.error("Solo se pueden editar pedidos en estado Borrador");
        navigate(`/pedidos/${id}`);
        return;
      }

      setOrder(orderData);
      setFormData({
        customer_id: orderData.customer_id || "",
        description: orderData.description || "",
        notes: orderData.notes || "",
        delivery_date: orderData.delivery_date || "",
      });

      const itemsData = await fetchSalesOrderItems(id);
      setItems(itemsData);

      // Load existing additionals
      const { data: additionalsData, error: additionalsError } = await supabase
        .from("sales_order_additionals")
        .select("*")
        .eq("sales_order_id", id);

      if (additionalsError) {
        console.error("Error loading additionals:", additionalsError);
      } else if (additionalsData && additionalsData.length > 0) {
        const mappedAdditionals: SelectedAdditional[] = additionalsData.map(a => ({
          id: a.additional_id || a.id,
          name: a.name,
          type: a.type as SelectedAdditional["type"],
          value: a.value,
          isCustom: !a.additional_id,
        }));
        setOrderAdditionals(mappedAdditionals);
      }
    } catch (error) {
      console.error("Error loading order:", error);
      toast.error("Error al cargar el pedido");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !order) return;

    setSaving(true);
    try {
      // First prepare additionals data to validate before making any updates
      let additionalsData: any[] = [];
      if (orderAdditionals.length > 0) {
        additionalsData = orderAdditionals.map(additional => {
          // Extract original UUID from composite ID (format: "uuid_timestamp")
          let originalId = additional.id;
          if (!additional.isCustom && additional.id.includes('_')) {
            originalId = additional.id.split('_')[0];
          }
          
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!additional.isCustom && !uuidRegex.test(originalId)) {
            console.warn(`Invalid additional_id format: ${originalId}, setting to null`);
            originalId = null;
          }
          
          return {
            sales_order_id: id,
            additional_id: additional.isCustom ? null : originalId,
            name: additional.name,
            type: additional.type,
            value: additional.value,
            is_discount: false,
          };
        });
      }

      // Delete existing additionals first
      const { error: deleteError } = await supabase
        .from("sales_order_additionals")
        .delete()
        .eq("sales_order_id", id);

      if (deleteError) throw deleteError;

      // Insert new additionals if any
      if (additionalsData.length > 0) {
        const { error: additionalsError } = await supabase
          .from("sales_order_additionals")
          .insert(additionalsData);

        if (additionalsError) throw additionalsError;
      }

      // Only update order data after additionals are successfully saved
      const { error } = await supabase
        .from("sales_orders")
        .update({
          customer_id: formData.customer_id || null,
          description: formData.description || null,
          notes: formData.notes || null,
          delivery_date: formData.delivery_date || null,
        })
        .eq("id", id);

      if (error) throw error;

      // Recalculate totals
      await recalculateSalesOrderTotals(id);

      toast.success("Pedido actualizado correctamente");
      navigate(`/pedidos/${id}`);
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Error al guardar el pedido");
      // Reload data to restore original state after error
      await loadOrderData();
    } finally {
      setSaving(false);
    }
  };

  const handleItemChange = async (itemId: string | number, snapshot: any) => {
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) return;

    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      product_id: snapshot.productId || updatedItems[itemIndex].product_id,
      product_name: snapshot.itemDescription || updatedItems[itemIndex].product_name,
      prompts: snapshot.prompts,
      outputs: snapshot.outputs,
      multi: snapshot.multi,
      description: snapshot.itemDescription,
      price: snapshot.price?.total || snapshot.price || 0,
    };
    setItems(updatedItems);
  };

  const handleItemFinish = async (itemId: string | number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !id) return;

    if (!item.product_id) {
      toast.error("Debe seleccionar un producto");
      return;
    }

    try {
      const { error } = await supabase
        .from("sales_order_items")
        .update({
          product_id: item.product_id,
          product_name: item.product_name || item.product_id,
          prompts: item.prompts,
          outputs: item.outputs,
          multi: item.multi,
          description: item.description,
          price: item.price,
        })
        .eq("id", item.id);

      if (error) throw error;

      await recalculateSalesOrderTotals(id);
      
      const { data: updatedOrder } = await supabase
        .from("sales_orders")
        .select("final_price")
        .eq("id", id)
        .single();
      
      if (updatedOrder && order) {
        setOrder({ ...order, final_price: updatedOrder.final_price });
      }
      
      toast.success("Artículo actualizado");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Error al actualizar el artículo");
    }
  };

  const handleRemoveItem = async (itemId: string | number) => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from("sales_order_items")
        .delete()
        .eq("id", String(itemId));

      if (error) throw error;

      await recalculateSalesOrderTotals(id);
      
      setItems(items.filter(item => item.id !== itemId));
      
      const { data: updatedOrder } = await supabase
        .from("sales_orders")
        .select("final_price")
        .eq("id", id)
        .single();
      
      if (updatedOrder && order) {
        setOrder({ ...order, final_price: updatedOrder.final_price });
      }
      
      toast.success("Artículo eliminado");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Error al eliminar el artículo");
    }
  };

  const handleAddItem = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("sales_order_items")
        .insert({
          sales_order_id: id,
          product_name: "Nuevo producto",
          price: 0,
          quantity: 1,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setItems([...items, data as SalesOrderItem]);
      }
      
      toast.success("Artículo añadido");
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Error al añadir el artículo");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with title and actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Pedido: {order.order_number}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button onClick={() => navigate(`/pedidos/${id}`)} size="sm" variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Order Details - Compact Layout */}
      <Card>
        <CardContent className="space-y-2 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <CustomerSelector
                value={formData.customer_id}
                onValueChange={(customerId) => setFormData({ ...formData, customer_id: customerId })}
                label="cliente"
                placeholder="Seleccionar cliente..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery_date" className="text-xs">
                Fecha de Entrega
              </Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs">
                Descripción
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del pedido"
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">
                Notas
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Artículos del Pedido</CardTitle>
            </div>
            <Button onClick={handleAddItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Añadir Artículo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <QuoteItem
              key={item.id}
              id={item.id}
              hasToken={hasToken}
              shouldExpand={false}
              initialData={{
                productId: item.product_id || "",
                prompts: (item.prompts as Record<string, any>) || {},
                outputs: (item.outputs as any[]) || [],
                multi: item.multi,
                itemDescription: item.description || "",
                price: item.price,
                isFinalized: true,
              }}
              onChange={handleItemChange}
              onRemove={handleRemoveItem}
              onFinishEdit={handleItemFinish}
            />
          ))}

          <Separator />

          {/* Additionals Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ajustes sobre el pedido</h3>
            <QuoteAdditionalsSelector
              selectedAdditionals={orderAdditionals}
              onChange={setOrderAdditionals}
            />
          </div>

          <Separator />

          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{fmtEUR(order.final_price)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
