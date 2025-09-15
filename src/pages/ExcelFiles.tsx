import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDropzone } from "react-dropzone";
import { toast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Plus, Trash2, Upload, AlertCircle, CheckCircle2, Package, Edit, Crown, Copy, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

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
  // All hooks must be declared at the top, before any conditional logic
  const { organization, membership } = useSubscription();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<EasyQuoteExcelFile | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [isUpdateExcelDialogOpen, setIsUpdateExcelDialogOpen] = useState(false);
  const [selectedFileForUpdate, setSelectedFileForUpdate] = useState<File | null>(null);
  const [newProductData, setNewProductData] = useState({
    productName: "",
    excelFileId: "",
    currency: "USD"
  });
  
  // Get the subscriber ID from the EasyQuote token
  const getSubscriberIdFromToken = () => {
    const token = localStorage.getItem("easyquote_token");
    if (!token) return null;
    
    try {
      // Decode JWT token to get subscriber ID
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.SubscriberID || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const subscriberId = getSubscriberIdFromToken();
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));
  
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Fetch Excel file metadata from Supabase
  const { data: excelFilesMeta } = useQuery({
    queryKey: ["excel-files-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excel_files")
        .select("*");
      
      if (error) {
        console.error("Error fetching excel files meta:", error);
        return [];
      }
      return data;
    },
    enabled: hasToken
  });

  // Fetch Excel files from EasyQuote API
  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ["easyquote-excel-files"],
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Error al obtener archivos Excel");
      }

      const data = await response.json();
      return data as EasyQuoteExcelFile[];
    },
    enabled: hasToken,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes("401")) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Sync Excel files with Supabase
  const syncExcelFiles = async (apiFiles: EasyQuoteExcelFile[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Sync each file with Supabase
    for (const file of apiFiles) {
      const { data: existingFile } = await supabase
        .from("excel_files")
        .select("*")
        .eq("file_id", file.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingFile) {
        // Create new file record
        await supabase
          .from("excel_files")
          .insert({
            user_id: user.id,
            file_id: file.id,
            filename: file.fileName,
            original_filename: file.fileName,
            file_size: 0,
        is_master: false
          });
      }
    }
    // Refresh metadata after sync
    queryClient.invalidateQueries({ queryKey: ["excel-files-meta"] });
  };

  // Generate public URL for master files
  const generatePublicUrl = (fileId: string, fileName: string) => {
    if (!subscriberId) return null;
    return `https://sheets.easyquote.cloud/${subscriberId}/${fileId}/${encodeURIComponent(fileName)}`;
  };

  // Combine API files with Supabase metadata
  const filesWithMeta = files.map(file => {
    const meta = excelFilesMeta?.find(m => m.file_id === file.id);
    const isMaster = meta?.is_master || false;
    const fileUrl = isMaster ? generatePublicUrl(file.id, file.fileName) : null;
    return {
      ...file,
      isMaster,
      fileUrl
    };
  });

  // Auto-sync files when they are loaded
  useEffect(() => {
    if (files.length > 0) {
      syncExcelFiles(files);
    }
  }, [files]);

  // Upload Excel file to EasyQuote API
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!file) throw new Error("No file selected");
      
      const token = localStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (data:application/...;base64,)
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          fileContent: base64
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error al subir archivo: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Archivo subido exitosamente",
        description: `El archivo ${data.fileName} se ha subido correctamente.`,
      });
      queryClient.invalidateQueries({ queryKey: ["easyquote-excel-files"] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({
        title: "Error al subir archivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete file from EasyQuote API
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      const response = await fetch(`https://api.easyquote.cloud/api/v1/excelfiles/${fileId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Error al eliminar archivo");
      }

      return fileId;
    },
    onSuccess: () => {
      toast({
        title: "Archivo eliminado",
        description: "El archivo se ha marcado como inactivo correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["easyquote-excel-files"] });
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar archivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create new product with Excel file
  const createProductMutation = useMutation({
    mutationFn: async (productData: { productName: string; excelFileId: string; currency: string }) => {
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
          excelFileId: productData.excelFileId,
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
    onSuccess: () => {
      toast({
        title: "Producto creado",
        description: "El producto se ha creado correctamente.",
      });
      setIsCreateProductDialogOpen(false);
      setNewProductData({ productName: "", excelFileId: "", currency: "USD" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update Excel file
  const updateExcelMutation = useMutation({
    mutationFn: async ({ fileId, file }: { fileId: string; file: File }) => {
      if (!file) throw new Error("No file selected");
      
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (data:application/...;base64,)
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      const response = await fetch(`https://api.easyquote.cloud/api/v1/excelfiles/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileContent: base64
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error updating Excel file: ${errorText}`);
      }
      
      const result = await response.json();
      return { oldFileId: fileId, newFileId: result.id, fileName: file.name };
    },
    onSuccess: async (data) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && data.oldFileId !== data.newFileId) {
        // Update the file_id in Supabase to reflect the new ID from EasyQuote
        await supabase
          .from("excel_files")
          .update({ 
            file_id: data.newFileId,
            original_filename: data.fileName,
            filename: data.fileName 
          })
          .eq("file_id", data.oldFileId)
          .eq("user_id", user.id);
      }

      toast({
        title: "Archivo Excel actualizado",
        description: data.oldFileId !== data.newFileId 
          ? "El archivo se actualizó y se generó un nuevo ID. Las URLs se han actualizado automáticamente."
          : "El archivo Excel se ha actualizado correctamente.",
      });
      setIsUpdateExcelDialogOpen(false);
      setSelectedFileForUpdate(null);
      queryClient.invalidateQueries({ queryKey: ["easyquote-excel-files"] });
      queryClient.invalidateQueries({ queryKey: ["excel-files-meta"] });
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar archivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Dropzone config
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"]
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    }
  });

  // Dropzone config for Excel file updates
  const { getRootProps: getUpdateRootProps, getInputProps: getUpdateInputProps, isDragActive: isUpdateDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"]
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFileForUpdate(acceptedFiles[0]);
      }
    }
  });

  // Now conditional logic can happen after all hooks are declared
  
  // Check permissions
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden acceder a esta sección.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(selectedFile);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (sizeKb: number) => {
    if (!sizeKb || sizeKb === 0) return "0 KB";
    if (sizeKb < 1024) return `${sizeKb} KB`;
    const sizeMb = sizeKb / 1024;
    if (sizeMb < 1024) return `${sizeMb.toFixed(1)} MB`;
    const sizeGb = sizeMb / 1024;
    return `${sizeGb.toFixed(2)} GB`;
  };

  // Fetch file details
  const fetchFileDetails = async (fileId: string) => {
    const token = localStorage.getItem("easyquote_token");
    if (!token) return;

    try {
      const response = await fetch(`https://api.easyquote.cloud/api/v1/excelfiles/${fileId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedExcelFile(data);
        setIsDetailsDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron obtener los detalles del archivo",
        variant: "destructive",
      });
    }
  };

  // Download file from EasyQuote API
  const downloadFile = async (fileId: string, fileName: string) => {

    const token = localStorage.getItem("easyquote_token");
    if (!token) {
      toast({
        title: "Error",
        description: "No hay token de autenticación",
        variant: "destructive",
      });
      return;
    }

    try {
      // Try the direct download endpoint first
      let response = await fetch(`https://api.easyquote.cloud/api/v1/excelfiles/${fileId}/download`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        }
      });

      // If 404, try alternative endpoint
      if (response.status === 404) {
        response = await fetch(`https://api.easyquote.cloud/api/v1/excelfiles/${fileId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        });
      }

      if (response.ok) {
        const blob = await response.blob();
        
        // Check if we actually got a file
        if (blob.size === 0) {
          throw new Error("El archivo está vacío");
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(link);
        }, 100);
        
        toast({
          title: "Archivo descargado",
          description: `El archivo ${fileName} se ha descargado correctamente.`,
        });
      } else {
        const errorText = await response.text();
        console.error("Download error:", response.status, errorText);
        
        toast({
          title: "Error al descargar",
          description: `Error ${response.status}: El servicio de descarga no está disponible en este momento.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Error de descarga",
        description: "No se pudo descargar el archivo. Verifique su conexión e intente nuevamente.",
        variant: "destructive",
      });
    }
  };


  if (!hasToken) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sesión requerida</AlertTitle>
          <AlertDescription>
            Para gestionar archivos Excel, necesitas iniciar sesión en EasyQuote desde la página de presupuestos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudieron cargar los archivos: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Archivos Excel</h1>
          <p className="text-muted-foreground mt-2">
            Administra archivos Excel desde EasyQuote para tus productos
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isCreateProductDialogOpen} onOpenChange={setIsCreateProductDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Crear Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear nuevo producto</DialogTitle>
                <DialogDescription>
                  Crea un nuevo producto utilizando uno de tus archivos Excel existentes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Nombre del producto</Label>
                  <Input
                    id="productName"
                    value={newProductData.productName}
                    onChange={(e) => setNewProductData(prev => ({ ...prev, productName: e.target.value }))}
                    placeholder="Introduce el nombre del producto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="excelFileId">Archivo Excel</Label>
                  <Select 
                    value={newProductData.excelFileId} 
                    onValueChange={(value) => setNewProductData(prev => ({ ...prev, excelFileId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un archivo Excel" />
                    </SelectTrigger>
                    <SelectContent>
                      {files.filter(f => f.isActive).map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          {file.fileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select 
                    value={newProductData.currency} 
                    onValueChange={(value) => setNewProductData(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createProductMutation.mutate(newProductData)}
                  disabled={!newProductData.productName || !newProductData.excelFileId || createProductMutation.isPending}
                  className="w-full"
                >
                  {createProductMutation.isPending ? "Creando..." : "Crear Producto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Subir Archivo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Subir archivo Excel</DialogTitle>
                <DialogDescription>
                  Selecciona un archivo Excel (.xlsx, .xls) o CSV para subir a EasyQuote.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                    ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}
                  `}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive
                      ? "Suelta el archivo aquí..."
                      : "Arrastra un archivo aquí o haz clic para seleccionar"
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Formatos soportados: .xlsx, .xls, .csv
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="text-sm flex-1">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                >
                  {isUploading ? "Subiendo..." : "Subir a EasyQuote"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Archivos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {files.filter(f => f.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">No Conformes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {files.filter(f => !f.isPlanCompliant).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Archivos Excel</CardTitle>
          <CardDescription>
            Lista de archivos Excel disponibles en EasyQuote
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando archivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay archivos en EasyQuote</p>
              <p className="text-sm text-muted-foreground">
                Sube tu primer archivo Excel para comenzar
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Archivo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Modificación</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        {file.fileName}
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.fileSizeKb)}</TableCell>
                    <TableCell>
                      <Badge variant={file.isActive ? "default" : "secondary"}>
                        {file.isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Activo
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inactivo
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(file.dateModified), {
                        addSuffix: true,
                        locale: es
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file.id, file.fileName)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedExcelFile(file);
                            setIsUpdateExcelDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(file.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* File Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Archivo Excel</DialogTitle>
            <DialogDescription>
              Información detallada del archivo y sus hojas de trabajo
            </DialogDescription>
          </DialogHeader>
          
          {selectedExcelFile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre del Archivo</Label>
                  <p className="text-sm font-medium">{selectedExcelFile.fileName}</p>
                </div>
                <div>
                  <Label>ID del Archivo</Label>
                  <p className="text-sm font-mono">{selectedExcelFile.id}</p>
                </div>
              </div>
              
              <div>
                <Label>Estado</Label>
                <div className="mt-1">
                  <Badge variant={selectedExcelFile.isActive ? "default" : "secondary"}>
                    {selectedExcelFile.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>

              {selectedExcelFile.excelfilesSheets && selectedExcelFile.excelfilesSheets.length > 0 && (
                <div>
                  <Label>Hojas de Trabajo ({selectedExcelFile.excelfilesSheets.length})</Label>
                  <div className="mt-2 space-y-2">
                    {selectedExcelFile.excelfilesSheets.map((sheet, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="text-sm font-medium">{sheet.name || `Hoja ${index + 1}`}</div>
                        {sheet.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {sheet.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Excel File Dialog */}
      <Dialog open={isUpdateExcelDialogOpen} onOpenChange={setIsUpdateExcelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Archivo Excel</DialogTitle>
            <DialogDescription>
              Actualiza el archivo Excel "{selectedExcelFile?.fileName}" con uno nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              {...getUpdateRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isUpdateDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}
              `}
            >
              <input {...getUpdateInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isUpdateDragActive
                  ? "Suelta el archivo aquí..."
                  : "Arrastra un archivo aquí o haz clic para seleccionar"
                }
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos soportados: .xlsx, .xls
              </p>
            </div>

            {selectedFileForUpdate && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm flex-1">{selectedFileForUpdate.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFileForUpdate(null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (selectedFileForUpdate && selectedExcelFile?.id) {
                  updateExcelMutation.mutate({ 
                    fileId: selectedExcelFile.id, 
                    file: selectedFileForUpdate 
                  });
                }
              }}
              disabled={!selectedFileForUpdate || updateExcelMutation.isPending}
              className="w-full"
            >
              {updateExcelMutation.isPending ? "Actualizando..." : "Actualizar Archivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}