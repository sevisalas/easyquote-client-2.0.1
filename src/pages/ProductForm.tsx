import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EasyQuoteExcelFile {
  id: string;
  fileName: string;
  fileSizeKb: number;
  dateCreated: string;
  dateModified: string;
  isActive: boolean;
}

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

  // Fetch Excel files for dropdown
  const { data: excelFiles = [] } = useQuery({
    queryKey: ["easyquote-excel-files"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Error al obtener archivos Excel de EasyQuote");
      }

      const data = await response.json();
      return data.filter((file: EasyQuoteExcelFile) => file.isActive);
    },
  });

  // Prepare product data with new file (without creating in API yet)
  const createProductWithNewFileMutation = useMutation({
    mutationFn: async (data: { productName: string; file: File; currency: string }) => {
      // Just return the prepared data, don't create in API yet
      return {
        productName: data.productName,
        file: data.file,
        currency: data.currency,
        useNewFile: true
      };
    },
    onSuccess: (data) => {
      // Store the data temporarily in sessionStorage
      sessionStorage.setItem('pending_product', JSON.stringify({
        productName: data.productName,
        fileName: data.file.name,
        currency: data.currency,
        useNewFile: true
      }));
      
      // Store the file separately (can't stringify File object)
      const reader = new FileReader();
      reader.readAsDataURL(data.file);
      reader.onload = () => {
        sessionStorage.setItem('pending_product_file', reader.result as string);
        
        toast({
          title: "Producto preparado",
          description: "Ahora configura los prompts y outputs antes de crear el producto.",
        });
        
        // Navigate to configuration page
        navigate(`/admin/productos/nuevo/configurar`);
      };
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Prepare product data with existing file (without creating in API yet)
  const createProductMutation = useMutation({
    mutationFn: async (productData: { productName: string; excelfileId: string; currency: string }) => {
      // Just return the prepared data, don't create in API yet
      return productData;
    },
    onSuccess: (data) => {
      // Store the data temporarily in sessionStorage
      sessionStorage.setItem('pending_product', JSON.stringify({
        productName: data.productName,
        excelfileId: data.excelfileId,
        currency: data.currency,
        useNewFile: false
      }));
      
      toast({
        title: "Producto preparado",
        description: "Ahora configura los prompts y outputs antes de crear el producto.",
      });
      
      // Navigate to configuration page
      navigate(`/admin/productos/nuevo/configurar`);
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
