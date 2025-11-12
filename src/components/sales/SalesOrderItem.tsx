import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import PromptsForm from "@/components/quotes/PromptsForm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdditionalsSelector from "@/components/quotes/AdditionalsSelector";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: number;
  itemDescription?: string;
  itemAdditionals?: any[];
  isFinalized?: boolean;
  needsRecalculation?: boolean;
};

interface SalesOrderItemProps {
  hasToken: boolean;
  id: string | number;
  initialData?: ItemSnapshot;
  onChange?: (id: string | number, snapshot: ItemSnapshot) => void;
  onRemove?: (id: string | number) => void;
  onFinishEdit?: (id: string | number) => void;
  shouldExpand?: boolean;
}

interface Additional {
  id: string;
  name: string;
  description?: string;
  type: 'net' | 'quantity';
  default_value: number;
}

export default function SalesOrderItem({ hasToken, id, initialData, onChange, onRemove, onFinishEdit, shouldExpand }: SalesOrderItemProps) {
  const [productId, setProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});
  const [forceRecalculate, setForceRecalculate] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(shouldExpand || false);
  const [itemDescription, setItemDescription] = useState<string>("");
  const selectRef = useRef<HTMLButtonElement>(null);
  const [itemAdditionals, setItemAdditionals] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const initialStateRef = useRef<string>("");

  useEffect(() => {
    if (shouldExpand !== undefined) {
      setIsExpanded(shouldExpand);
    }
  }, [shouldExpand, id]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (!initialData) return;
    initializedRef.current = true;
    try {
      setProductId(initialData.productId || "");
      setPromptValues(initialData.prompts || {});
      setItemDescription(initialData.itemDescription || "");
      const additionals = initialData.itemAdditionals;
      if (additionals && !Array.isArray(additionals)) {
        const converted = Object.entries(additionals).map(([id, config]: [string, any]) => ({
          id,
          name: `Ajuste ${id}`,
          type: "net_amount",
          value: config.value || 0,
          isCustom: true
        }));
        setItemAdditionals(converted);
      } else {
        setItemAdditionals(Array.isArray(additionals) ? additionals : []);
      }
      if (initialData.needsRecalculation) {
        setForceRecalculate(true);
      }
    } catch {}
  }, [initialData]);

  useEffect(() => {
    if (initialStateRef.current === "" && isExpanded) {
      initialStateRef.current = JSON.stringify({
        productId,
        promptValues,
        itemDescription,
        itemAdditionals
      });
    }
  }, [isExpanded, productId, promptValues, itemDescription, itemAdditionals]);

  useEffect(() => {
    if (initialStateRef.current && isExpanded) {
      const currentState = JSON.stringify({
        productId,
        promptValues,
        itemDescription,
        itemAdditionals
      });
      setHasUnsavedChanges(currentState !== initialStateRef.current);
    }
  }, [productId, promptValues, itemDescription, itemAdditionals, isExpanded]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPromptValues(promptValues), 350);
    return () => clearTimeout(t);
  }, [promptValues]);

  const fetchProducts = async (): Promise<any[]> => {
    const token = sessionStorage.getItem("easyquote_token");
    if (!token) throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
    
    const { data, error } = await invokeEasyQuoteFunction("easyquote-products", { token });
    
    if (error) throw error;
    
    const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
    const activeProducts = list.filter((product: any) => product.isActive === true);
    return activeProducts as any[];
  };

  const getProductLabel = (p: any) =>
    p?.name ?? p?.title ?? p?.displayName ?? p?.productName ?? p?.product_name ?? p?.nombre ?? p?.Nombre ?? p?.description ?? "Producto sin nombre";

  const { data: products } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: fetchProducts,
    retry: 1,
    enabled: hasToken,
  });

  useEffect(() => {
    if (productId && !itemDescription && products) {
      const selectedProduct = products.find((p: any) => String(p.id) === String(productId));
      if (selectedProduct) {
        setItemDescription(getProductLabel(selectedProduct));
      }
    }
  }, [productId, products, itemDescription]);

  const { data: additionals } = useQuery({
    queryKey: ["additionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Additional[];
    },
  });

  const { data: pricing, error: pricingError, refetch: refetchPricing } = useQuery({
    queryKey: ["easyquote-pricing", productId, debouncedPromptValues, forceRecalculate],
    enabled: hasToken && !!productId,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: forceRecalculate ? 0 : 5000,
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      const norm: Record<string, any> = {};
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        const actualValue = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
        
        if (actualValue === "" || actualValue === undefined || actualValue === null) return;
        if (typeof actualValue === "string") {
          const trimmed = actualValue.trim();
          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            norm[k] = trimmed.slice(1).toUpperCase();
            return;
          }
          const num = Number(trimmed.replace(",", "."));
          if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
            norm[k] = num;
            return;
          }
          norm[k] = trimmed;
        } else {
          norm[k] = actualValue;
        }
      });

      const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
        token,
        productId,
        inputs: Object.entries(norm).map(([id, value]) => ({ id, value }))
      });
      
      if (error) {
        if (error.status === 401 || error.code === 'EASYQUOTE_UNAUTHORIZED') {
          const { notifyUnauthorized } = await import('@/hooks/useTokenRefresh');
          notifyUnauthorized(401, 'EASYQUOTE_UNAUTHORIZED');
        }
        throw error;
      }
      return data;
    },
  });

  useEffect(() => {
    if (forceRecalculate && hasToken && productId) {
      refetchPricing();
      setForceRecalculate(false);
    }
  }, [forceRecalculate, hasToken, productId, refetchPricing]);

  const previousProductIdRef = useRef<string>("");
  
  useEffect(() => {
    if (previousProductIdRef.current && previousProductIdRef.current !== productId) {
      setPromptValues({});
    }
    previousProductIdRef.current = productId;
    
    if (productId && products) {
      const selectedProduct = products.find((p: any) => String(p.id) === String(productId));
      if (selectedProduct) {
        const productLabel = getProductLabel(selectedProduct);
        if (!itemDescription) {
          setItemDescription(productLabel);
        }
      }
    }
    
    if (productId && !isExpanded) {
      setIsExpanded(true);
    }
  }, [productId, products]);

  useEffect(() => {
    if (!productId) {
      setIsExpanded(true);
    }
  }, []);

  const outputs = useMemo(() => ((pricing as any)?.outputValues ?? []) as any[], [pricing]);
  const imageOutputs = useMemo(
    () => outputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [outputs]
  );
  const priceOutput = useMemo(
    () => outputs.find((o: any) => String(o?.type || "").toLowerCase() === "price"),
    [outputs]
  );
  const otherOutputs = useMemo(
    () =>
      outputs.filter((o: any) => {
        const t = String(o?.type || "").toLowerCase();
        const n = String(o?.name || "").toLowerCase();
        const v = String(o?.value ?? "");
        const isImageLike = t.includes("image") || n.includes("image");
        const isNA = v === "" || v === "#N/A";
        return o !== priceOutput && !isImageLike && !isNA;
      }),
    [outputs, priceOutput]
  );

  const formatEUR = (val: any) => {
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) return `${String(val)} €`;
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const totalPrice = useMemo(() => {
    let base = 0;
    if (priceOutput?.value != null) {
      const v = String(priceOutput.value);
      const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
      if (!isNaN(n)) base = n;
    }

    let additionalsTotal = 0;
    itemAdditionals.forEach(additional => {
      if (additional.type === 'net_amount') {
        additionalsTotal += additional.value || 0;
      } else if (additional.type === 'quantity_multiplier') {
        additionalsTotal += additional.value || 0;
      } else if (additional.type === 'percentage') {
        additionalsTotal += (base * (additional.value || 0)) / 100;
      }
    });

    return base + additionalsTotal;
  }, [priceOutput, itemAdditionals]);

  const isFinalized = useMemo(() => {
    return initialData?.isFinalized === true;
  }, [initialData]);

  useEffect(() => {
    const snapshot: ItemSnapshot = {
      productId,
      prompts: promptValues,
      outputs,
      price: totalPrice,
      itemDescription,
      itemAdditionals,
      isFinalized: isFinalized,
    };
    onChange?.(id, snapshot);
  }, [productId, promptValues, outputs, totalPrice, itemDescription, itemAdditionals, isFinalized, id, onChange]);

  const handleRemove = () => {
    if (hasUnsavedChanges && !isFinalized) {
      setShowExitConfirm(true);
    } else {
      onRemove?.(id);
    }
  };

  const handleToggle = () => {
    if (isExpanded && hasUnsavedChanges && !isFinalized) {
      setShowExitConfirm(true);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    setIsExpanded(false);
    onRemove?.(id);
  };

  const handleFinish = () => {
    if (!productId) return;
    onFinishEdit?.(id);
    setIsExpanded(false);
  };

  if (isFinalized) {
    const productName = itemDescription || products?.find((p: any) => String(p.id) === String(productId))?.name || "Producto";
    
    return (
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">{productName}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">{formatEUR(totalPrice)}</span>
              <Button variant="ghost" size="sm" onClick={handleToggle}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRemove}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {productId ? (itemDescription || products?.find((p: any) => String(p.id) === String(productId))?.name || "Producto") : "Nuevo producto"}
            </CardTitle>
            <div className="flex items-center gap-2">
              {totalPrice > 0 && <span className="text-sm font-semibold text-primary">{formatEUR(totalPrice)}</span>}
              <Button variant="ghost" size="sm" onClick={handleToggle}>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRemove}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`product-${id}`}>Producto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id={`product-${id}`} ref={selectRef}>
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {getProductLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`description-${id}`}>Descripción del producto</Label>
                  <Input
                    id={`description-${id}`}
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="Descripción personalizada del producto..."
                  />
                </div>

                <Separator />

                {pricingError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Error al obtener precio</AlertTitle>
                    <AlertDescription>
                      {(pricingError as any)?.message || "No se pudo calcular el precio"}
                    </AlertDescription>
                  </Alert>
                ) : pricing ? (
                  <Tabs defaultValue="prompts" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="prompts">Prompts</TabsTrigger>
                      <TabsTrigger value="outputs">Outputs</TabsTrigger>
                      <TabsTrigger value="additionals">Ajustes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="prompts" className="space-y-4">
                      <PromptsForm
                        product={pricing}
                        values={promptValues}
                        onChange={(id: string, value: any, label: string) => {
                          setPromptValues(prev => ({ ...prev, [id]: { value, label } }));
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="outputs" className="space-y-4">
                      {imageOutputs.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Imágenes</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {imageOutputs.map((img: any, i: number) => (
                              <img
                                key={i}
                                src={img.value}
                                alt={img.name || "Output"}
                                className="w-full h-auto rounded border"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {priceOutput && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">Precio base:</span>
                            <span className="text-lg font-bold text-primary">
                              {formatEUR(priceOutput.value)}
                            </span>
                          </div>
                        </div>
                      )}

                      {otherOutputs.length > 0 && (
                        <Accordion type="single" collapsible>
                          <AccordionItem value="other-outputs">
                            <AccordionTrigger>Otros outputs ({otherOutputs.length})</AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {otherOutputs.map((out: any, i: number) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{out.name}:</span>
                                    <span className="font-medium">{out.value}</span>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </TabsContent>

                    <TabsContent value="additionals" className="space-y-4">
                      <AdditionalsSelector
                        selectedAdditionals={itemAdditionals}
                        onChange={setItemAdditionals}
                      />
                      
                      {itemAdditionals.length > 0 && priceOutput && (
                        <div className="p-4 bg-muted rounded-lg space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Precio base:</span>
                            <span>{formatEUR(priceOutput.value)}</span>
                          </div>
                          {itemAdditionals.map((add, idx) => {
                            let addValue = 0;
                            if (add.type === 'net_amount' || add.type === 'quantity_multiplier') {
                              addValue = add.value || 0;
                            } else if (add.type === 'percentage') {
                              const base = parseFloat(String(priceOutput.value).replace(/\./g, "").replace(",", "."));
                              addValue = (base * (add.value || 0)) / 100;
                            }
                            return (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{add.name}:</span>
                                <span>{formatEUR(addValue)}</span>
                              </div>
                            );
                          })}
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Precio total:</span>
                            <span className="text-primary">{formatEUR(totalPrice)}</span>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : null}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleRemove}>
                    Cancelar
                  </Button>
                  <Button onClick={handleFinish} disabled={!productId || totalPrice <= 0}>
                    Finalizar producto
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar en este producto. Si continúas, se perderán estos cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit}>
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
