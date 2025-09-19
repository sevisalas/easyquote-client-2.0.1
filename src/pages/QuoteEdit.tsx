import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import QuoteItem from "@/components/quotes/QuoteItem";
import AdditionalsSelector from "@/components/quotes/AdditionalsSelector";

type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: number;
  multi?: any;
  itemDescription?: string;
  itemAdditionals?: any[];
  needsRecalculation?: boolean;
};

type SelectedAdditional = {
  id: string;
  name: string;
  type: "net_amount" | "quantity_multiplier" | "custom";
  value: number;
  isCustom?: boolean;
};

export default function QuoteEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Form state
  const [customerId, setCustomerId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [items, setItems] = useState<Record<string | number, ItemSnapshot>>({});
  const [quoteAdditionals, setQuoteAdditionals] = useState<SelectedAdditional[]>([]);
  const [loading, setSaving] = useState(false);

  // Generate next item ID
  const nextItemId = useMemo(() => Math.max(0, ...Object.keys(items).map(k => Number(k) || 0)) + 1, [items]);

  // Check if user has EasyQuote token
  const hasToken = Boolean(localStorage.getItem("easyquote_token"));

  // Load quote data
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Initialize form from loaded quote
  useEffect(() => {
    if (!quote) return;
    
    setCustomerId(quote.customer_id || "");
    setTitle(quote.title || "");
    setDescription(quote.description || "");
    setNotes(quote.notes || "");
    setValidUntil(quote.valid_until || "");
    
    // Load quote additionals
    if (quote.quote_additionals) {
      const additionals = Array.isArray(quote.quote_additionals) ? quote.quote_additionals : [];
      setQuoteAdditionals(additionals as SelectedAdditional[]);
    }

    // Load product selections
    if (quote.selections) {
      const selections = Array.isArray(quote.selections) ? quote.selections : [];
      
      if (Array.isArray(selections)) {
        const itemsData: Record<string | number, ItemSnapshot> = {};
        selections.forEach((item: any, index: number) => {
          itemsData[index] = {
            productId: item.productId || "",
            prompts: item.prompts || {},
            outputs: item.outputs || [],
            price: item.price,
            multi: item.multi,
            itemDescription: item.itemDescription || "",
            itemAdditionals: item.itemAdditionals || [],
            needsRecalculation: false, // Don't auto-recalculate on edit
          };
        });
        setItems(itemsData);
      }
    }
  }, [quote]);

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;
    
    // Sum items prices
    Object.values(items).forEach(item => {
      if (typeof item.price === 'number') {
        subtotal += item.price;
      }
    })

    // Add quote-level additionals
    let additionalsTotal = 0;
    quoteAdditionals.forEach(additional => {
      if (additional.type === 'net_amount') {
        additionalsTotal += additional.value;
      } else if (additional.type === 'quantity_multiplier') {
        additionalsTotal += additional.value;
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
  }, [items, quoteAdditionals]);

  const formatEUR = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleItemChange = (id: string | number, snapshot: ItemSnapshot) => {
    setItems(prev => ({ ...prev, [id]: snapshot }));
  };

  const handleItemRemove = (id: string | number) => {
    setItems(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addNewItem = () => {
    setItems(prev => ({ ...prev, [nextItemId]: {
      productId: "",
      prompts: {},
      outputs: [],
      itemDescription: "",
      itemAdditionals: [],
    }}));
  };

  const handleSave = async (status?: "draft" | "sent") => {
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

      const itemsArray = Object.values(items);
      const updateStatus = status || quote?.status || "draft";

      const quoteData = {
        customer_id: customerId,
        title: title || `Presupuesto ${quote?.quote_number}`,
        description: description || "",
        status: updateStatus,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount,
        final_price: totals.finalPrice,
        valid_until: validUntil || null,
        notes: notes || "",
        selections: itemsArray,
        quote_additionals: quoteAdditionals,
        product_name: itemsArray.length > 0 ? itemsArray[0].itemDescription || "Productos varios" : "Sin productos",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("quotes")
        .update(quoteData)
        .eq("id", id);

      if (error) throw error;

      toast({ 
        title: "Presupuesto actualizado", 
        description: `El presupuesto se ha actualizado correctamente` 
      });
      
      navigate(`/presupuestos/${id}`);
    } catch (error: any) {
      console.error("Error updating quote:", error);
      toast({ 
        title: "Error al actualizar", 
        description: error.message || "No se pudo actualizar el presupuesto", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Cargando presupuesto...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive">Error al cargar el presupuesto</p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                Volver
              </Button>
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
              <span>Editar Presupuesto</span>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Para editar presupuestos necesitas conectar tu cuenta de EasyQuote.
              </p>
              <Button onClick={() => navigate("/integraciones")}>
                Ir a Integraciones
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>Editar Presupuesto {quote.quote_number}</span>
              <Badge variant="secondary">Editando</Badge>
            </div>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Quote Details */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomerSelector
              value={customerId}
              onValueChange={setCustomerId}
              label="Cliente *"
              placeholder="Seleccionar cliente..."
            />
            
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del presupuesto..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del presupuesto..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid-until">Válido hasta</Label>
              <Input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas para uso interno..."
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Productos</CardTitle>
            <Button onClick={addNewItem} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(items).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay productos agregados.</p>
              <Button onClick={addNewItem} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Primer Producto
              </Button>
            </div>
          ) : (
            Object.entries(items).map(([id, item]) => (
              <div key={id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Producto {Number(id) + 1}</h4>
                  <Button
                    onClick={() => handleItemRemove(id)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <QuoteItem
                  hasToken={hasToken}
                  id={id}
                  initialData={item}
                  onChange={handleItemChange}
                  onRemove={handleItemRemove}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Quote-level Additionals */}
      <Card>
        <CardHeader>
          <CardTitle>Ajustes del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          <AdditionalsSelector
            selectedAdditionals={quoteAdditionals}
            onChange={setQuoteAdditionals}
          />
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatEUR(totals.subtotal)}</span>
            </div>
            {totals.taxAmount > 0 && (
              <div className="flex justify-between">
                <span>IVA:</span>
                <span>{formatEUR(totals.taxAmount)}</span>
              </div>
            )}
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Descuento:</span>
                <span>-{formatEUR(totals.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{formatEUR(totals.finalPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 justify-end">
            <Button
              onClick={() => handleSave("draft")}
              disabled={loading}
              variant="outline"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Borrador
            </Button>
            <Button
              onClick={() => handleSave("sent")}
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar y Enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}