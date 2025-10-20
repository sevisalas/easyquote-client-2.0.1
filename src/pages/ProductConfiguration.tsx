import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BulkPromptsDialog } from "@/components/quotes/BulkPromptsDialog";
import { BulkOutputsDialog } from "@/components/quotes/BulkOutputsDialog";

interface PendingProduct {
  productName: string;
  fileName?: string;
  excelfileId?: string;
  currency: string;
  useNewFile: boolean;
}

interface PromptType {
  id: number;
  promptType: string;
}

interface OutputType {
  id: number;
  outputType: string;
}

export default function ProductConfiguration() {
  const navigate = useNavigate();
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [showPromptsDialog, setShowPromptsDialog] = useState(false);
  const [showOutputsDialog, setShowOutputsDialog] = useState(false);

  // Load pending product data from sessionStorage
  useEffect(() => {
    const pendingData = sessionStorage.getItem('pending_product');
    const pendingFileData = sessionStorage.getItem('pending_product_file');
    
    if (!pendingData) {
      toast({
        title: "Error",
        description: "No hay datos de producto pendiente. Redirigiendo...",
        variant: "destructive",
      });
      navigate('/admin/productos/nuevo');
      return;
    }
    
    setPendingProduct(JSON.parse(pendingData));
    setPendingFile(pendingFileData);
  }, [navigate]);

  // Fetch prompt types
  const { data: promptTypes = [] } = useQuery<PromptType[]>({
    queryKey: ["easyquote-prompt-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de EasyQuote disponible");

      const response = await fetch("https://api.easyquote.cloud/api/v1/prompttypes", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Error al obtener tipos de prompts");
      return response.json();
    },
  });

  // Fetch output types
  const { data: outputTypes = [] } = useQuery<OutputType[]>({
    queryKey: ["easyquote-output-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de EasyQuote disponible");

      const response = await fetch("https://api.easyquote.cloud/api/v1/outputtypes", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Error al obtener tipos de outputs");
      return response.json();
    },
  });

  // Create product with all configuration
  const createCompleteMutation = useMutation({
    mutationFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token || !pendingProduct) throw new Error("Datos incompletos");

      let excelfileId = pendingProduct.excelfileId;

      // If using new file, upload it first
      if (pendingProduct.useNewFile && pendingFile) {
        const base64Data = pendingFile.split(",")[1];
        
        const uploadResponse = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: pendingProduct.fileName,
            file: base64Data,
          }),
        });

        if (!uploadResponse.ok) {
          throw new Error("Error al subir archivo Excel");
        }

        const uploadResult = await uploadResponse.json();
        excelfileId = typeof uploadResult === 'string' ? uploadResult : uploadResult.id;
      }

      // Create the product
      const productResponse = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: pendingProduct.productName,
          excelfileId: excelfileId,
          currency: pendingProduct.currency,
          isActive: true,
        }),
      });

      if (!productResponse.ok) {
        const errorText = await productResponse.text();
        throw new Error(`Error al crear producto: ${errorText}`);
      }

      const productId = await productResponse.json();

      // Add prompts if any
      if (prompts.length > 0) {
        const promptsResponse = await fetch(
          `https://api.easyquote.cloud/api/v1/products/${productId}/prompts/bulk`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(prompts),
          }
        );

        if (!promptsResponse.ok) {
          console.error("Error al agregar prompts");
        }
      }

      // Add outputs if any
      if (outputs.length > 0) {
        const outputsResponse = await fetch(
          `https://api.easyquote.cloud/api/v1/products/${productId}/outputs/bulk`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(outputs),
          }
        );

        if (!outputsResponse.ok) {
          console.error("Error al agregar outputs");
        }
      }

      return productId;
    },
    onSuccess: (productId) => {
      // Clean up sessionStorage
      sessionStorage.removeItem('pending_product');
      sessionStorage.removeItem('pending_product_file');

      toast({
        title: "Producto creado",
        description: "El producto se ha creado exitosamente en EasyQuote.",
      });
      
      navigate('/admin/productos');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSavePrompts = (newPrompts: any[]) => {
    setPrompts(newPrompts);
    setShowPromptsDialog(false);
    toast({
      title: "Prompts guardados",
      description: `Se han configurado ${newPrompts.length} prompts.`,
    });
  };

  const handleSaveOutputs = (newOutputs: any[]) => {
    setOutputs(newOutputs);
    setShowOutputsDialog(false);
    toast({
      title: "Outputs guardados",
      description: `Se han configurado ${newOutputs.length} outputs.`,
    });
  };

  const handleCreateProduct = () => {
    if (prompts.length === 0 && outputs.length === 0) {
      toast({
        title: "Advertencia",
        description: "Se recomienda configurar al menos prompts u outputs antes de crear el producto.",
        variant: "destructive",
      });
      return;
    }

    createCompleteMutation.mutate();
  };

  if (!pendingProduct) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/productos/nuevo")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <h1 className="text-3xl font-bold">Configurar producto</h1>
        <p className="text-muted-foreground mt-2">
          Configura los prompts y outputs antes de crear el producto en EasyQuote
        </p>
      </div>

      <div className="space-y-6">
        {/* Product Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información del producto</CardTitle>
            <CardDescription>Datos básicos que has ingresado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-medium">Nombre:</span> {pendingProduct.productName}
            </div>
            <div>
              <span className="font-medium">Archivo Excel:</span>{" "}
              {pendingProduct.fileName || "Archivo existente seleccionado"}
            </div>
            <div>
              <span className="font-medium">Moneda:</span> {pendingProduct.currency}
            </div>
          </CardContent>
        </Card>

        {/* Prompts Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Prompts (Entradas)</CardTitle>
            <CardDescription>
              Configura los campos de entrada del producto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                {prompts.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {prompts.length} prompt(s) configurado(s)
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay prompts configurados
                  </p>
                )}
              </div>
              <Button onClick={() => setShowPromptsDialog(true)}>
                {prompts.length > 0 ? "Editar Prompts" : "Agregar Prompts"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Outputs Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Outputs (Salidas)</CardTitle>
            <CardDescription>
              Configura los resultados de cálculo del producto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                {outputs.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {outputs.length} output(s) configurado(s)
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay outputs configurados
                  </p>
                )}
              </div>
              <Button onClick={() => setShowOutputsDialog(true)}>
                {outputs.length > 0 ? "Editar Outputs" : "Agregar Outputs"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription>
            Una vez que hayas configurado los prompts y outputs, podrás crear el producto en EasyQuote.
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/productos")}
            disabled={createCompleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreateProduct}
            disabled={createCompleteMutation.isPending}
          >
            {createCompleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Crear Producto en EasyQuote
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <BulkPromptsDialog
        open={showPromptsDialog}
        onOpenChange={setShowPromptsDialog}
        onSave={handleSavePrompts}
        promptTypes={promptTypes}
        isSaving={false}
        existingPrompts={prompts}
      />

      <BulkOutputsDialog
        open={showOutputsDialog}
        onOpenChange={setShowOutputsDialog}
        onSave={handleSaveOutputs}
        outputTypes={outputTypes}
        isSaving={false}
        existingOutputs={outputs}
      />
    </div>
  );
}
