import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface Product {
  id: string;
  productName: string;
  currency: string;
  isActive: boolean;
}

interface ProductDetail {
  id?: string;
  name?: string;
  price?: number;
  prompts?: Array<{
    id: string;
    name: string;
    type: string;
    options?: any[];
    default_value?: any;
    images?: string[];
  }>;
  images?: string[];
}

export default function ProductTestPage() {
  const [searchParams] = useSearchParams();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Fetch products from EasyQuote API - MUST be called before any conditional returns
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
      
      const { data, error } = await supabase.functions.invoke("easyquote-products", {
        body: { token },
      });
      
      if (error) throw error;
      
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      return list as Product[];
    },
    enabled: !!localStorage.getItem("easyquote_token")
  });

  // Auto-select product if productId is in URL params
  useEffect(() => {
    const productId = searchParams.get('productId');
    if (productId) {
      setSelectedProductId(productId);
    }
  }, [searchParams]);

  // Fetch product detail when selectedProductId changes
  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!selectedProductId) return;
      
      const token = localStorage.getItem("easyquote_token");
      if (!token) return;

      setIsLoadingDetail(true);
      try {
        console.log("Fetching product detail for:", selectedProductId);
        const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
          body: { 
            token, 
            productId: selectedProductId 
          },
        });
        
        if (error) throw error;
        
        console.log("Product detail received:", data);
        setProductDetail(data);
        
        // Set default values from prompts
        if (data?.prompts) {
          const defaults: Record<string, any> = {};
          data.prompts.forEach((prompt: any) => {
            if (prompt.default_value !== undefined && prompt.default_value !== null) {
              defaults[prompt.id] = prompt.default_value;
            }
          });
          console.log("Setting default values:", defaults);
          setPromptValues(prev => ({ ...defaults, ...prev }));
        }
        
      } catch (error) {
        console.error("Error fetching product detail:", error);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    fetchProductDetail();
  }, [selectedProductId]);

  // Calculate price when prompt values change
  useEffect(() => {
    const calculatePrice = async () => {
      if (!selectedProductId || Object.keys(promptValues).length === 0) return;
      
      const token = localStorage.getItem("easyquote_token");
      if (!token) return;

      try {
        console.log("Calculating price with inputs:", promptValues);
        const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
          body: { 
            token, 
            productId: selectedProductId,
            inputs: promptValues
          },
        });
        
        if (error) throw error;
        
        console.log("Price calculation result:", data);
        setCalculatedPrice(data?.price || 0);
        
      } catch (error) {
        console.error("Error calculating price:", error);
        // Fallback to base price or 0
        setCalculatedPrice(productDetail?.price || 0);
      }
    };

    // Debounce the price calculation
    const timer = setTimeout(calculatePrice, 500);
    return () => clearTimeout(timer);
  }, [promptValues, selectedProductId, productDetail]);

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

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const displayName = productDetail?.name || selectedProduct?.productName || "Configurador de Producto";

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "0,00 €";
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const handlePromptChange = (promptId: string, value: any) => {
    console.log("Prompt change:", promptId, value);
    setPromptValues(prev => ({
      ...prev,
      [promptId]: value
    }));
  };

  const renderPromptField = (prompt: any) => {
    const { id, name, type, options, default_value, images } = prompt;
    const currentValue = promptValues[id] !== undefined ? promptValues[id] : default_value;

    switch (type?.toLowerCase()) {
      case 'select':
      case 'dropdown':
        return (
          <div key={id} className="space-y-2">
            <Label htmlFor={id}>{name}</Label>
            <Select value={currentValue?.toString() || ""} onValueChange={(value) => handlePromptChange(id, value)}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecciona ${name.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {options?.map((option: any, index: number) => (
                  <SelectItem key={index} value={option?.value?.toString() || option?.toString() || index.toString()}>
                    {option?.label || option?.name || option?.toString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'imagepicker':
        return (
          <div key={id} className="space-y-2">
            <Label>{name}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {images?.map((image: any, index: number) => (
                <div
                  key={index}
                  className={`relative border-2 rounded-lg cursor-pointer overflow-hidden ${
                    currentValue === (image?.value || image?.id || index)
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handlePromptChange(id, image?.value || image?.id || index)}
                >
                  {image?.url ? (
                    <img 
                      src={image.url} 
                      alt={image?.label || image?.name || name}
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                      <span className="text-xs text-center px-2">
                        {image?.label || image?.name || `Opción ${index + 1}`}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                    {image?.label || image?.name || `Opción ${index + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'number':
        return (
          <div key={id} className="space-y-2">
            <Label htmlFor={id}>{name}</Label>
            <Input
              id={id}
              type="number"
              min="0"
              step="1"
              value={currentValue || ""}
              onChange={(e) => handlePromptChange(id, parseInt(e.target.value) || 0)}
              placeholder={default_value?.toString() || "0"}
            />
          </div>
        );

      case 'text':
      default:
        return (
          <div key={id} className="space-y-2">
            <Label htmlFor={id}>{name}</Label>
            <Input
              id={id}
              type="text"
              value={currentValue || ""}
              onChange={(e) => handlePromptChange(id, e.target.value)}
              placeholder={default_value?.toString() || ""}
            />
          </div>
        );
    }
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
          <h1 className="text-3xl font-bold">{displayName}</h1>
        </div>
      </div>

      {isLoading || isLoadingDetail ? (
        <div className="text-center py-8">
          <p>Cargando producto...</p>
        </div>
      ) : !selectedProduct ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Producto no encontrado</AlertTitle>
          <AlertDescription>
            No se pudo cargar el producto. Verifica que el enlace sea correcto.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Product Configuration */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {productDetail?.prompts && productDetail.prompts.length > 0 ? (
                  productDetail.prompts.map(renderPromptField)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay campos configurables para este producto</p>
                    <p className="text-sm">Los valores por defecto se aplicarán automáticamente</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Price Display */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Precio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {formatCurrency(calculatedPrice)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Precio (IVA incl.): {formatCurrency(calculatedPrice * 1.21)}
                  </div>
                </div>
                
                {/* Debug Info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
                    <div><strong>Product ID:</strong> {selectedProductId}</div>
                    <div><strong>Inputs:</strong> {JSON.stringify(promptValues, null, 2)}</div>
                    <div><strong>Detail loaded:</strong> {productDetail ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}