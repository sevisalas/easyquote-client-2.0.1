import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Layers } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEasyQuoteExcelFiles } from "@/hooks/useEasyQuoteExcelFiles";
import { supabase } from "@/integrations/supabase/client";

export default function ProductForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    productName: "",
    isActive: true,
    excelfileId: "",
    currency: "USD",
  });

  const [useNewFile, setUseNewFile] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Estado para tipo de producto: simple, encuadernado o compuesto
  type ProductType = 'simple' | 'encuadernado' | 'composite';
  const [productType, setProductType] = useState<ProductType>('simple');

  // Obtener organization_id del usuario actual
  const { data: userRole } = useQuery({
    queryKey: ['current-user-role'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_current_user_role');
      if (error) throw error;
      return data?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch Excel files for dropdown (cacheado vía edge function)
  const { data: excelFiles = [] } = useEasyQuoteExcelFiles({
    select: (files) => files.filter((f) => f.isActive),
  });

  // Función para crear producto compuesto (solo en base de datos local, sin EasyQuote API)
  const createCompositeProductMutation = useMutation({
    mutationFn: async (data: { productName: string }) => {
      if (!userRole?.organization_id) throw new Error("No se pudo obtener la organización");

      // Generar un ID único para el producto compuesto (prefijo 'comp_' para distinguirlo)
      const compositeId = `comp_${crypto.randomUUID()}`;

      // Guardar en product_component_settings como producto compuesto
      const { error } = await supabase
        .from('product_component_settings')
        .upsert({
          organization_id: userRole.organization_id,
          easyquote_product_id: compositeId,
          is_composite: true,
          is_component: false,
          enabled_components: [],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,easyquote_product_id',
        });

      if (error) throw error;

      // Guardar el nombre del producto en una tabla de metadatos o usar composite_product_prompts
      // Por ahora guardamos el nombre como un "prompt" especial de tipo metadata
      // TODO: Considerar crear una tabla composite_products para metadatos
      
      return { id: compositeId, productName: data.productName };
    },
    onSuccess: async (data) => {
      toast({
        title: "Producto compuesto creado",
        description: "El contenedor se ha creado. Ahora define los datos de entrada y salida generales.",
      });
      
      await queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      await queryClient.invalidateQueries({ queryKey: ["product-component-settings"] });
      
      // Navegar a la gestión de productos para configurar el compuesto
      navigate(`/admin/productos?editProduct=${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Función para guardar configuración de producto según su tipo (para simple/encuadernado)
  const saveProductTypeSettings = async (productId: string) => {
    if (productType === 'simple' || productType === 'composite' || !userRole?.organization_id) return;

    // Solo para encuadernado
    const { error } = await supabase
      .from('product_component_settings')
      .upsert({
        organization_id: userRole.organization_id,
        easyquote_product_id: productId,
        is_composite: true,
        is_component: false,
        enabled_components: ['cubierta', 'interior_1'], // Preset encuadernado por defecto
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,easyquote_product_id',
      });

    if (error) {
      console.error('Error saving product type settings:', error);
      toast({
        title: "Advertencia",
        description: "El producto se creó pero hubo un error al guardar la configuración",
        variant: "destructive",
      });
    }
  };

  // Upload Excel and create product with new file
  const createProductWithNewFileMutation = useMutation({
    mutationFn: async (data: { productName: string; file: File; currency: string }) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de EasyQuote disponible");

      // First upload the Excel file
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(data.file);
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      const uploadResponse = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: data.file.name,
          file: base64,
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        throw new Error(`Error al subir archivo: ${errorData}`);
      }

      // La API puede devolver un string simple con el ID o un objeto JSON
      const uploadResponseText = await uploadResponse.text();
      let fileId: string;
      
      try {
        const uploadResult = JSON.parse(uploadResponseText);
        fileId = typeof uploadResult === 'string' ? uploadResult : uploadResult.id;
      } catch {
        // Si no es JSON válido, asumimos que es el ID directamente
        fileId = uploadResponseText.replace(/['"]/g, '').trim();
      }

      // Then create the product with the uploaded file
      const productResponse = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: data.productName,
          excelfileId: fileId,
          currency: data.currency,
          isActive: true,
        }),
      });

      if (!productResponse.ok) {
        const errorText = await productResponse.text();
        throw new Error(`Error al crear producto: ${errorText}`);
      }

      const productResponseText = await productResponse.text();
      try {
        return JSON.parse(productResponseText);
      } catch {
        return productResponseText.replace(/['"]/g, '').trim();
      }
    },
    onSuccess: async (data) => {
      await saveProductTypeSettings(data);
      
      const typeLabel = productType === 'composite' ? ' (compuesto)' : productType === 'encuadernado' ? ' (encuadernado)' : '';
      
      toast({
        title: "Producto creado",
        description: `El producto${typeLabel} se ha creado correctamente.`,
      });
      
      // Invalidate products cache before navigating
      await queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      
      navigate(`/admin/productos?editProduct=${data}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create product with existing Excel file
  const createProductMutation = useMutation({
    mutationFn: async (productData: { productName: string; excelfileId: string; currency: string }) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de EasyQuote disponible");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: productData.productName,
          excelfileId: productData.excelfileId,
          currency: productData.currency,
          isActive: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al crear producto: ${errorText}`);
      }

      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch {
        return responseText.replace(/['"]/g, '').trim();
      }
    },
    onSuccess: async (data) => {
      await saveProductTypeSettings(data);
      
      const typeLabel = productType === 'composite' ? ' (compuesto)' : productType === 'encuadernado' ? ' (encuadernado)' : '';
      
      toast({
        title: "Producto creado",
        description: `El producto${typeLabel} se ha creado correctamente.`,
      });
      
      // Invalidate products cache before navigating
      await queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      
      navigate(`/admin/productos?editProduct=${data}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del producto es obligatorio",
        variant: "destructive",
      });
      return;
    }

    // Para productos compuestos: crear solo en base de datos local (sin Excel, sin EasyQuote API)
    if (productType === 'composite') {
      createCompositeProductMutation.mutate({
        productName: formData.productName,
      });
      return;
    }

    // Para productos simple/encuadernado: requieren Excel y EasyQuote API
    if (useNewFile) {
      if (!uploadedFile) {
        toast({
          title: "Error",
          description: "Debes seleccionar un archivo Excel",
          variant: "destructive",
        });
        return;
      }

      createProductWithNewFileMutation.mutate({
        productName: formData.productName,
        file: uploadedFile,
        currency: formData.currency,
      });
    } else {
      if (!formData.excelfileId) {
        toast({
          title: "Error",
          description: "Debes seleccionar un archivo Excel existente",
          variant: "destructive",
        });
        return;
      }

      createProductMutation.mutate({
        productName: formData.productName,
        excelfileId: formData.excelfileId,
        currency: formData.currency,
      });
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isCreating = createProductMutation.isPending || 
                     createProductWithNewFileMutation.isPending || 
                     createCompositeProductMutation.isPending;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin/productos")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a productos
        </Button>

        <h1 className="text-3xl font-bold">{isEdit ? "Editar producto" : "Crear nuevo producto"}</h1>
        <p className="text-muted-foreground mt-2">
          {isEdit
            ? "Modifica la información del producto existente"
            : "Crea un nuevo producto en el catálogo de EasyQuote"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del producto</CardTitle>
          <CardDescription>Completa los datos del producto</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selección del modo de archivo Excel - Solo para simple/encuadernado */}
            {productType !== 'composite' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Archivo Excel (Calculadora)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setUseNewFile(!useNewFile)}>
                    {useNewFile ? "Usar Excel Existente" : "Subir Nuevo Excel"}
                  </Button>
                </div>

                {useNewFile ? (
                  <div className="space-y-2">
                    <Label htmlFor="uploadFile">Seleccionar archivo desde el ordenador</Label>
                    <Input
                      id="uploadFile"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    />
                    {uploadedFile && (
                      <p className="text-sm text-muted-foreground">Archivo seleccionado: {uploadedFile.name}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="excelfileId">Seleccionar archivo existente</Label>
                    <Select
                      value={formData.excelfileId || "none"}
                      onValueChange={(value) => handleChange("excelfileId", value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un archivo Excel..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecciona un archivo...</SelectItem>
                        {excelFiles.map((file) => (
                          <SelectItem key={file.id} value={file.id}>
                            {file.fileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="productName">
                Nombre del producto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="productName"
                value={formData.productName}
                onChange={(e) => handleChange("productName", e.target.value)}
                placeholder="Pon aquí le nombre del nuevo producto"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange("isActive", checked)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Producto activo
              </Label>
            </div>

            {/* Tipo de producto */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Tipo de producto
              </Label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Simple */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    productType === 'simple' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setProductType('simple')}
                >
                  <div className="font-medium">Simple</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Producto estándar con su propio Excel de cálculo
                  </p>
                </div>

                {/* Encuadernado (preset predefinido) */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    productType === 'encuadernado' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setProductType('encuadernado')}
                >
                  <div className="font-medium">Encuadernado</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Preset con Cubierta + Interiores predefinidos
                  </p>
                </div>

                {/* Compuesto (arquitectura flexible) */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    productType === 'composite' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setProductType('composite')}
                >
                  <div className="font-medium">Compuesto</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contenedor flexible con componentes personalizados
                  </p>
                </div>
              </div>

              {/* Info para producto encuadernado */}
              {productType === 'encuadernado' && (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                  <p className="text-sm text-foreground">
                    <strong>Encuadernado:</strong> Producto con componentes predefinidos:
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    <li><strong>Cubierta:</strong> papel o acabado distinto al interior</li>
                    <li><strong>Interior 1:</strong> páginas interiores principales</li>
                    <li><strong>Interior 2:</strong> segundas páginas interiores (opcional)</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Podrás asignar prompts y outputs a cada componente después de crear el producto.
                  </p>
                </div>
              )}

              {/* Info para producto compuesto */}
              {productType === 'composite' && (
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/20 space-y-2">
                  <p className="text-sm text-foreground">
                    <strong>Producto compuesto</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Los datos de entrada y salida se definen directamente en la app. Después de crearlo podrás:
                  </p>
                  <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Definir los datos de entrada generales (ej: Cantidad, Formato)</li>
                    <li>Definir los datos de salida generales (ej: Precio Total)</li>
                    <li>Asociar componentes EasyQuote que harán los cálculos</li>
                  </ol>
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription>
                Los campos marcados con <span className="text-destructive">*</span> son obligatorios
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/productos")}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Crear producto
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
