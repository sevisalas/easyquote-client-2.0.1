import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PromptsForm from "@/components/quotes/PromptsForm";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const fetchProducts = async () => {
  const token = sessionStorage.getItem("easyquote_token");
  if (!token) throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");

  const { data, error } = await invokeEasyQuoteFunction("easyquote-products", {
    token,
    includeInactive: true, // Get all products to see plan compliance
  });

  if (error) throw error;

  const list = Array.isArray(data) ? data : data?.items || data?.data || [];
  return list.filter((product: any) => product.isActive === true);
};

const getProductLabel = (p: any) =>
  p?.name ??
  p?.title ??
  p?.displayName ??
  p?.productName ??
  p?.product_name ??
  p?.nombre ??
  p?.Nombre ??
  p?.description ??
  "Producto sin nombre";

export default function ProductTestPage() {
  const [searchParams] = useSearchParams();
  const [productId, setProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [productDetail, setProductDetail] = useState<any>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // No debounce needed - we use onCommit events now
  // debouncedPromptValues is updated directly in handlePromptCommit

  // Fetch products - with aggressive caching
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: fetchProducts,
    enabled: !!sessionStorage.getItem("easyquote_token"),
    staleTime: 5 * 60 * 1000, // 5 minutes - products rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Fetch product detail when productId changes
  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!productId) {
        setProductDetail(null);
        setIsLoadingProduct(false);
        return;
      }

      setIsLoadingProduct(true);
      setDiagnosticResult(null);

      const token = sessionStorage.getItem("easyquote_token");
      if (!token) {
        setIsLoadingProduct(false);
        return;
      }

      try {
        const selectedProduct = products.find((p: any) => p.id === productId);
        if (!selectedProduct) return;

        const { data: pricingData, error: pricingError } = await invokeEasyQuoteFunction("easyquote-pricing", {
          token,
          productId: productId,
          inputs: [],
        });

        if (pricingError) throw pricingError;

        setProductDetail(pricingData);

        // Reset prompt values with current values from pricing
        const currentValues: Record<string, any> = {};
        (pricingData?.prompts || []).forEach((prompt: any) => {
          if (prompt.currentValue !== undefined && prompt.currentValue !== null) {
            currentValues[prompt.id] = prompt.currentValue;
          }
        });
        setPromptValues(currentValues);
      } catch (error) {
        console.error("Error fetching product detail:", error);
        setProductDetail(null);
        setPromptValues({});
      } finally {
        setIsLoadingProduct(false);
      }
    };

    fetchProductDetail();
  }, [productId, products]);

  // Función para recalcular precio - llamada solo cuando el usuario hace commit
  const recalculatePricing = async (newValues: Record<string, any>) => {
    const token = sessionStorage.getItem("easyquote_token");
    if (!token || !productId) return;

    setIsPricingLoading(true);

    try {
      // Merge all prompt values
      const allPromptValues: Record<string, any> = {};
      (productDetail?.prompts || []).forEach((p: any) => {
        if (p.currentValue !== undefined && p.currentValue !== null) {
          allPromptValues[p.id] = p.currentValue;
        }
      });
      Object.entries(newValues).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          allPromptValues[k] = v;
        }
      });

      // Normalize values for API
      const norm: Record<string, any> = {};
      Object.entries(allPromptValues).forEach(([k, v]) => {
        if (v === "" || v === undefined || v === null) return;
        const prompt = productDetail?.prompts?.find((p: any) => p.id === k);
        const promptType = prompt?.promptType;

        if (typeof v === "string") {
          const trimmed = v.trim();
          if (trimmed === "") return;
          if (trimmed.length < 3 && /^[^\w\s]+$/.test(trimmed)) return;

          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            norm[k] = trimmed.substring(1).toUpperCase();
          } else {
            const isNumericType = promptType === "Number" || promptType === "Quantity";
            if (isNumericType) {
              const asNum = parseFloat(trimmed);
              norm[k] = Number.isNaN(asNum) ? trimmed : asNum;
            } else {
              norm[k] = trimmed;
            }
          }
        } else if (typeof v === "number" && isFinite(v)) {
          norm[k] = v;
        } else {
          norm[k] = v;
        }
      });

      const inputsArray = Object.entries(norm).map(([id, value]) => ({ id, value }));

      const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
        token,
        productId,
        inputs: inputsArray,
      });
      if (error) throw error;

      // Update product detail with new data
      setProductDetail(data);
    } catch (error) {
      console.error("Error recalculating pricing:", error);
    } finally {
      setIsPricingLoading(false);
    }
  };

  // Auto-select product if productId is in URL params
  useEffect(() => {
    const productIdFromUrl = searchParams.get("productId");
    if (productIdFromUrl && products.length > 0) {
      const productExists = products.find((p: any) => p.id === productIdFromUrl);
      if (productExists) {
        setProductId(productIdFromUrl);
      }
    }
  }, [searchParams, products]);

  // Derive outputs from product detail
  const allOutputs = useMemo(() => {
    if (!productDetail) return [];
    const outputValues = productDetail.outputValues || productDetail.outputs || productDetail.results || [];
    return Array.isArray(outputValues) ? outputValues.map((o: any) => ({
      label: o.label || o.name || o.outputText || o.text || o.outputName || 'Output',
      name: o.name || o.label || o.outputName || '',
      value: o.value ?? o.currentValue ?? o.outputValue ?? o.result ?? '',
      outputType: o.outputType || o.type || '',
    })) : [];
  }, [productDetail]);

  // Separate text outputs from image outputs
  const textOutputs = useMemo(() => {
    return allOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return !/^https?:\/\//i.test(value);
    });
  }, [allOutputs]);

  const imageOutputs = useMemo(() => {
    return allOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return /^https?:\/\//i.test(value);
    });
  }, [allOutputs]);

  const selectedProduct = products.find((p: any) => p.id === productId);

  // Check permissions - AFTER all hooks are called
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>Solo los administradores pueden acceder a esta página de prueba.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "0,00 €";
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handlePromptChange = (id: string, value: any) => {
    // Solo actualiza el estado local, sin disparar API
    setPromptValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Llamado cuando el usuario termina de editar (blur/enter o selección)
  const handlePromptCommit = (id: string, value: any) => {
    const newValues = { ...promptValues, [id]: value };
    setPromptValues(newValues);
    recalculatePricing(newValues);
  };

  const handleDiagnoseProduct = async () => {
    if (!productId) return;
    
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const { data, error } = await supabase.functions.invoke("test-product-info", {
        body: { productId }
      });

      if (error) throw error;
      setDiagnosticResult(data);
    } catch (error: any) {
      console.error("Error al diagnosticar producto:", error);
      setDiagnosticResult({
        error: "Error al ejecutar diagnóstico",
        details: error.message
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/productos" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver a Productos
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">
            {selectedProduct ? getProductLabel(selectedProduct) : "Pruba de productos"}
          </h1>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p>Cargando productos...</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Product Selection & Configuration */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Selección de Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Product Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Producto</label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un producto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {getProductLabel(product)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Configuration */}
                {productId && isLoadingProduct && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cargando producto...</AlertTitle>
                    <AlertDescription>Obteniendo configuración del producto desde EasyQuote.</AlertDescription>
                  </Alert>
                )}

                {productId && !isLoadingProduct && !productDetail && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error al cargar el producto</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>El servidor de EasyQuote devolvió un error 500. Esto indica un problema de configuración en EasyQuote.</p>
                      <Button 
                        onClick={handleDiagnoseProduct} 
                        disabled={isDiagnosing}
                        size="sm"
                        variant="outline"
                      >
                        {isDiagnosing ? "Diagnosticando..." : "🔍 Diagnosticar Producto"}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {diagnosticResult && (
                  <Alert className={diagnosticResult.error ? "border-destructive" : "border-blue-500"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Resultado del Diagnóstico</AlertTitle>
                    <AlertDescription className="space-y-2">
                      {diagnosticResult.error ? (
                        <div className="space-y-2">
                          <p className="font-semibold">Error: {diagnosticResult.error}</p>
                          <p className="text-sm">Producto: {diagnosticResult.productName} (ID: {diagnosticResult.productId})</p>
                          <p className="text-sm">Estado HTTP: {diagnosticResult.status}</p>
                          
                          {diagnosticResult.diagnostics && (
                            <div className="mt-4 space-y-2">
                              <p className="font-semibold text-sm">Posibles causas:</p>
                              <ul className="list-disc list-inside text-sm space-y-1">
                                {diagnosticResult.diagnostics.suggestions?.map((suggestion: string, idx: number) => (
                                  <li key={idx}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {diagnosticResult.errorDetails && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-sm font-medium">Ver detalles técnicos</summary>
                              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(diagnosticResult.errorDetails, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-green-600 font-semibold">✅ El producto cargó correctamente</p>
                          <p className="text-sm mt-2">Prompts: {diagnosticResult.promptsCount}</p>
                          <p className="text-sm">Outputs: {diagnosticResult.outputsCount}</p>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {productId && !isLoadingProduct && productDetail && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-4">Configuración del Producto</h3>
                      <PromptsForm 
                        product={productDetail} 
                        values={promptValues} 
                        onChange={handlePromptChange}
                        onCommit={handlePromptCommit}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div>
            {productId && (
              <Card>
                <CardHeader>
                  <CardTitle>Resultados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isPricingLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Calculando resultados...</p>
                    </div>
                  )}

                  {!isPricingLoading && !isLoadingProduct && productDetail && textOutputs.length === 0 && imageOutputs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No hay resultados disponibles para esta configuración</p>
                    </div>
                  )}

                  {/* Text outputs */}
                  {textOutputs.length > 0 && (
                    <div className="space-y-2 text-sm">
                      {textOutputs.map((output, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{output.label || output.name}:</span>
                          <span className="font-medium">{output.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Image outputs at the end */}
                  {imageOutputs.length > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      {imageOutputs.map((output, index) => (
                        <div key={`${output.value}-${index}`} className="space-y-2">
                          <div className="text-sm font-medium">{output.label || output.name}</div>
                          <img
                            key={output.value}
                            src={output.value}
                            alt={output.label || output.name || `Imagen ${index + 1}`}
                            className="w-full max-w-md rounded border"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
