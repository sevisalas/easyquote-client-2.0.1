import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit } from "lucide-react";
import { format } from "date-fns";
import QuoteAdditionalsSelector from "@/components/quotes/QuoteAdditionalsSelector";
import QuoteItem from "@/components/quotes/QuoteItem";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";

interface QuoteItem {
  id: string;
  name?: string;
  product_name: string;
  description?: string;
  price: number;
  isFromSelections?: boolean;
  // QuoteItem component compatibility
  productId?: string;
  prompts?: Record<string, any>;
  outputs?: any[];
  multi?: any;
  itemDescription?: string;
  itemAdditionals?: any[];
}

interface SelectedQuoteAdditional {
  id: string;
  name: string;
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom";
  value: number;
  isCustom?: boolean;
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
    .from("quotes")
    .select(
      `
      *,
      items:quote_items(*)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Presupuesto no encontrado");

  console.log("Quote data loaded:", data); // Debug log
  return data as any;
};

// No longer needed - CustomerSelector handles fetching both local and Holded customers
// const fetchCustomers = async () => {
//   const { data, error } = await supabase
//     .from('customers')
//     .select('id, name')
//     .order('name');
//
//   if (error) throw error;
//   return data;
// };

const statusOptions = [
  { value: "draft", label: "Borrador" },
  { value: "pending", label: "Pendiente" },
  { value: "sent", label: "Enviado" },
  { value: "approved", label: "Aprobado" },
  { value: "rejected", label: "Rechazado" },
];

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export default function QuoteEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isHoldedActive } = useHoldedIntegration();

  const [formData, setFormData] = useState<Partial<Quote>>({});
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteAdditionals, setQuoteAdditionals] = useState<SelectedQuoteAdditional[]>([]);
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
  });

  // Customers are now handled by CustomerSelector component

  useEffect(() => {
    if (quote) {
      setFormData({
        quote_number: quote.quote_number,
        customer_id: quote.customer_id,
        title: quote.title,
        description: quote.description,
        notes: quote.notes,
        status: quote.status,
        valid_until: quote.valid_until,
      });

      // Load quote additionals - the data is stored as JSON array in quotes.quote_additionals field
      const loadedAdditionals: SelectedQuoteAdditional[] = [];

      console.log("Raw quote_additionals data:", quote.quote_additionals);
      console.log("Type of quote_additionals:", typeof quote.quote_additionals);

      // Check if quote_additionals is a direct JSON array (most common case)
      if (Array.isArray(quote.quote_additionals)) {
        const jsonAdditionals = quote.quote_additionals.map((additional: any, index: number) => ({
          id: additional.id || `temp-${Date.now()}-${index}`,
          name: additional.name,
          type: additional.type || "net_amount",
          value: parseFloat(additional.value) || 0,
          isCustom: !additional.id, // If no predefined ID, it's custom
        }));
        loadedAdditionals.push(...jsonAdditionals);
        console.log("Loaded from JSON array:", jsonAdditionals);
      }

      setQuoteAdditionals(loadedAdditionals);
      console.log("Final loaded additionals:", loadedAdditionals);

      // Load existing items from both sources: database items and JSON selections
      const allItems: QuoteItem[] = [];

      // Load from database (quote_items table)
      if (quote.items && quote.items.length > 0) {
        const dbItems = quote.items.map((item: any) => {
          // Convert prompts from array format (DB) to object format (QuoteItem expects)
          let promptsObj: Record<string, any> = {};
          if (Array.isArray(item.prompts)) {
            // Convert array [{id, label, value, order}] to object {id: {label, value, order}}
            item.prompts.forEach((prompt: any) => {
              promptsObj[prompt.id] = {
                label: prompt.label,
                value: prompt.value,
                order: prompt.order,
              };
            });
          } else if (typeof item.prompts === "object" && item.prompts !== null) {
            // Already in object format
            promptsObj = item.prompts;
          }

          return {
            id: item.id,
            product_name: item.product_name || "",
            description: item.description || "",
            price: item.price || 0,
            // QuoteItem compatibility
            productId: item.product_id || "",
            prompts: promptsObj,
            outputs: Array.isArray(item.outputs) ? item.outputs : [],
            multi:
              item.multi && typeof item.multi === "object" && (item.multi.qtyInputs || item.multi.qtyPrompt)
                ? item.multi
                : undefined,
            itemDescription: item.product_name || "",
            itemAdditionals: Array.isArray(item.item_additionals) ? item.item_additionals : [],
          };
        });
        allItems.push(...dbItems);
      }

      // Load from JSON selections (if no database items)
      if (allItems.length === 0 && quote.selections && Array.isArray(quote.selections)) {
        const jsonItems = quote.selections.map((selection: any, index: number) => {
          // Ensure prompts are in object format
          let promptsObj: Record<string, any> = {};
          if (Array.isArray(selection.prompts)) {
            selection.prompts.forEach((prompt: any) => {
              promptsObj[prompt.id] = {
                label: prompt.label,
                value: prompt.value,
                order: prompt.order,
              };
            });
          } else if (typeof selection.prompts === "object" && selection.prompts !== null) {
            promptsObj = selection.prompts;
          }

          return {
            id: `json-${index}`,
            product_name: selection.itemDescription || "",
            description: "",
            price: selection.price || 0,
            isFromSelections: true,
            // QuoteItem compatibility
            productId: selection.productId || "",
            prompts: promptsObj,
            outputs: selection.outputs || [],
            multi: selection.multi,
            itemDescription: selection.itemDescription || "",
            itemAdditionals: selection.itemAdditionals || [],
          };
        });
        allItems.push(...jsonItems);
      }

      setItems(allItems);
    }
  }, [quote]);

  // Check if any item has multiple quantities enabled
  const hasMultiQuantities = items.some(
    (item) => item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1,
  );

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: Partial<Quote>) => {
      const { error } = await supabase
        .from("quotes")
        .update({
          customer_id: data.customer_id,
          title: data.title,
          description: data.description,
          notes: data.notes,
          status: data.status,
          valid_until: data.valid_until,
          subtotal: calculateSubtotal(),
          final_price: calculateTotal(), // Usar calculateTotal() que incluye ajustes
          selections: null, // Limpiar selections al guardar
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Delete existing items and insert new ones to simplify the update process
      await supabase.from("quote_items").delete().eq("quote_id", id);

      // Insert all current items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => {
          // Convert prompts object to sorted array and keep order field
          const promptsArray = Object.entries(item.prompts || {})
            .map(([id, promptData]: [string, any]) => ({
              id,
              label: promptData.label,
              value: promptData.value,
              order: promptData.order ?? 999,
            }))
            .sort((a, b) => a.order - b.order);

          return {
            quote_id: id,
            product_name: item.product_name || "",
            description: item.description || "",
            price: item.price || 0,
            position: index,
            product_id: item.productId || null,
            prompts: promptsArray,
            outputs: item.outputs || [],
            multi: item.multi || null,
            item_additionals: item.itemAdditionals || [],
          };
        });

        const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Update quote additionals
      await supabase.from("quote_additionals").delete().eq("quote_id", id);

      if (quoteAdditionals.length > 0) {
        const additionalsToInsert = quoteAdditionals.map((additional) => ({
          quote_id: id,
          additional_id: additional.isCustom ? null : additional.id,
          name: additional.name,
          type: additional.type,
          value: additional.value,
        }));

        const { error: additionalsError } = await supabase.from("quote_additionals").insert(additionalsToInsert);

        if (additionalsError) throw additionalsError;
      }
    },
    onSuccess: () => {
      toast.success("Presupuesto actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      navigate(`/presupuestos/${id}`);
    },
    onError: (error) => {
      toast.error("Error al actualizar el presupuesto");
      console.error("Error:", error);
    },
  });

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let total = subtotal;

    console.log("🔢 Calculando total - Subtotal:", subtotal);
    console.log("🔢 Ajustes a aplicar:", quoteAdditionals);

    // Aplicar ajustes
    quoteAdditionals.forEach((additional) => {
      switch (additional.type) {
        case "net_amount":
          console.log(`🔢 Aplicando net_amount: ${additional.value}`);
          total += additional.value;
          break;
        case "percentage":
          const percentageAmount = (subtotal * additional.value) / 100;
          console.log(`🔢 Aplicando percentage: ${additional.value}% = ${percentageAmount}`);
          total += percentageAmount;
          break;
        case "quantity_multiplier":
          console.log(`🔢 Aplicando multiplier: ×${additional.value}`);
          total *= additional.value;
          break;
        default:
          console.log(`🔢 Aplicando default: ${additional.value}`);
          total += additional.value;
      }
    });

    console.log("🔢 Total final calculado:", total);
    return total;
  };

  const handleInputChange = (field: keyof Quote, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemEdit = (itemId: string | number) => {
    const id = itemId.toString();
    setEditingItems((prev) => new Set([...prev, id]));
  };

  const handleItemSaveEdit = (itemId: string | number) => {
    const id = itemId.toString();
    setEditingItems((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleItemChange = (itemId: string | number, snapshot: any) => {
    setItems((prev) => {
      return prev.map((item, index) =>
        item.id === itemId || index.toString() === itemId.toString()
          ? {
              ...item,
              product_name: snapshot.itemDescription || item.product_name,
              description: item.description,
              price: snapshot.price || 0,
              // Update QuoteItem fields
              productId: snapshot.productId,
              prompts: snapshot.prompts,
              outputs: snapshot.outputs,
              multi: snapshot.multi,
              itemDescription: snapshot.itemDescription,
              itemAdditionals: snapshot.itemAdditionals,
            }
          : item,
      );
    });
  };

  const handleItemRemove = (itemId: string | number) => {
    setItems((prev) =>
      prev.filter((item, index) => {
        return item.id !== itemId && index.toString() !== itemId.toString();
      }),
    );
  };

  const addItem = () => {
    const newItemId = `temp-${Date.now()}`;
    const newItem: QuoteItem = {
      id: newItemId,
      product_name: "Nuevo artículo",
      description: "",
      price: 0,
      // QuoteItem compatibility
      productId: "",
      prompts: {},
      outputs: [],
      multi: undefined,
      itemDescription: "Nuevo artículo",
      itemAdditionals: [],
    };
    setItems((prev) => [...prev, newItem]);
    // Abrir automáticamente en modo edición
    setEditingItems((prev) => new Set([...prev, newItemId]));
  };

  const handleSave = () => {
    updateQuoteMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">Cargando presupuesto...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-destructive">Presupuesto no encontrado</p>
            <Button onClick={() => navigate("/presupuestos")} className="mt-3">
              Volver a presupuestos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if quote is editable
  const isEditable = quote.status === "draft" || quote.status === "pending";

  if (!isEditable) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-destructive font-medium">Este presupuesto no se puede editar</p>
            <p className="text-sm text-muted-foreground">
              Los presupuestos en estado "
              {statusOptions.find((opt) => opt.value === quote.status)?.label || quote.status}" no pueden ser
              modificados. Si necesitas realizar cambios, puedes duplicarlo como una nueva versión.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/presupuestos/${id}`)} className="mt-2">
                Ver presupuesto
              </Button>
              <Button onClick={() => navigate("/presupuestos")} variant="outline" className="mt-2">
                Volver a lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-2 space-y-3">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Presupuesto: {quote.quote_number}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateQuoteMutation.isPending} size="sm">
                {updateQuoteMutation.isPending ? "Guardando..." : "Guardar"}
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
        <CardContent className="space-y-2 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <CustomerSelector
                value={formData.customer_id || ""}
                onValueChange={(value) => handleInputChange("customer_id", value)}
                label="cliente"
                placeholder="Seleccionar cliente..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs">
                estado
              </Label>
              <Select value={formData.status || "draft"} onValueChange={(value) => handleInputChange("status", value)}>
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

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">
                título
              </Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Título del presupuesto"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valid_until" className="text-xs">
                Válido hasta
              </Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until || ""}
                onChange={(e) => handleInputChange("valid_until", e.target.value)}
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
                value={formData.description || ""}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Descripción del presupuesto"
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
                value={formData.notes || ""}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Notas adicionales"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          {isHoldedActive && hasMultiQuantities && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                (Este presupuesto tiene múltiples cantidades, cada cantidad se exportará como un artículo separado en
                Holded)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Artículos del presupuesto</CardTitle>
            <Button onClick={addItem} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir artículo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {items.map((item, index) => {
              const itemId = (item.id || index).toString();
              const isEditing = editingItems.has(itemId);

              return (
                <div
                  key={item.id || index}
                  className="bg-card border border-border rounded-md p-2 border-r-2 border-r-secondary hover:shadow transition-all duration-200"
                >
                  {isEditing ? (
                    // Editing mode - show only QuoteItem component
                    <>
                      <QuoteItem
                        hasToken={true}
                        id={itemId}
                        initialData={{
                          productId: item.productId || "",
                          prompts: item.prompts || {},
                          outputs: item.outputs || [],
                          price: item.price || 0,
                          multi: item.multi, // No forzar valor por defecto
                          itemDescription: item.itemDescription || item.product_name || "",
                          itemAdditionals: item.itemAdditionals || [],
                        }}
                        onChange={handleItemChange}
                        onRemove={handleItemRemove}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <Button onClick={() => handleItemSaveEdit(itemId)} size="sm" variant="default">
                          Finalizar edición
                        </Button>
                        <Button
                          onClick={() => handleItemRemove(item.id || index)}
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Compressed mode - show summary
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.description || item.product_name || "-"}
                          {item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1 && (
                            <span className="text-xs text-muted-foreground ml-2">(cantidad múltiple activada)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-sm font-medium text-secondary text-right">{fmtEUR(item.price || 0)}</div>
                        <div className="flex items-center gap-2">
                          <Button onClick={() => handleItemEdit(itemId)} size="sm" variant="outline" className="gap-1">
                            <Edit className="h-3 w-3" />
                            Editar
                          </Button>
                          <Button
                            onClick={() => handleItemRemove(item.id || index)}
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No hay artículos en este presupuesto</p>
                <p className="text-xs mt-1">Utiliza el botón "Añadir artículo" de arriba para comenzar</p>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <>
              <div className="bg-muted/30 rounded-md p-3 border border-border space-y-1.5 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Subtotal:</span>
                  <span className="text-sm font-medium">{fmtEUR(calculateSubtotal())}</span>
                </div>

                {/* Mostrar ajustes aplicados */}
                {quoteAdditionals.length > 0 && (
                  <>
                    {quoteAdditionals.map((additional, index) => {
                      let amount = 0;
                      let displayText = "";
                      const subtotal = calculateSubtotal();

                      switch (additional.type) {
                        case "percentage":
                          amount = (subtotal * additional.value) / 100;
                          displayText = `${additional.name} (${additional.value}%)`;
                          break;
                        case "net_amount":
                          amount = additional.value;
                          displayText = additional.name;
                          break;
                        case "quantity_multiplier":
                          displayText = `${additional.name} (×${additional.value})`;
                          break;
                        default:
                          amount = additional.value;
                          displayText = additional.name;
                      }

                      if (additional.type !== "quantity_multiplier") {
                        return (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">{displayText}:</span>
                            <span className={`text-sm font-medium ${amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {amount >= 0 ? "+" : ""}
                              {fmtEUR(amount)}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </>
                )}

                <div className="flex justify-between items-center pt-3">
                  <span className="text-base font-semibold text-foreground">Total del presupuesto:</span>
                  <span className="text-xl font-bold text-secondary">{fmtEUR(calculateTotal())}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quote Adjustments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ajustes del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <QuoteAdditionalsSelector selectedAdditionals={quoteAdditionals} onChange={setQuoteAdditionals} />
        </CardContent>
      </Card>
    </div>
  );
}
