import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropzone } from "react-dropzone";
import { toast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Plus, Trash2, Upload, AlertCircle, CheckCircle2, Package, Edit, Crown, Copy, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { BulkPromptsDialog } from "@/components/quotes/BulkPromptsDialog";
import { BulkOutputsDialog } from "@/components/quotes/BulkOutputsDialog";

interface EasyQuoteExcelFile {
  id: string;
  fileName: string;
  fileSizeKb: number;
  dateCreated: string;
  dateModified: string;
  isActive: boolean;
  isPlanCompliant: boolean;
  subscriberId?: string;
  excelfilesSheets: any[];
  products: any[];
}

export default function ExcelFiles() {
  const { organization, membership } = useSubscription();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<EasyQuoteExcelFile | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [isUpdateExcelDialogOpen, setIsUpdateExcelDialogOpen] = useState(false);
  const [selectedFileForUpdate, setSelectedFileForUpdate] = useState<File | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  
  // Product creation state
  const [newProductData, setNewProductData] = useState({ 
    productName: "", 
    excelFileId: "", 
    currency: ""
  });
  const [selectedFileForProduct, setSelectedFileForProduct] = useState<File | null>(null);
  const [createdProduct, setCreatedProduct] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState("basic");
  const [isBulkPromptsDialogOpen, setIsBulkPromptsDialogOpen] = useState(false);
  const [isBulkOutputsDialogOpen, setIsBulkOutputsDialogOpen] = useState(false);
  
  // Get the subscriber ID from the EasyQuote token
  const getSubscriberIdFromToken = () => {
    const token = localStorage.getItem("easyquote_token");
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.SubscriberID || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const subscriberId = getSubscriberIdFromToken();
  const queryClient = useQueryClient();

  // Get user's files from local Supabase
  const { data: files = [] } = useQuery({
    queryKey: ["excel-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excel_files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Get files from EasyQuote API
  const { data: easyQuoteFiles, refetch, isLoading, error } = useQuery({
    queryKey: ["easyquote-files", includeInactive],
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No EasyQuote token available");
      }

      const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch files from EasyQuote");
      }

      const data = await response.json();
      return includeInactive ? data : data.filter((file: EasyQuoteExcelFile) => file.isActive);
    },
    enabled: !!localStorage.getItem("easyquote_token")
  });

  // Upload Excel file to EasyQuote API
  const uploadToEasyQuoteMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64String = result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          file: base64
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error uploading file: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (uploadedFile) => {
      toast({
        title: "Archivo subido",
        description: "El archivo Excel se ha subido correctamente.",
      });
      setNewProductData(prev => ({ ...prev, excelFileId: uploadedFile.id }));
      setSelectedFileForProduct(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error al subir archivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (productData: { productName: string; excelFileId: string; currency?: string }) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: productData.productName,
          excelfileId: productData.excelFileId,
          currency: productData.currency,
          isActive: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error creating product: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (product) => {
      toast({
        title: "Producto creado",
        description: "El producto base se ha creado correctamente. Ahora puedes añadir datos de entrada y salida.",
      });
      setCreatedProduct(product);
      setCurrentStep("inputs");
    },
    onError: (error) => {
      toast({
        title: "Error al crear producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Regular upload mutation for file management
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      
      const { data, error } = await supabase.storage
        .from("excel-files")
        .upload(`${Date.now()}_${file.name}`, file);

      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuario no autenticado");

      const { error: dbError } = await supabase
        .from("excel_files")
        .insert({
          filename: file.name,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          file_id: data.path,
          user_id: userData.user.id
        });

      if (dbError) throw dbError;

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Archivo subido correctamente",
      });
      setIsUploadDialogOpen(false);
      setSelectedFileForUpload(null);
      queryClient.invalidateQueries({ queryKey: ["excel-files"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (file: any) => {
      if (file.file_id) {
        const { error: storageError } = await supabase.storage
          .from("excel-files")
          .remove([file.file_id]);

        if (storageError) throw storageError;
      }

      const { error: dbError } = await supabase
        .from("excel_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Archivo eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["excel-files"] });
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar archivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle file selection for product creation
  const handleFileSelectForProduct = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileForProduct(file);
    }
  };

  const handleFileUploadForProduct = () => {
    if (selectedFileForProduct) {
      uploadToEasyQuoteMutation.mutate(selectedFileForProduct);
    }
  };

  const handleCreateProduct = () => {
    if (newProductData.productName && newProductData.excelFileId) {
      createProductMutation.mutate(newProductData);
    }
  };

  const handleBulkSavePrompts = async (prompts: any[]) => {
    console.log("Saving prompts:", prompts);
    setCurrentStep("outputs");
  };

  const handleBulkSaveOutputs = async (outputs: any[]) => {
    console.log("Saving outputs:", outputs);
    setIsCreateProductDialogOpen(false);
    setCreatedProduct(null);
    setCurrentStep("basic");
    setNewProductData({ productName: "", excelFileId: "", currency: "" });
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFileForUpload(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleDownload = async (file: any) => {
    if (!file.file_id) return;

    try {
      const { data, error } = await supabase.storage
        .from("excel-files")
        .download(file.file_id);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const handleSetMaster = async (fileId: string) => {
    try {
      // First, unset all master files
      await supabase
        .from("excel_files")
        .update({ is_master: false })
        .neq("id", "");

      // Then set the selected file as master
      const { error } = await supabase
        .from("excel_files")
        .update({ is_master: true })
        .eq("file_id", fileId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Archivo maestro actualizado",
      });
      queryClient.invalidateQueries({ queryKey: ["excel-files"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo establecer como archivo maestro",
        variant: "destructive",
      });
    }
  };

  const masterFile = files.find(file => file.is_master);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archivos Excel</h1>
          <p className="text-muted-foreground mt-2">
            Administra archivos Excel desde EasyQuote para tus productos
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isCreateProductDialogOpen} onOpenChange={setIsCreateProductDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Crear producto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Crear nuevo producto</DialogTitle>
                <DialogDescription>
                  Sigue los pasos para crear un producto completo con datos de entrada y salida.
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={currentStep} onValueChange={setCurrentStep} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">1. Datos básicos</TabsTrigger>
                  <TabsTrigger value="inputs" disabled={!createdProduct}>2. Datos entrada</TabsTrigger>
                  <TabsTrigger value="outputs" disabled={!createdProduct}>3. Datos salida</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="productName">Nombre del producto *</Label>
                      <Input
                        id="productName"
                        value={newProductData.productName}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, productName: e.target.value }))}
                        placeholder="Ingresa el nombre del producto"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Archivo Excel *</Label>
                      <Tabs defaultValue="existing" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="existing">Usar existente</TabsTrigger>
                          <TabsTrigger value="upload">Subir nuevo</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="existing">
                          <Select 
                            value={newProductData.excelFileId} 
                            onValueChange={(value) => setNewProductData(prev => ({ ...prev, excelFileId: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un archivo Excel" />
                            </SelectTrigger>
                            <SelectContent>
                              {easyQuoteFiles?.filter(file => file.isActive && file.isPlanCompliant).map((file) => (
                                <SelectItem key={file.id} value={file.id}>
                                  {file.fileName} ({file.fileSizeKb}KB)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TabsContent>
                        
                        <TabsContent value="upload">
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handleFileSelectForProduct}
                              disabled={uploadToEasyQuoteMutation.isPending}
                            />
                            {selectedFileForProduct && (
                              <p className="text-sm text-muted-foreground">
                                Archivo seleccionado: {selectedFileForProduct.name}
                              </p>
                            )}
                            <Button
                              onClick={handleFileUploadForProduct}
                              disabled={!selectedFileForProduct || uploadToEasyQuoteMutation.isPending}
                              variant="outline"
                              size="sm"
                            >
                              {uploadToEasyQuoteMutation.isPending ? "Subiendo..." : "Subir archivo"}
                            </Button>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="currency">Moneda</Label>
                      <Select 
                        value={newProductData.currency} 
                        onValueChange={(value) => setNewProductData(prev => ({ ...prev, currency: value || undefined }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una moneda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - Dólar estadounidense</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - Libra esterlina</SelectItem>
                          <SelectItem value="JPY">JPY - Yen japonés</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateProductDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateProduct}
                      disabled={!newProductData.productName || !newProductData.excelFileId || createProductMutation.isPending}
                    >
                      {createProductMutation.isPending ? "Creando..." : "Crear producto"}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="inputs" className="space-y-4">
                  <div className="text-center py-4">
                    <h3 className="text-lg font-medium mb-2">Añadir datos de entrada</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ahora puedes añadir los campos de entrada para tu producto "{createdProduct?.productName}"
                    </p>
                    <Button onClick={() => setIsBulkPromptsDialogOpen(true)}>
                      Configurar datos de entrada
                    </Button>
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => setCurrentStep("outputs")}>
                        Saltar este paso
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="outputs" className="space-y-4">
                  <div className="text-center py-4">
                    <h3 className="text-lg font-medium mb-2">Añadir datos de salida</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configura los campos de salida para tu producto "{createdProduct?.productName}"
                    </p>
                    <Button onClick={() => setIsBulkOutputsDialogOpen(true)}>
                      Configurar datos de salida
                    </Button>
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => handleBulkSaveOutputs([])}>
                        Finalizar producto
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Subir archivo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Subir archivo Excel</DialogTitle>
                <DialogDescription>
                  Sube un archivo Excel para gestión local.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  {...getRootProps()}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive
                      ? "Suelta el archivo aquí..."
                      : "Arrastra un archivo Excel aquí o haz clic para seleccionar"
                    }
                  </p>
                </div>
                
                {selectedFileForUpload && (
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span className="text-sm">{selectedFileForUpload.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFileForUpload(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => selectedFileForUpload && uploadMutation.mutate(selectedFileForUpload)}
                  disabled={!selectedFileForUpload || isUploading}
                  className="w-full"
                >
                  {isUploading ? "Subiendo..." : "Subir archivo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {masterFile && (
        <Alert>
          <Crown className="h-4 w-4" />
          <AlertTitle>Archivo Maestro Activo</AlertTitle>
          <AlertDescription>
            El archivo <strong>{masterFile.filename}</strong> está configurado como archivo maestro.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Archivos EasyQuote
            </CardTitle>
            <CardDescription>
              Archivos Excel sincronizados desde tu cuenta de EasyQuote
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="includeInactive"
                  checked={includeInactive}
                  onCheckedChange={setIncludeInactive}
                />
                <Label htmlFor="includeInactive" className="text-sm">
                  Incluir inactivos
                </Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                Actualizar
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error.message}
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Cargando archivos...</p>
              </div>
            ) : easyQuoteFiles && easyQuoteFiles.length > 0 ? (
              <div className="space-y-2">
                {easyQuoteFiles.map((file) => (
                  <Card key={file.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{file.fileName}</span>
                          {!file.isActive && (
                            <Badge variant="secondary" className="text-xs">
                              Inactivo
                            </Badge>
                          )}
                          {!file.isPlanCompliant && (
                            <Badge variant="destructive" className="text-xs">
                              No compatible
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {file.fileSizeKb}KB • {formatDistanceToNow(new Date(file.dateModified), { 
                            addSuffix: true,
                            locale: es 
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay archivos disponibles en EasyQuote
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Archivos Locales ({files.length})
            </CardTitle>
            <CardDescription>
              Archivos subidos directamente a la aplicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <div className="space-y-2">
                {files.map((file) => (
                  <Card key={file.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{file.original_filename}</span>
                          {file.is_master && (
                            <Badge className="text-xs">
                              <Crown className="h-3 w-3 mr-1" />
                              Maestro
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(file.file_size / 1024)}KB • {formatDistanceToNow(new Date(file.created_at), { 
                            addSuffix: true,
                            locale: es 
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!file.is_master && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetMaster(file.file_id)}
                            title="Establecer como maestro"
                          >
                            <Crown className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          title="Descargar"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFileMutation.mutate(file)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No tienes archivos subidos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk dialogs for prompts and outputs */}
      <BulkPromptsDialog
        open={isBulkPromptsDialogOpen}
        onOpenChange={setIsBulkPromptsDialogOpen}
        onSave={handleBulkSavePrompts}
        promptTypes={[]}
        isSaving={false}
        existingPrompts={[]}
      />

      <BulkOutputsDialog
        open={isBulkOutputsDialogOpen}
        onOpenChange={setIsBulkOutputsDialogOpen}
        onSave={handleBulkSaveOutputs}
        outputTypes={[]}
        isSaving={false}
        existingOutputs={[]}
      />
    </div>
  );
}
