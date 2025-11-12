import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Plus, Save, ArrowLeft, Download } from "lucide-react";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import QuoteItem from "@/components/quotes/QuoteItem";
import AdditionalsSelector from "@/components/quotes/AdditionalsSelector";
import QuoteAdditionalsSelector from "@/components/quotes/QuoteAdditionalsSelector";
import { getEasyQuoteToken } from "@/lib/easyquoteApi";

type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: number;
  itemDescription?: string;
  itemAdditionals?: any[];
  needsRecalculation?: boolean;
  isFinalized?: boolean;
};

type SelectedAdditional = {
  id: string;
  name: string;
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom";
  value: number;
  isCustom?: boolean;
};

export default function SalesOrderNew() {
  const navigate = useNavigate();

  // Form state
  const [customerId, setCustomerId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [items, setItems] = useState<Record<string | number, ItemSnapshot>>({});
  const [orderAdditionals, setOrderAdditionals] = useState<SelectedAdditional[]>([]);
  const [loading, setSaving] = useState(false);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [exportToHolded, setExportToHolded] = useState(false);

  // Holded integration
  const { isHoldedActive } = useHoldedIntegration();
  const { organization, membership, canAccessProduccion } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  // Check access
  useEffect(() => {
    if (!canAccessProduccion()) {
      navigate("/");
    }
  }, [canAccessProduccion, navigate]);

  // Generate next item ID
  const nextItemId = useMemo(() => Math.max(0, ...Object.keys(items).map(k => Number(k) || 0)) + 1, [items]);
  
  const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);

  // Check if all items are complete and finalized
  const allItemsComplete = useMemo(() => {
    const itemsArray = Object.values(items);
    if (itemsArray.length === 0) return true;
    return itemsArray.every(item => 
      item.productId && 
      item.price && 
      item.price > 0 && 
      item.isFinalized === true
    );
  }, [items]);
  
  const hasItemBeingEdited = useMemo(() => {
    return Object.values(items).some(item => 
      item.productId && !item.isFinalized
    );
  }, [items]);

  // Check and validate EasyQuote token
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      setTokenChecking(true);
      try {
        const token = await getEasyQuoteToken();
        setHasToken(!!token);
      } catch (error) {
        console.error("Error validating EasyQuote token:", error);
        setHasToken(false);
      } finally {
        setTokenChecking(false);
      }
    };
    
    validateToken();
  }, []);

  // Generate order number based on organization (same as quote approval)
  const generateOrderNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario no autenticado");

    const { data: orgMembers } = await supabase
      .from("organization_members")
      .select("user_id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMembers) {
      throw new Error("Usuario no pertenece a ninguna organización");
    }

    const { data: allOrgMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgMembers.organization_id);

    const userIds = allOrgMembers?.map(m => m.user_id) || [];

    // Count ALL orders from all organization members for this year (same sequence as quotes)
    const { count } = await supabase
      .from("sales_orders")
      .select("*", { count: "exact", head: true })
      .in("user_id", userIds)
      .like("order_number", `SO-${year}-%`);
    
    const nextNumber = (count || 0) + 1;
    return `SO-${year}-${String(nextNumber).padStart(4, "0")}`;
  };

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    
    Object.values(items).forEach(item => {
      if (typeof item.price === 'number') {
        subtotal += item.price;
      }
    })

    let additionalsTotal = 0;
    orderAdditionals.forEach(additional => {
      if (additional.type === 'net_amount') {
        additionalsTotal += additional.value;
      } else if (additional.type === 'quantity_multiplier') {
        additionalsTotal += additional.value;
      } else if (additional.type === 'percentage') {
        additionalsTotal += (subtotal * additional.value) / 100;
      }
    });
    
    const finalSubtotal = subtotal + additionalsTotal;
    const taxAmount = 0;
    const discountAmount = 0;
    const finalPrice = finalSubtotal + taxAmount - discountAmount;

    return {
      subtotal: finalSubtotal,
      taxAmount,
      discountAmount,
      finalPrice,
    };
  }, [items, orderAdditionals]);

  const formatEUR = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleItemChange = (id: string | number, snapshot: ItemSnapshot) => {
    setItems(prev => ({
      ...prev,
      [id]: snapshot
    }));
  };

  const handleItemRemove = (id: string | number) => {
    setItems(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addNewItem = () => {
    const newId = nextItemId;
    setItems(prev => ({ ...prev, [newId]: {
      productId: "",
      prompts: {},
      outputs: [],
      itemDescription: "",
      itemAdditionals: [],
      isFinalized: false,
    }}));
    setLastAddedItemId(newId);
  };
  
  const handleFinishItem = (itemId: string | number) => {
    setItems(prev => {
      const updated = {
        ...prev,
        [itemId]: { ...prev[itemId], isFinalized: true }
      };
      return updated;
    });
    setLastAddedItemId(null);
  };

  const handleImportContacts = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se encontró la organización",
        variant: "destructive",
      });
      return;
    }

    setIsImportingContacts(true);
    
    toast({
      title: "Importando contactos...",
      description: "Este proceso puede tardar aproximadamente 1 minuto. El proceso se ejecuta en segundo plano.",
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('holded-import-contacts', {
        body: { organizationId: currentOrganization.id }
      });

      if (error) throw error;

      toast({
        title: "Importación completada",
        description: "Los contactos de Holded han sido actualizados. Ya puedes buscar el nuevo cliente.",
      });
    } catch (error: any) {
      console.error('Error importing Holded contacts:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron importar los contactos",
        variant: "destructive",
      });
    } finally {
      setIsImportingContacts(false);
    }
  };

  const handleSave = async () => {
    if (!customerId) {
      toast({ title: "Error", description: "Debes seleccionar un cliente", variant: "destructive" });
      return;
    }

    if (Object.keys(items).length === 0) {
      toast({ title: "Error", description: "Debes agregar al menos un producto", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const orderNumber = await generateOrderNumber();
      const itemsArray = Object.values(items);

      const orderData = {
        user_id: user.id,
        customer_id: customerId,
        order_number: orderNumber,
        title: title || `Pedido ${orderNumber}`,
        description: description || itemsArray[0]?.itemDescription || "",
        status: 'draft' as const, // Start as draft
        order_date: new Date().toISOString(),
        delivery_date: deliveryDate || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount,
        final_price: totals.finalPrice,
        notes: notes || "",
        created_from_scratch: true, // Mark as created from scratch
      };

      const { data: order, error } = await supabase
        .from("sales_orders")
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      // Create order items
      const orderItemsData = itemsArray.map((item, index) => {
        const promptsArray = Object.entries(item.prompts || {})
          .map(([id, promptData]: [string, any]) => ({
            id,
            label: promptData.label,
            value: promptData.value,
            order: promptData.order ?? 999
          }))
          .sort((a, b) => a.order - b.order);

        // Extract quantity from "Quantity" prompt if exists
        const quantityPrompt = promptsArray.find(p => 
          p.label.toLowerCase() === 'quantity' || p.label.toLowerCase() === 'cantidad'
        );
        const quantity = quantityPrompt?.value ? Number(quantityPrompt.value) : 1;

        return {
          sales_order_id: order.id,
          product_id: item.productId,
          product_name: item.itemDescription || "",
          description: item.itemDescription || "",
          prompts: promptsArray,
          outputs: item.outputs || [],
          price: item.price || 0,
          quantity: quantity,
          position: index,
        };
      });

      const { error: itemsError } = await supabase
        .from("sales_order_items")
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // Create order additionals
      if (orderAdditionals.length > 0) {
        const additionalsData = orderAdditionals.map(additional => ({
          sales_order_id: order.id,
          additional_id: additional.isCustom ? null : additional.id,
          name: additional.name,
          type: additional.type,
          value: additional.value,
          is_discount: false,
        }));

        const { error: additionalsError } = await supabase
          .from("sales_order_additionals")
          .insert(additionalsData);

        if (additionalsError) throw additionalsError;
      }

      toast({ 
        title: "Pedido creado como borrador", 
        description: `Pedido ${orderNumber} creado. Cambia el estado a "Pendiente" para enviarlo a Holded.` 
      });
      
      navigate(`/pedidos/${order.id}`);
    } catch (error: any) {
      console.error("Error saving order:", error);
      toast({ 
        title: "Error al guardar", 
        description: error.message || "No se pudo crear el pedido", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  if (tokenChecking || hasToken === null) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Nuevo pedido</span>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Verificando conexión con EasyQuote...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Nuevo pedido</span>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-destructive font-medium mb-2">
                No se encontró token de EasyQuote
              </p>
              <p className="text-muted-foreground">
                Por favor, configura las credenciales de EasyQuote en la configuración.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Nuevo pedido</h1>
          {isHoldedActive && (
            <Button
              onClick={handleImportContacts}
              disabled={isImportingContacts}
              variant="outline"
              size="sm"
              className="text-xs h-7"
            >
              <Download className="w-3 h-3 mr-1" />
              {isImportingContacts ? "Importando..." : "Actualizar contactos"}
            </Button>
          )}
        </div>
        <Button onClick={() => navigate(-1)} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>

      {/* Order Details */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg">Información del pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Cliente *</Label>
            <CustomerSelector
              value={customerId}
              onValueChange={setCustomerId}
            />
          </div>

          <Separator />

          {/* Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título del pedido</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Pedido Corporativo 2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Fecha de entrega</Label>
              <div className="relative">
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                <CalendarDays className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del pedido..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas para uso interno..."
              rows={3}
            />
          </div>

          <Separator />

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Productos</h3>
              <Button
                onClick={addNewItem}
                disabled={hasItemBeingEdited}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir producto
              </Button>
            </div>

            {Object.entries(items).map(([id, snapshot]) => (
              <QuoteItem
                key={id}
                id={id}
                hasToken={hasToken || false}
                initialData={snapshot}
                onChange={handleItemChange}
                onRemove={handleItemRemove}
                onFinishEdit={handleFinishItem}
                shouldExpand={Number(id) === lastAddedItemId}
              />
            ))}

            {Object.keys(items).length === 0 && (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No hay productos añadidos. Haz clic en "Añadir producto" para comenzar.
                </p>
              </div>
            )}
          </div>

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

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatEUR(totals.subtotal)}</span>
            </div>
            {totals.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span>IVA:</span>
                <span>{formatEUR(totals.taxAmount)}</span>
              </div>
            )}
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Descuento:</span>
                <span>-{formatEUR(totals.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{formatEUR(totals.finalPrice)}</span>
            </div>
          </div>

          <Separator />

          {/* Holded Export Option */}
          {isHoldedActive && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="exportToHolded"
                checked={exportToHolded}
                onChange={(e) => setExportToHolded(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="exportToHolded" className="cursor-pointer">
                Exportar a Holded al crear el pedido
              </Label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || Object.keys(items).length === 0 || !allItemsComplete}
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Guardando..." : "Crear pedido"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
