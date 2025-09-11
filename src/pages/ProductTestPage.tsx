import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PromptsForm from "@/components/quotes/PromptsForm";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const fetchProducts = async () => {
  const token = localStorage.getItem("easyquote_token");
  if (!token) throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
  
  const { data, error } = await supabase.functions.invoke("easyquote-products", {
    body: { token },
  });
  
  if (error) throw error;
  
  const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
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
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});
  const [productDetail, setProductDetail] = useState<any>(null);
  
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Debounce prompt values
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPromptValues(promptValues);
    }, 800);
    return () => clearTimeout(timer);
  }, [promptValues]);

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: fetchProducts,
    enabled: !!localStorage.getItem("easyquote_token")
  });

  // Fetch product detail when productId changes
  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!productId) {
        setProductDetail(null);
        return;
      }
      
      const token = localStorage.getItem("easyquote_token");
      if (!token) return;

      try {
        const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
          body: { 
            token, 
            productId: productId 
          },
        });
        
        if (error) throw error;
        
        setProductDetail(data);
        
      } catch (error) {
        console.error("Error fetching product detail:", error);
        setProductDetail(null);
      }
    };

    fetchProductDetail();
  }, [productId]);

  // Fetch pricing data when prompts change OR when productDetail loads (initial load)
  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["easyquote-pricing", productId, debouncedPromptValues],
    enabled: !!localStorage.getItem("easyquote_token") && !!productId,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      
      const norm: Record<string, any> = {};
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        if (v === "" || v === undefined || v === null) return;
        if (typeof v === "string") {
          const trimmed = v.trim();
          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            norm[k] = trimmed.toLowerCase();
          } else {
            const asNum = parseFloat(trimmed);
            norm[k] = Number.isNaN(asNum) ? trimmed : asNum;
          }
        } else {
          norm[k] = v;
        }
      });

      const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
        body: { token, productId, inputs: Object.entries(norm).map(([id, value]) => ({ id, value })) },
      });
      if (error) throw error;
      
      console.log("Pricing data received:", data);
      console.log("Pricing outputValues:", data?.outputValues);
      console.log("Pricing price field:", data?.price);
      console.log("All pricing fields:", Object.keys(data || {}));
      
      return data;
    },
  });

  // Auto-select product if productId is in URL params
  useEffect(() => {
    const productIdFromUrl = searchParams.get('productId');
    if (productIdFromUrl && products.length > 0) {
      const productExists = products.find((p: any) => p.id === productIdFromUrl);
      if (productExists) {
        setProductId(productIdFromUrl);
      }
    }
  }, [searchParams, products]);

  // Derive outputs from pricing data - based on real API response structure
  const outputs = useMemo(() => {
    if (!pricing) return [];
    
    // Check different possible structures for outputs
    const outputValues = pricing.outputValues || pricing.outputs || pricing.results || [];
    console.log("Processing outputs:", outputValues);
    
    return Array.isArray(outputValues) ? outputValues : [];
  }, [pricing]);

  // Show ALL outputs exactly as they come from the API - no filtering, no modifications
  const allOutputs = useMemo(() => {
    if (!pricing) return [];
    
    const outputValues = pricing.outputValues || pricing.outputs || pricing.results || [];
    console.log("Showing ALL raw outputs:", outputValues);
    
    return Array.isArray(outputValues) ? outputValues : [];
  }, [pricing]);

  const selectedProduct = products.find((p: any) => p.id === productId);

  // Check permissions - AFTER all hooks are called
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden acceder a esta página de prueba.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "0,00 €";
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const handlePromptChange = (id: string, value: any) => {
    setPromptValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/calculadores" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver a Calculadores
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">
            {selectedProduct ? getProductLabel(selectedProduct) : "Configurador de Producto"}
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
                {productDetail && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-4">Configuración del Producto</h3>
                      <PromptsForm
                        product={productDetail}
                        values={promptValues}
                        onChange={handlePromptChange}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div>
            {allOutputs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Resultados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {allOutputs.map((output, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{output.label || output.name}:</span>
                        <span className="font-medium">{output.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
