import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDropzone } from "react-dropzone";
import { toast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Plus, Trash2, Upload, AlertCircle, CheckCircle2, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface EasyQuoteExcelFile {
  id: string;
  fileName: string;
  dateModified: string;
  isActive: boolean;
  subscriberId: string;
  worksheets?: any[];
}

export default function ExcelFiles() {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<EasyQuoteExcelFile | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

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

  // Verificar si hay token de EasyQuote
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));

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

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(selectedFile);
    } finally {
      setIsUploading(false);
    }
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

  const downloadTemplate = () => {
    // Create a simple Excel template
    const csvContent = "name,price,description,category,sku\nProducto Ejemplo,99.99,Descripción del producto,Categoría,SKU123";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_productos.csv";
    link.click();
    window.URL.revokeObjectURL(url);
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
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Descargar Plantilla
          </Button>
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
            <CardTitle className="text-sm font-medium">Archivos Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {files.filter(f => !f.isActive).length}
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
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Modificación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
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
                    <TableCell>
                      <span className="font-mono text-xs">{file.id}</span>
                    </TableCell>
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
                          onClick={() => fetchFileDetails(file.id)}
                        >
                          <Eye className="h-4 w-4" />
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

              {selectedExcelFile.worksheets && selectedExcelFile.worksheets.length > 0 && (
                <div>
                  <Label>Hojas de Trabajo ({selectedExcelFile.worksheets.length})</Label>
                  <div className="mt-2 space-y-2">
                    {selectedExcelFile.worksheets.map((worksheet, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="text-sm font-medium">{worksheet.name || `Hoja ${index + 1}`}</div>
                        {worksheet.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {worksheet.description}
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
    </div>
  );
}