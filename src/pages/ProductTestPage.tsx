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
  name: string;
  default_value: number;
  description: string | null;
  type: string;
  prompts?: Array<{
    id: string;
    name: string;
    type: string;
    options?: string[];
    default_value?: any;
  }>;
}

export default function ProductTestPage() {
  const [searchParams] = useSearchParams();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);
  
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

  // Get selected product
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Calculate price when prompt values change
  useEffect(() => {
    if (selectedProduct) {
      // Simple calculation - in real implementation this would call the pricing API
      const basePrice = selectedProduct.default_value || 0;
      const quantity = promptValues.quantity || 1;
      setCalculatedPrice(basePrice * quantity);
    }
  }, [promptValues, selectedProductId, products, selectedProduct]);

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

  const handlePromptChange = (promptId: string, value: any) => {
    setPromptValues(prev => ({
      ...prev,
      [promptId]: value
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
            {selectedProduct ? selectedProduct.name : "Configurador de Producto"}
          </h1>
        </div>
      </div>

      {!selectedProduct ? (
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
                {/* Quantity - Always present */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={promptValues.quantity || 1}
                    onChange={(e) => handlePromptChange("quantity", parseInt(e.target.value) || 1)}
                    placeholder="1"
                  />
                </div>

                {/* Pages */}
                <div className="space-y-2">
                  <Label htmlFor="pages">Pages</Label>
                  <Input
                    id="pages"
                    type="number"
                    min="1"
                    step="1"
                    value={promptValues.pages || 25}
                    onChange={(e) => handlePromptChange("pages", parseInt(e.target.value) || 25)}
                    placeholder="25"
                  />
                </div>

                {/* Sides */}
                <div className="space-y-2">
                  <Label htmlFor="sides">Sides</Label>
                  <Select 
                    value={promptValues.sides || "single"} 
                    onValueChange={(value) => handlePromptChange("sides", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Binding Type */}
                <div className="space-y-2">
                  <Label>Binding Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: "perfect", label: "Perfect Binding" },
                      { value: "saddle", label: "Saddle Stitch" }, 
                      { value: "spiral", label: "Spiral" },
                      { value: "case", label: "Case" }
                    ].map((option) => (
                      <div
                        key={option.value}
                        className={`p-3 border rounded-lg cursor-pointer text-center ${
                          promptValues.binding === option.value 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handlePromptChange("binding", option.value)}
                      >
                        <div className="text-sm font-medium">{option.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Paper */}
                <div className="space-y-2">
                  <Label htmlFor="paper">Paper</Label>
                  <Select 
                    value={promptValues.paper || "60lb-uncoated"} 
                    onValueChange={(value) => handlePromptChange("paper", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60lb-uncoated">60 lb Uncoated</SelectItem>
                      <SelectItem value="80lb-coated">80 lb Coated</SelectItem>
                      <SelectItem value="100lb-coated">100 lb Coated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Paper Color */}
                <div className="space-y-2">
                  <Label>Paper Color</Label>
                  <div className="flex gap-3">
                    {[
                      { value: "white", color: "bg-white border-2", label: "White" },
                      { value: "yellow", color: "bg-yellow-200", label: "Yellow" },
                      { value: "green", color: "bg-green-200", label: "Green" }
                    ].map((option) => (
                      <div
                        key={option.value}
                        className={`w-16 h-16 rounded border-2 cursor-pointer ${option.color} ${
                          promptValues.paperColor === option.value 
                            ? 'ring-2 ring-primary ring-offset-2' 
                            : ''
                        }`}
                        onClick={() => handlePromptChange("paperColor", option.value)}
                        title={option.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Cover Paper */}
                <div className="space-y-2">
                  <Label htmlFor="coverPaper">Cover Paper</Label>
                  <Select 
                    value={promptValues.coverPaper || "80lb-cover-gloss"} 
                    onValueChange={(value) => handlePromptChange("coverPaper", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80lb-cover-gloss">80 lb Cover, Gloss</SelectItem>
                      <SelectItem value="100lb-cover-matte">100 lb Cover, Matte</SelectItem>
                      <SelectItem value="120lb-cover-satin">120 lb Cover, Satin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}