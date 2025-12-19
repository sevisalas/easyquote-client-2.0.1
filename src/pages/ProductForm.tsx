import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Layers } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEasyQuoteExcelFiles } from "@/hooks/useEasyQuoteExcelFiles";
import { supabase } from "@/integrations/supabase/client";

export default function ProductForm() {
  const navigate = useNavigate();
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
  
  // Estado para tipo de producto
  type ProductType = 'simple' | 'composite' | 'preset';
  const [productType, setProductType] = useState<ProductType>('simple');
  const [selectedPreset, setSelectedPreset] = useState<string>('encuadernado');
  const [customComponents, setCustomComponents] = useState<string[]>([]);
  const [newComponentName, setNewComponentName] = useState('');

  // Presets predefinidos
  const PRESETS = {
    encuadernado: {
      label: 'Encuadernado',
      description: 'Cubierta + Interior(es)',
      components: ['cubierta', 'interior_1', 'interior_2'],
      defaultEnabled: ['cubierta', 'interior_1'],
    },
  };

  // Componentes habilitados según el preset
  const [presetEnabledComponents, setPresetEnabledComponents] = useState<string[]>(['cubierta', 'interior_1']);

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

  // Función para guardar configuración de componentes
  const saveComponentSettings = async (productId: string) => {
    if (productType === 'simple' || !userRole?.organization_id) return;

    let components: string[] = [];
    if (productType === 'preset') {
      components = presetEnabledComponents;
    } else if (productType === 'composite') {
      components = customComponents;
    }

    if (components.length === 0) return;

    const { error } = await supabase
      .from('product_component_settings')
      .upsert({
        organization_id: userRole.organization_id,
        easyquote_product_id: productId,
        is_composite: true,
        enabled_components: components,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,easyquote_product_id',
      });

    if (error) {
      console.error('Error saving component settings:', error);
      toast({
        title: "Advertencia",
        description: "El producto se creó pero hubo un error al guardar la configuración de componentes",
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
      await saveComponentSettings(data);
      
      const typeLabel = productType === 'simple' ? '' : 
        productType === 'preset' ? ` (${PRESETS[selectedPreset as keyof typeof PRESETS]?.label})` : 
        ' (compuesto)';
      
      toast({
        title: "Producto creado",
        description: `El producto${typeLabel} se ha creado correctamente.`,
      });
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
      await saveComponentSettings(data);
      
      const typeLabel = productType === 'simple' ? '' : 
        productType === 'preset' ? ` (${PRESETS[selectedPreset as keyof typeof PRESETS]?.label})` : 
        ' (compuesto)';
      
      toast({
        title: "Producto creado",
        description: `El producto${typeLabel} se ha creado correctamente.`,
      });
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

    // Si se va a subir un nuevo archivo
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
      // Si se usa un archivo existente
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

  const handlePresetComponentToggle = (component: string) => {
    setPresetEnabledComponents(prev => 
      prev.includes(component) 
        ? prev.filter(c => c !== component)
        : [...prev, component]
    );
  };

  const addCustomComponent = () => {
    const name = newComponentName.trim().toLowerCase().replace(/\s+/g, '_');
    if (name && !customComponents.includes(name)) {
      setCustomComponents(prev => [...prev, name]);
      setNewComponentName('');
    }
  };

  const removeCustomComponent = (component: string) => {
    setCustomComponents(prev => prev.filter(c => c !== component));
  };

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
            {/* Selección del modo de archivo Excel */}
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
                    Producto estándar sin componentes
                  </p>
                </div>

                {/* Preset */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    productType === 'preset' 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setProductType('preset')}
                >
                  <div className="font-medium">Encuadernado</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cubierta + Interior(es)
                  </p>
                </div>

                {/* Compuesto personalizado */}
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
                    Define tus propios componentes
                  </p>
                </div>
              </div>

              {/* Configuración de preset Encuadernado */}
              {productType === 'preset' && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Componentes del encuadernado:
                  </Label>
                  <div className="space-y-3">
                    {PRESETS.encuadernado.components.map((comp) => {
                      const labels: Record<string, string> = {
                        cubierta: 'Cubierta',
                        interior_1: 'Interior 1',
                        interior_2: 'Interior 2',
                      };
                      const isRequired = comp === 'interior_1';
                      return (
                        <div key={comp} className="flex items-center space-x-2">
                          <Checkbox
                            id={`preset-${comp}`}
                            checked={presetEnabledComponents.includes(comp)}
                            disabled={isRequired}
                            onCheckedChange={() => !isRequired && handlePresetComponentToggle(comp)}
                          />
                          <Label 
                            htmlFor={`preset-${comp}`} 
                            className={`cursor-pointer font-normal ${isRequired ? 'text-muted-foreground' : ''}`}
                          >
                            {labels[comp]} {isRequired && <span className="text-xs">(obligatorio)</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Configuración de componentes personalizados */}
              {productType === 'composite' && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Componentes personalizados:
                  </Label>
                  
                  {/* Añadir nuevo componente */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre del componente..."
                      value={newComponentName}
                      onChange={(e) => setNewComponentName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomComponent())}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addCustomComponent}>
                      Añadir
                    </Button>
                  </div>

                  {/* Lista de componentes */}
                  {customComponents.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {customComponents.map((comp) => (
                        <div 
                          key={comp}
                          className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                          {comp}
                          <button
                            type="button"
                            onClick={() => removeCustomComponent(comp)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Añade componentes para crear un producto compuesto personalizado
                    </p>
                  )}
                </div>
              )}

              {productType !== 'simple' && (
                <p className="text-xs text-muted-foreground">
                  Después de crear el producto, podrás asignar cada prompt/output a su componente.
                </p>
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
                disabled={createProductMutation.isPending || createProductWithNewFileMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProductMutation.isPending || createProductWithNewFileMutation.isPending}
              >
                {createProductMutation.isPending || createProductWithNewFileMutation.isPending ? (
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
