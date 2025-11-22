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
import { useDropzone } from "react-dropzone";
import { toast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Plus, Trash2, Upload, AlertCircle, CheckCircle2, Package, Edit, Crown, Copy, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { EasyQuoteConnectivityTest } from "@/components/diagnostics/EasyQuoteConnectivityTest";
import { invokeEasyQuoteFunction, getEasyQuoteToken } from "@/lib/easyquoteApi";

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
  const navigate = useNavigate();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<EasyQuoteExcelFile | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCreateProductDialogOpen, setIsCreateProductDialogOpen] = useState(false);
  const [isUpdateExcelDialogOpen, setIsUpdateExcelDialogOpen] = useState(false);
  const [selectedFileForUpdate, setSelectedFileForUpdate] = useState<File | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);
  const [selectedFileForProducts, setSelectedFileForProducts] = useState<EasyQuoteExcelFile | null>(null);
  const [newProductData, setNewProductData] = useState({
    productName: "",
    excelFileId: "",
    currency: "EUR"
  });
  const [createProductOption, setCreateProductOption] = useState<"existing" | "new">("existing");
  const [newExcelFile, setNewExcelFile] = useState<File | null>(null);
  
  // Get the subscriber ID from the EasyQuote token
  const getSubscriberIdFromToken = () => {
    const token = sessionStorage.getItem("easyquote_token");
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
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);
  
  // Validate EasyQuote token on mount
  useEffect(() => {
    const validateToken = async () => {
      setTokenChecking(true);
      try {
        console.log('[ExcelFiles] Attempting to get EasyQuote token...');
        const token = await getEasyQuoteToken();
        console.log('[ExcelFiles] Token result:', token ? 'Token obtained' : 'No token');
        setHasToken(!!token);
      } catch (error) {
        console.error("Error validating EasyQuote token:", error);
        setHasToken(false);
      } finally {
        setTokenChecking(false);
      }
    };
    
    validateToken();
    
    // Listen for token updates
    const checkToken = async () => {
      const token = await getEasyQuoteToken();
      setHasToken(!!token);
    };
    
    window.addEventListener('easyquote-token-updated', checkToken);
    return () => {
      window.removeEventListener('easyquote-token-updated', checkToken);
    };
  }, []);
  
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Fetch all products from EasyQuote to check associations
  const { data: allProducts = [] } = useQuery({
    queryKey: ["easyquote-products-for-excel"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) return [];

      const { data, error } = await invokeEasyQuoteFunction("easyquote-products", {
        token,
        includeInactive: true
      });

      if (error || !data) return [];
      return Array.isArray(data) ? data : (data?.items || data?.data || []);
    },
    enabled: !!hasToken,
  });

  // Get products associated with the selected file
  const associatedProducts = selectedFileForProducts
    ? allProducts.filter((product: any) => 
        product.excelfileId === selectedFileForProducts.id && 
        (includeInactive || product.isActive)
      )
    : [];

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
    enabled: !!hasToken
  });

  // Fetch Excel files from EasyQuote API
  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ["easyquote-excel-files"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      console.log('[ExcelFiles] Fetching files from EasyQuote via edge function, token exists:', !!token);
      
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      const { data, error } = await supabase.functions.invoke("easyquote-excel-files", {
        body: { token }
      });

      if (error) {
        console.error('[ExcelFiles] Edge function error:', error);
        throw new Error("Error al obtener archivos Excel de EasyQuote");
      }

      console.log('[ExcelFiles] Files received from EasyQuote:', data?.length || 0, 'files');
      return data;
    },
    enabled: !!hasToken,
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

  // Combine API files with Supabase metadata and filter by active status
  const filesWithMeta = files.map(file => {
    const meta = excelFilesMeta?.find(m => m.file_id === file.id);
    const isMaster = meta?.is_master || false;
    return {
      ...file,
      isMaster,
      fileUrl: null // Los archivos maestros ya no existen
    };
  });

  // Filter files based on includeInactive setting
  const filteredFiles = includeInactive 
    ? filesWithMeta 
    : filesWithMeta.filter(file => file.isActive);
  
  console.log('[ExcelFiles] Filtered files:', {
    totalFiles: files.length,
    filesWithMeta: filesWithMeta.length,
    filteredFiles: filteredFiles.length,
    includeInactive
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
      
      const token = sessionStorage.getItem("easyquote_token");
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
        let errorMessage = "Error desconocido al subir el archivo";
        try {
          const errorData = await response.json();
          // Extract meaningful error message from EasyQuote API response
          if (errorData?.[""]?.errors?.[0]?.errorMessage) {
            errorMessage = errorData[""].errors[0].errorMessage;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          }
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
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
      const token = sessionStorage.getItem("easyquote_token");
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

  // Create new product with Excel file (existing file)
  const createProductMutation = useMutation({
    mutationFn: async (productData: { productName: string; excelFileId: string; currency: string }) => {
      const token = sessionStorage.getItem("easyquote_token");
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
    onSuccess: (data) => {
      toast({
        title: "Producto creado",
        description: "Configurando datos de entrada y salida...",
      });
      setIsCreateProductDialogOpen(false);
      setNewProductData({ productName: "", excelFileId: "", currency: "EUR" });
      setNewExcelFile(null);
      setCreateProductOption("existing");
      // Navegar a la página de productos y abrir el diálogo de edición
      navigate(`/admin/productos?editProduct=${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create new product with new Excel file
  const createProductWithNewFileMutation = useMutation({
    mutationFn: async (data: { productName: string; file: File; currency: string }) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      // First upload the Excel file
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(data.file);
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      const uploadResponse = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: data.file.name,
          fileContent: base64
        })
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        throw new Error(`Error uploading file: ${errorData}`);
      }

      const uploadResult = await uploadResponse.json();

      // Then create the product with the uploaded file
      const productResponse = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: data.productName,
          excelFileId: uploadResult.id,
          currency: data.currency,
          isActive: true
        })
      });

      if (!productResponse.ok) {
        const errorText = await productResponse.text();
        throw new Error(`Error creating product: ${errorText}`);
      }
      
      return productResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Producto creado",
        description: "Configurando datos de entrada y salida...",
      });
      setIsCreateProductDialogOpen(false);
      setNewProductData({ productName: "", excelFileId: "", currency: "EUR" });
      setNewExcelFile(null);
      setCreateProductOption("existing");
      // Refresh files list
      queryClient.invalidateQueries({ queryKey: ["easyquote-excel-files"] });
      // Navegar a la página de productos y abrir el diálogo de edición
      navigate(`/admin/productos?editProduct=${data.id}`);
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
      if (!file) throw new Error("No se ha seleccionado ningún archivo");
      
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(file.type)) {
        throw new Error(`Tipo de archivo no válido: ${file.type}. Selecciona un archivo Excel (.xlsx o .xls)`);
      }
      
      console.log('📄 Archivo seleccionado para actualización:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de autenticación");

      // Convert file to base64 (same as original EasyQuote code)
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

      // Payload structure matches original code: { fileName, file }
      const payload = {
        fileName: file.name,
        file: base64,
        isPlanCompliant: true
      };

      console.log('📤 Actualizando archivo:', {
        fileId,
        fileName: file.name,
        base64Length: base64.length
      });

      const response = await fetch(`https://api.easyquote.cloud/api/v1/excelfiles/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = "Error al actualizar el archivo";
        try {
          const errorData = await response.json();
          if (errorData?.[""]?.errors?.[0]?.errorMessage) {
            errorMessage = errorData[""].errors[0].errorMessage;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          }
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      console.log('✅ Archivo actualizado correctamente');
      
      // Note: In the original EasyQuote code, the ID doesn't change on update
      // Only the fileName is updated in the local list
      return { fileId, fileName: file.name };
    },
    onSuccess: async (data) => {
      // Update the filename in Supabase metadata
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("excel_files")
          .update({ 
            original_filename: data.fileName,
            filename: data.fileName 
          })
          .eq("file_id", data.fileId)
          .eq("user_id", user.id);
      }

      toast({
        title: "Archivo Excel actualizado",
        description: "El archivo se ha actualizado correctamente.",
      });
      setIsUpdateExcelDialogOpen(false);
      setSelectedFileForUpdate(null);
      queryClient.invalidateQueries({ queryKey: ["easyquote-excel-files"] });
      queryClient.invalidateQueries({ queryKey: ["excel-files-meta"] });
    },
    onError: (error) => {
      console.error('❌ Error al actualizar:', error);
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

  // Dropzone config for new Excel files in create product dialog
  const { getRootProps: getNewFileRootProps, getInputProps: getNewFileInputProps, isDragActive: isNewFileDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"]
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setNewExcelFile(acceptedFiles[0]);
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

  const handleCreateProduct = async () => {
    if (createProductOption === "existing") {
      if (!newProductData.productName || !newProductData.excelFileId) return;
      await createProductMutation.mutateAsync(newProductData);
    } else {
      if (!newProductData.productName || !newExcelFile) return;
      await createProductWithNewFileMutation.mutateAsync({
        productName: newProductData.productName,
        file: newExcelFile,
        currency: newProductData.currency
      });
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
    const token = sessionStorage.getItem("easyquote_token");
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

  // Download file from EasyQuote API (with CORS fallback)
  const downloadFile = async (fileId: string, fileName: string) => {
    const token = sessionStorage.getItem("easyquote_token");
    if (!token) {
      toast({
        title: "Error",
        description: "No hay token de autenticación",
        variant: "destructive",
      });
      return;
    }

    if (!subscriberId) {
      toast({
        title: "Error",
        description: "No se pudo obtener el ID del suscriptor",
        variant: "destructive",
      });
      return;
    }

    try {
      const downloadUrl = `https://sheets.easyquote.cloud/${subscriberId}/${fileId}/${fileName}`;
      console.log('📥 Descargando desde:', downloadUrl);

      // Try direct download first (works when in same domain/no CORS)
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error("El archivo está vacío");
        }

        console.log('✅ Descarga directa exitosa, tamaño:', blob.size);

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(link);
        }, 100);

        toast({
          title: "Archivo descargado",
          description: `${fileName} descargado correctamente`,
        });
        return;
      }

      // Si la respuesta no es OK, mostrar error
      throw new Error("No se pudo descargar el archivo. Intenta nuevamente.");
    } catch (error) {
      console.error("❌ Error de descarga:", error);
      toast({
        title: "Error de descarga",
        description: error instanceof Error ? error.message : "No se pudo descargar",
        variant: "destructive",
      });
    }
  };


  if (!hasToken) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuración de EasyQuote requerida</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Para gestionar archivos Excel, necesitas configurar tus credenciales de EasyQuote.</p>
            <p className="text-sm text-muted-foreground">
              Si eres administrador, ve a la sección de usuarios para configurar las credenciales de la API de EasyQuote.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>EasyQuote no disponible</AlertTitle>
          <AlertDescription className="space-y-3">
            <div>
              No se puede conectar con EasyQuote para cargar los archivos Excel. 
              Los archivos están almacenados en EasyQuote, no en Supabase.
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              {isLoading ? "Reintentando..." : "Reintentar conexión"}
            </Button>
          </AlertDescription>
        </Alert>
        
        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Test de Conectividad</CardTitle>
              <CardDescription>
                Usa este test para diagnosticar problemas de conexión con EasyQuote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EasyQuoteConnectivityTest />
            </CardContent>
          </Card>
        )}
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
                  Crea un nuevo producto usando un archivo Excel existente o subiendo uno nuevo.
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
                
                <div className="space-y-3">
                  <Label>Archivo Excel</Label>
                  <RadioGroup 
                    value={createProductOption} 
                    onValueChange={(value) => {
                      setCreateProductOption(value as "existing" | "new");
                      // Reset relevant fields when switching
                      if (value === "existing") {
                        setNewExcelFile(null);
                      } else {
                        setNewProductData(prev => ({ ...prev, excelFileId: "" }));
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="existing" id="existing" />
                      <Label htmlFor="existing">Usar archivo existente</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="new" />
                      <Label htmlFor="new">Subir archivo nuevo</Label>
                    </div>
                  </RadioGroup>
                  
                  {createProductOption === "existing" && (
                    <Select 
                      value={newProductData.excelFileId} 
                      onValueChange={(value) => setNewProductData(prev => ({ ...prev, excelFileId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un archivo Excel" />
                      </SelectTrigger>
                      <SelectContent>
                        {filesWithMeta.filter(f => f.isActive).map((file) => (
                          <SelectItem key={file.id} value={file.id}>
                            {file.fileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {createProductOption === "new" && (
                    <div className="space-y-3">
                      <div
                        {...getNewFileRootProps()}
                        className={`
                          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                          ${isNewFileDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}
                        `}
                      >
                        <input {...getNewFileInputProps()} />
                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {isNewFileDragActive
                            ? "Suelta el archivo aquí..."
                            : "Arrastra un archivo Excel aquí o haz clic para seleccionar"
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Formatos: .xlsx, .xls
                        </p>
                      </div>
                      
                      {newExcelFile && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span className="text-sm flex-1">{newExcelFile.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewExcelFile(null)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateProduct}
                  disabled={
                    !newProductData.productName || 
                    (createProductOption === "existing" && !newProductData.excelFileId) ||
                    (createProductOption === "new" && !newExcelFile) ||
                    createProductMutation.isPending ||
                    createProductWithNewFileMutation.isPending
                  }
                  className="w-full"
                >
                  {(createProductMutation.isPending || createProductWithNewFileMutation.isPending) 
                    ? "Creando..." 
                    : "Crear Producto"}
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

      {/* Modal de productos asociados */}
      <Dialog open={isProductsDialogOpen} onOpenChange={setIsProductsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Productos asociados</DialogTitle>
            <DialogDescription>
              Productos que utilizan el archivo: {selectedFileForProducts?.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            {associatedProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No hay productos asociados a este archivo Excel
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {associatedProducts.map((product: any) => (
                  <Card key={product.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium flex-1">{product.productName}</p>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigate(`/admin/productos?editProduct=${product.id}`);
                            setIsProductsDialogOpen(false);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductsDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      {/* Test de Conectividad - Solo para superadmin */}
      {isSuperAdmin && <EasyQuoteConnectivityTest />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {files.filter(f => f.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {files.filter(f => !f.isActive).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Archivos Excel</CardTitle>
              <CardDescription>
                Lista de archivos Excel disponibles en EasyQuote
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="include-inactive" className="text-sm font-medium">
                Mostrar inactivos
              </Label>
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando archivos...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {!includeInactive && files.some(f => !f.isActive) 
                  ? "No hay archivos activos" 
                  : "No hay archivos en EasyQuote"
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {!includeInactive && files.some(f => !f.isActive)
                  ? "Activa el switch 'Mostrar inactivos' para ver todos los archivos"
                  : "Sube tu primer archivo Excel para comenzar"
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-9">
                  <TableHead className="py-2 text-xs font-semibold">Nombre archivo</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Tamaño</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Estado</TableHead>
                  <TableHead className="w-24 py-2 text-xs font-semibold">Cumple requisitos</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Última modificación</TableHead>
                  <TableHead className="text-center py-2 text-xs font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((file) => (
                  <TableRow key={file.id} className="h-auto">
                    <TableCell className="py-1.5 px-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{file.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-sm">{formatFileSize(file.fileSizeKb)}</TableCell>
                    <TableCell className="py-1.5 px-3">
                      <Badge variant={file.isActive ? "default" : "secondary"} className="text-xs px-2 py-0 h-5">
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
                    <TableCell className="w-24 py-1.5 px-3">
                      <Badge variant={file.isPlanCompliant ? "default" : "destructive"} className="text-xs px-2 py-0 h-5">
                        {file.isPlanCompliant ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Sí
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(file.dateModified), {
                          addSuffix: true,
                          locale: es
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-1.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFileForProducts(file);
                            setIsProductsDialogOpen(true);
                          }}
                          title="Ver productos asociados"
                          className="relative h-7 w-7 p-0"
                        >
                          <Package className="h-3.5 w-3.5" />
                          {(() => {
                            const count = allProducts.filter((p: any) => 
                              p.excelfileId === file.id && 
                              (includeInactive || p.isActive)
                            ).length;
                            return count > 0 && (
                              <Badge 
                                variant="default" 
                                className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 flex items-center justify-center text-xs rounded-full"
                              >
                                {count}
                              </Badge>
                            );
                          })()}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file.id, file.fileName)}
                          title="Descargar Excel"
                          className="h-7 w-7 p-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedExcelFile(file);
                            setIsUpdateExcelDialogOpen(true);
                          }}
                          title="Actualizar Excel"
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(file.id)}
                          disabled={deleteMutation.isPending}
                          title="Borrar Excel"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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