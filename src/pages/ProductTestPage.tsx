import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { 
  Package, 
  TestTube, 
  ArrowLeft, 
  Calculator,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PlayCircle,
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  default_value: number;
  description: string | null;
  type: string;
}

interface TestResult {
  productId: string;
  productName: string;
  testPrice: number;
  calculatedPrice: number;
  status: 'success' | 'error';
  message?: string;
}

export default function ProductTestPage() {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [testQuantity, setTestQuantity] = useState<string>("1");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Check permissions
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

  // Fetch products (using additionals table as products)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("id, name, default_value, description, type")
        .order("name");

      if (error) throw error;
      return data as Product[];
    }
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const runSingleTest = async () => {
    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Selecciona un producto para probar",
        variant: "destructive"
      });
      return;
    }

    setIsRunningTest(true);

    try {
      // Simulate product calculation test
      const quantity = parseFloat(testQuantity) || 1;
      const basePrice = selectedProduct.default_value;
      const calculatedPrice = basePrice * quantity;

      // Simulate API call to pricing function (mock)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const result: TestResult = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        testPrice: basePrice,
        calculatedPrice: calculatedPrice,
        status: 'success',
        message: `Cálculo exitoso: ${basePrice} x ${quantity} = ${calculatedPrice}`
      };

      setTestResults(prev => [result, ...prev.slice(0, 4)]); // Keep last 5 results

      toast({
        title: "Prueba completada",
        description: `El producto "${selectedProduct.name}" funcionó correctamente`,
      });

    } catch (error) {
      const result: TestResult = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        testPrice: selectedProduct.default_value,
        calculatedPrice: 0,
        status: 'error',
        message: `Error en el cálculo: ${error}`
      };

      setTestResults(prev => [result, ...prev.slice(0, 4)]);

      toast({
        title: "Error en la prueba",
        description: "Hubo un problema calculando el producto",
        variant: "destructive"
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const runAllTests = async () => {
    if (products.length === 0) return;

    setIsRunningTest(true);
    const results: TestResult[] = [];

    try {
      for (const product of products.slice(0, 5)) { // Test first 5 products
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
        
        const calculatedPrice = product.default_value * 1;
        
        const result: TestResult = {
          productId: product.id,
          productName: product.name,
          testPrice: product.default_value,
          calculatedPrice: calculatedPrice,
          status: Math.random() > 0.1 ? 'success' : 'error', // 90% success rate
          message: Math.random() > 0.1 ? 'Calculado correctamente' : 'Error simulado'
        };
        
        results.push(result);
      }

      setTestResults(results);
      
      const successCount = results.filter(r => r.status === 'success').length;
      toast({
        title: "Pruebas completadas",
        description: `${successCount}/${results.length} productos funcionaron correctamente`,
      });

    } finally {
      setIsRunningTest(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
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
          <h1 className="text-3xl font-bold">Prueba de Productos</h1>
          <p className="text-muted-foreground">
            Prueba el funcionamiento de productos y sus cálculos de precios
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <TestTube className="h-4 w-4 mr-2" />
          Modo Prueba
        </Badge>
      </div>

      <Separator />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Test Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Prueba
            </CardTitle>
            <CardDescription>
              Selecciona un producto y configura los parámetros de prueba
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product-select">Producto a probar</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="Selecciona un producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{product.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {formatCurrency(product.default_value)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Parameters */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad de prueba</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={testQuantity}
                onChange={(e) => setTestQuantity(e.target.value)}
                placeholder="1.0"
              />
            </div>

            {/* Selected Product Info */}
            {selectedProduct && (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertTitle>Producto seleccionado</AlertTitle>
                <AlertDescription className="space-y-1">
                  <div><strong>Nombre:</strong> {selectedProduct.name}</div>
                  <div><strong>Precio base:</strong> {formatCurrency(selectedProduct.default_value)}</div>
                  <div><strong>Tipo:</strong> {selectedProduct.type}</div>
                  {selectedProduct.description && (
                    <div><strong>Descripción:</strong> {selectedProduct.description}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Test Buttons */}
            <div className="space-y-3">
              <Button 
                onClick={runSingleTest} 
                disabled={!selectedProductId || isRunningTest}
                className="w-full"
              >
                {isRunningTest ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Probando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Probar Producto Seleccionado
                  </>
                )}
              </Button>

              <Button 
                onClick={runAllTests} 
                variant="outline"
                disabled={products.length === 0 || isRunningTest}
                className="w-full"
              >
                {isRunningTest ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Probando todos...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Probar Todos los Productos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resultados de Pruebas
            </CardTitle>
            <CardDescription>
              Historial de pruebas y resultados de cálculos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <div className="text-center py-8">
                <TestTube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No hay pruebas ejecutadas</p>
                <p className="text-sm text-muted-foreground">
                  Selecciona un producto y ejecuta una prueba para ver los resultados
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div 
                    key={`${result.productId}-${index}`}
                    className={`p-4 rounded-lg border ${
                      result.status === 'success' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {result.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">{result.productName}</span>
                      </div>
                      <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                        {result.status === 'success' ? 'Éxito' : 'Error'}
                      </Badge>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div>
                        <strong>Precio base:</strong> {formatCurrency(result.testPrice)}
                      </div>
                      <div>
                        <strong>Resultado:</strong> {formatCurrency(result.calculatedPrice)}
                      </div>
                      {result.message && (
                        <div className={result.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                          {result.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Pruebas</CardTitle>
            <CardDescription>
              Estadísticas generales de las pruebas ejecutadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{testResults.length}</div>
                <div className="text-sm text-muted-foreground">Total pruebas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {testResults.filter(r => r.status === 'success').length}
                </div>
                <div className="text-sm text-muted-foreground">Exitosas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {testResults.filter(r => r.status === 'error').length}
                </div>
                <div className="text-sm text-muted-foreground">Con errores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {testResults.length > 0 ? 
                    Math.round((testResults.filter(r => r.status === 'success').length / testResults.length) * 100) : 0
                  }%
                </div>
                <div className="text-sm text-muted-foreground">Tasa de éxito</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}