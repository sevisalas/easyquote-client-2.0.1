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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Plus, Trash2, Save, ArrowLeft, Download } from "lucide-react";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";
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
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [hideHoldedTotals, setHideHoldedTotals] = useState(false);

  // Holded integration
  const { isHoldedActive } = useHoldedIntegration();
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  // Generate next item ID
  const nextItemId = useMemo(() => Math.max(0, ...Object.keys(items).map(k => Number(k) || 0)) + 1, [items]);
  
  // Track the last added item to keep it expanded
  const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);

  // Check if all items are complete (have productId and valid price)
  const allItemsComplete = useMemo(() => {
    const itemsArray = Object.values(items);
    if (itemsArray.length === 0) return true; // No items means we can add
    return itemsArray.every(item => item.productId && item.price && item.price > 0);
  }, [items]);

  // Check if any item has multiple quantities enabled
  const hasMultiQuantities = useMemo(() => {
    return Object.values(items).some(item => 
      item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1
    );
  }, [items]);

  // Auto-enable hideHoldedTotals when multi quantities are detected
  useEffect(() => {
    if (hasMultiQuantities && !hideHoldedTotals) {
      setHideHoldedTotals(true);
    }
  }, [hasMultiQuantities]);

  // Check if user has EasyQuote token
  const hasToken = Boolean(sessionStorage.getItem("easyquote_token"));

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

    // Load hideHoldedTotals
    setHideHoldedTotals(duplicateQuote.hide_holded_totals || false);

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
            itemDescription: item.productName || "",
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
    setItems(prev => {
      const next = { ...prev };
      
      // Update the main item
      next[id] = snapshot;
      
      // Remove old multi-quantity duplicates for this item
      Object.keys(next).forEach(key => {
        if (key.toString().startsWith(`${id}-q`) && key !== id) {
          delete next[key];
        }
      });
      
      // If multi is enabled and has additional quantities, create duplicate items
      if (snapshot.multi && Array.isArray(snapshot.multi.rows) && snapshot.multi.rows.length > 1) {
        const qtyPromptId = snapshot.multi.qtyPrompt;
        
        // Skip Q1 (index 0) as it's the main item
        snapshot.multi.rows.slice(1).forEach((row: any, index: number) => {
          const qIndex = index + 2; // Q2, Q3, Q4...
          const duplicateId = `${id}-q${qIndex}`;
          
          // Clone prompts and update the quantity prompt
          const duplicatePrompts = { ...snapshot.prompts };
          if (qtyPromptId && row.qty) {
            // Get the label from the original prompt
            const originalPrompt = snapshot.prompts[qtyPromptId];
            const label = originalPrompt && typeof originalPrompt === 'object' && 'label' in originalPrompt 
              ? originalPrompt.label 
              : 'CANTIDAD';
            
            duplicatePrompts[qtyPromptId] = {
              label,
              value: String(row.qty)
            };
          }
          
          // Find the price output from the row
          const priceOut = (row.outs || []).find((o: any) => 
            String(o?.type || '').toLowerCase() === 'price' ||
            String(o?.name || '').toLowerCase().includes('precio') ||
            String(o?.name || '').toLowerCase().includes('price')
          );
          
          const priceValue = priceOut?.value;
          const price = typeof priceValue === "number" 
            ? priceValue 
            : parseFloat(String(priceValue || 0).replace(/\./g, "").replace(",", ".")) || 0;
          
          // Create duplicate item
          next[duplicateId] = {
            productId: snapshot.productId,
            prompts: duplicatePrompts,
            outputs: row.outs || snapshot.outputs,
            price,
            multi: null, // Disable multi for duplicates
            itemDescription: `${snapshot.itemDescription || ''} (Q${qIndex})`,
            itemAdditionals: snapshot.itemAdditionals || [],
          };
        });
      }
      
      return next;
    });
  };

  const handleItemRemove = (id: string | number) => {
    setItems(prev => {
      const next = { ...prev };
      const idStr = id.toString();
      
      // Remove the main item
      delete next[id];
      
      // Remove all duplicates (q2, q3, etc.)
      Object.keys(next).forEach(key => {
        if (key.toString().startsWith(`${idStr}-q`)) {
          delete next[key];
        }
      });
      
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
    }}));
    setLastAddedItemId(newId);
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
    
    // Mostrar aviso sobre el tiempo de importación
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
        terms_conditions: "",
        selections: itemsArray,
        quote_additionals: quoteAdditionals,
        hide_holded_totals: hideHoldedTotals,
      };

      const { data: quote, error } = await supabase
        .from("quotes")
        .insert(quoteData)
        .select()
        .single();

      if (error) throw error;

      // Create quote_items records with prompts and outputs
      const quoteItemsData = itemsArray.map((item, index) => ({
        quote_id: quote.id,
        product_id: item.productId,
        product_name: item.itemDescription || "",
        description: item.itemDescription || "",
        prompts: item.prompts || {},
        outputs: item.outputs || [],
        multi: item.multi || null,
        price: item.price || 0,
        quantity: 1,
        discount_percentage: 0,
        position: index,
        item_additionals: item.itemAdditionals || []
      }));

      const { error: itemsError } = await supabase
        .from("quote_items")
        .insert(quoteItemsData);

      if (itemsError) throw itemsError;

      toast({ 
        title: "Presupuesto guardado", 
        description: `Presupuesto ${quoteNumber} ${status === 'draft' ? 'guardado como borrador' : 'enviado'} correctamente` 
      });
      
      navigate(`/presupuestos/${quote.id}`);
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
              <span>Nuevo presupuesto</span>
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
    <div className="container mx-auto py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {duplicateFromId ? "Duplicar presupuesto" : "Nuevo presupuesto"}
            {duplicateFromId && (
              <Badge variant="secondary" className="ml-2">
                Duplicando
              </Badge>
            )}
          </h1>
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

      {/* Quote Details */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg">Información del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <CustomerSelector
              value={customerId}
              onValueChange={setCustomerId}
              label="Cliente *"
              placeholder="Seleccionar cliente..."
            />
            
            <div className="space-y-2">
              <Label htmlFor="valid-until">Válido hasta</Label>
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
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del presupuesto..."
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
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            {isHoldedActive && (
              <Checkbox 
                id="hide-holded-totals" 
                checked={hideHoldedTotals}
                onCheckedChange={(checked) => setHideHoldedTotals(checked === true)}
              />
            )}
            {isHoldedActive && (
              <Label 
                htmlFor="hide-holded-totals" 
                className="text-sm font-normal cursor-pointer"
              >
                ¿Ocultar totales en Holded?
              </Label>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Productos</CardTitle>
            {(Object.keys(items).length === 0 || allItemsComplete) && (
              <Button onClick={addNewItem} variant="secondary" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar producto
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(items).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay productos agregados.</p>
              <p className="text-sm mt-2">Haz clic en "Agregar producto" para comenzar.</p>
            </div>
          ) : (
            Object.entries(items).map(([id, item], index) => {
              const isLastAdded = Number(id) === lastAddedItemId;
              const isComplete = item.productId && item.price && item.price > 0;
              const shouldExpand = isLastAdded || Object.keys(items).length === 1;
              return (
                <div key={id}>
                  <QuoteItem
                    hasToken={hasToken}
                    id={id}
                    initialData={item}
                    onChange={handleItemChange}
                    onRemove={handleItemRemove}
                    shouldExpand={shouldExpand}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Quote-level Discounts and Adjustments */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg">Ajustes del presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-4 rounded-lg border border-border">
            <QuoteAdditionalsSelector
              selectedAdditionals={quoteAdditionals}
              onChange={setQuoteAdditionals}
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-lg">Resumen</CardTitle>
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
                <span>Descuento:</span>
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
              Guardar borrador
            </Button>
            <Button
              onClick={() => handleSave("sent")}
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar y enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}