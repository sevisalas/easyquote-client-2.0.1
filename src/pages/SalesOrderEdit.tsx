import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { useSalesOrders, SalesOrder, SalesOrderItem } from "@/hooks/useSalesOrders";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import { EditOrderItemDialog } from "@/components/sales/EditOrderItemDialog";
import { supabase } from "@/integrations/supabase/client";

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export default function SalesOrderEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { 
    fetchSalesOrderById, 
    fetchSalesOrderItems,
    updateSalesOrderItem,
    recalculateSalesOrderTotals 
  } = useSalesOrders();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    title: "",
    description: "",
    notes: "",
    delivery_date: "",
  });
  const [editingItem, setEditingItem] = useState<SalesOrderItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);

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
        title: orderData.title || "",
        description: orderData.description || "",
        notes: orderData.notes || "",
        delivery_date: orderData.delivery_date || "",
      });

      const itemsData = await fetchSalesOrderItems(id);
      setItems(itemsData);
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
      const { data, error } = await supabase
        .from("sales_orders")
        .update({
          customer_id: formData.customer_id || null,
          title: formData.title || null,
          description: formData.description || null,
          notes: formData.notes || null,
          delivery_date: formData.delivery_date || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Pedido actualizado correctamente");
      navigate(`/pedidos/${id}`);
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Error al guardar el pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleItemUpdate = async (itemId: string, updates: { quantity?: number; price?: number; description?: string }) => {
    setSavingItem(true);
    try {
      const success = await updateSalesOrderItem(itemId, updates);
      if (success && id) {
        await recalculateSalesOrderTotals(id);
        await loadOrderData();
        toast.success("Artículo actualizado");
      }
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Error al actualizar el artículo");
    } finally {
      setSavingItem(false);
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
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(`/pedidos/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Editar Pedido {order.order_number}</h1>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Pedido</CardTitle>
          <CardDescription>Información general del pedido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="customer">Cliente</Label>
            <CustomerSelector
              value={formData.customer_id}
              onValueChange={(customerId) => setFormData({ ...formData, customer_id: customerId })}
            />
          </div>

          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Título del pedido"
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción del pedido"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="delivery_date">Fecha de Entrega</Label>
            <Input
              id="delivery_date"
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artículos del Pedido</CardTitle>
          <CardDescription>Edita las cantidades y precios de los artículos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded">
                <div className="flex-1">
                  <div className="font-medium">{item.product_name}</div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  )}
                  <div className="text-sm mt-1">
                    Cantidad: {item.quantity} | Precio: {fmtEUR(item.price)} | Subtotal: {fmtEUR(item.quantity * item.price)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingItem(item)}
                >
                  Editar
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{fmtEUR(order.final_price)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingItem && (
        <EditOrderItemDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          onSave={handleItemUpdate}
          saving={savingItem}
        />
      )}
    </div>
  );
}
