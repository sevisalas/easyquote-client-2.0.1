import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import QuoteItem from "@/components/quotes/QuoteItem";
import AdditionalsSelector from "@/components/quotes/AdditionalsSelector";
import QuoteAdditionalsSelector from "@/components/quotes/QuoteAdditionalsSelector";

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
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom";
  value: number;
  isCustom?: boolean;
};

export default function QuoteNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateFromId = searchParams.get("from");

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

  // Load quote for duplication
  const { data: duplicateQuote } = useQuery({
    queryKey: ["quote-duplicate", duplicateFromId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", duplicateFromId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!duplicateFromId,
  });

  // Initialize form from duplicate quote
  useEffect(() => {
    if (!duplicateQuote) return;
    
    setCustomerId(duplicateQuote.customer_id || "");
    setTitle(duplicateQuote.title || "");
    setDescription(duplicateQuote.description || "");
    setNotes(duplicateQuote.notes || "");
    setValidUntil(duplicateQuote.valid_until || "");
    
    // Load quote additionals
    if (duplicateQuote.quote_additionals) {
      const additionals = Array.isArray(duplicateQuote.quote_additionals) ? duplicateQuote.quote_additionals : [];
      setQuoteAdditionals(additionals as SelectedAdditional[]);
    }

    // Load product selections
    if (duplicateQuote.selections) {
      const selections = typeof duplicateQuote.selections === 'string' 
        ? JSON.parse(duplicateQuote.selections) 
        : duplicateQuote.selections;
      
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
            needsRecalculation: true, // Flag to trigger recalculation
          };
        });
        setItems(itemsData);
      }
    }
  }, [duplicateQuote]);

  // Generate quote number
  const generateQuoteNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .like("quote_number", `${year}-%`);
    
    const nextNumber = (count || 0) + 1;
    return `${year}-${String(nextNumber).padStart(4, "0")}`;
  };

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
        // For quantity type, we could implement total quantity calculation
        additionalsTotal += additional.value;
      } else if (additional.type === 'percentage') {
        // For percentage type, apply to subtotal
        additionalsTotal += (subtotal * additional.value) / 100;
      }
    });
    
    const finalSubtotal = subtotal + additionalsTotal;
    const taxAmount = 0; // TODO: Implement tax calculation
    const discountAmount = 0; // TODO: Implement discount
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

  const handleSave = async (status: "draft" | "sent" = "draft") => {
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

      const quoteNumber = await generateQuoteNumber();
      const itemsArray = Object.values(items);

      const quoteData = {
        user_id: user.id,
        customer_id: customerId,
        quote_number: quoteNumber,
        title: title || `Presupuesto ${quoteNumber}`,
        description: description || "",
        status,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: totals.discountAmount,
        final_price: totals.finalPrice,
        valid_until: validUntil || null,
        notes: notes || "",
        terms_conditions: "", // TODO: Add terms and conditions
        selections: itemsArray,
        quote_additionals: quoteAdditionals,
        product_name: itemsArray.length > 0 ? itemsArray[0].itemDescription || "Productos varios" : "Sin productos",
      };

      const { data, error } = await supabase
        .from("quotes")
        .insert(quoteData)
        .select()
        .single();

      if (error) throw error;

      toast({ 
        title: "Presupuesto guardado", 
        description: `Presupuesto ${quoteNumber} ${status === 'draft' ? 'guardado como borrador' : 'enviado'} correctamente` 
      });
      
      navigate(`/presupuestos/${data.id}`);
    } catch (error: any) {
      console.error("Error saving quote:", error);
      toast({ 
        title: "Error al guardar", 
        description: error.message || "No se pudo guardar el presupuesto", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Nuevo Presupuesto</span>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Para crear presupuestos necesitas conectar tu cuenta de EasyQuote.
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
            <span>
              {duplicateFromId ? "Duplicar Presupuesto" : "Nuevo Presupuesto"}
              {duplicateFromId && (
                <Badge variant="secondary" className="ml-2">
                  Duplicando
                </Badge>
              )}
            </span>
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
          <CardTitle>Información del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <CustomerSelector
              value={customerId}
              onValueChange={setCustomerId}
              label="cliente *"
              placeholder="Seleccionar cliente..."
            />
            
            <div className="space-y-2">
              <Label htmlFor="valid-until">válido hasta</Label>
              <Input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="description">descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del presupuesto..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">notas internas</Label>
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
            <Button onClick={addNewItem} variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(items).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay productos agregados.</p>
            </div>
          ) : (
            Object.entries(items).map(([id, item]) => (
              <div key={id} className="bg-card border border-border rounded-lg p-3 border-r-4 border-r-secondary hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-foreground">Producto {Number(id) + 1}</h4>
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

      {/* Quote-level Discounts and Adjustments */}
      <Card>
        <CardHeader>
          <CardTitle>Descuentos y Ajustes del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
            <QuoteAdditionalsSelector
              selectedAdditionals={quoteAdditionals}
              onChange={setQuoteAdditionals}
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>subtotal:</span>
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
                <span>descuento:</span>
                <span>-{formatEUR(totals.discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="bg-card rounded-lg p-4 border border-border border-r-4 border-r-secondary hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-foreground">total:</span>
                <span className="text-2xl font-bold text-secondary">{formatEUR(totals.finalPrice)}</span>
              </div>
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