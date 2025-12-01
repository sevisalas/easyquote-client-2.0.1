import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction, getEasyQuoteToken } from "@/lib/easyquoteApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useProductCategoryMappings } from "@/hooks/useProductCategoryMappings";
import { useProductionVariables } from "@/hooks/useProductionVariables";
import { useProductVariableMappings } from "@/hooks/useProductVariableMappings";
import { ProductTable } from "@/components/ProductTable";
import { 
  Package, 
  Search, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Settings,
  Plus,
  Trash2,
  Save,
  TestTube,
  Layers
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { BulkPromptsDialog } from "@/components/quotes/BulkPromptsDialog";
import { BulkOutputsDialog } from "@/components/quotes/BulkOutputsDialog";
import { useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interface para productos del API de EasyQuote
interface EasyQuoteProduct {
  id: string; // El API devuelve 'id', no 'productId'
  productName: string;
  isActive: boolean;
  category?: string;
  description?: string;
  basePrice?: number;
  excelfileId?: string;
  currency?: string;
  [key: string]: any; // Para otros campos del API
}

interface ProductPrompt {
  id: string; // El API usa 'id' no 'promptId'
  productId: string;
  promptSeq: number; // sequence en el API
  promptType: number; // promptTypeId en el API  
  promptSheet: string;
  promptCell: string; // título/nombre del prompt
  valueSheet: string;
  valueCell: string; // valor por defecto
  valueOptionSheet: string;
  valueOptionRange: string; // rango
  valueRequired: boolean; // isRequired en el API
  valueQuantityAllowedDecimals: number | null; // decimales
  valueQuantityMin: number | null; // qty min
  valueQuantityMax: number | null; // qty max
  tooltipValueSheet?: string | null;
  tooltipValueCell?: string | null;
  valueOptionLabelRange?: string | null;
}

interface ProductOutput {
  id: string;
  productId: string;
  outputTypeId: number;
  sheet: string;
  nameCell: string;
  valueCell: string;
}

interface PromptType {
  id: number;
  promptType: string;
}

interface OutputType {
  id: number;
  outputType: string;
}

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

export default function ProductManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<EasyQuoteProduct | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);
  
  // Validate EasyQuote token on mount
  useEffect(() => {
    const validateToken = async () => {
      setTokenChecking(true);
      try {
        const token = await getEasyQuoteToken();
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
  const [isNewPromptDialogOpen, setIsNewPromptDialogOpen] = useState(false);
  const [isNewOutputDialogOpen, setIsNewOutputDialogOpen] = useState(false);
  const [isBulkPromptsDialogOpen, setIsBulkPromptsDialogOpen] = useState(false);
  const [isBulkOutputsDialogOpen, setIsBulkOutputsDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [newPromptData, setNewPromptData] = useState({
    promptSheet: "",
    promptCell: "",
    valueSheet: "",
    valueCell: "",
    valueOptionSheet: "",
    valueOptionRange: "",
    promptType: 0,
    valueRequired: false,
    valueQuantityAllowedDecimals: 0,
    valueQuantityMin: 1,
    valueQuantityMax: 9999,
    promptSeq: 1
  });
  const [newOutputData, setNewOutputData] = useState({
    sheet: "",
    prompt: "",
    defaultValue: "",
    outputTypeId: 0
  });
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  
  console.log('ProductManagement: About to call useSubscription hook');
  const { isSuperAdmin, isOrgAdmin } = useSubscription();
  console.log('ProductManagement: Successfully got subscription context', { isSuperAdmin, isOrgAdmin });
  const queryClient = useQueryClient();

  // Hooks for categories
  const { categories: allCategories, subcategories: allSubcategories } = useProductCategories();
  const { 
    mappings: categoryMappings, 
    getProductMapping, 
    upsertMapping: upsertCategoryMapping,
    deleteMapping: deleteCategoryMapping
  } = useProductCategoryMappings();
  
  // Hooks for production variables
  const { variables: productionVariables } = useProductionVariables();
  const { 
    mappings: variableMappings, 
    upsertMapping: upsertVariableMapping,
    getMappedVariableId,
    getMappedNames
  } = useProductVariableMappings(selectedProduct?.id);
  
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL LOGIC
  // Queries para tipos de prompts y outputs
  const { data: promptTypes = [] } = useQuery({
    queryKey: ["prompt-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts/types", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error fetching prompt types");
      return response.json();
    }
  });

  const { data: outputTypes = [] } = useQuery({
    queryKey: ["output-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs/types", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error fetching output types");
      return response.json();
    }
  });

  // Queries para prompts y outputs del producto seleccionado
  const { data: productPrompts = [], refetch: refetchPrompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["product-prompts", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      
      console.log("Fetching prompts for product:", selectedProduct.id);
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const { data, error } = await supabase.functions.invoke("easyquote-prompts", {
        body: { token, productId: selectedProduct.id }
      });

      if (error) {
        console.error("Error fetching prompts:", error);
        throw new Error("Error fetching product prompts");
      }

      console.log("Product prompts received:", data);
      return data;
    },
    enabled: !!selectedProduct?.id
  });

  const { data: productOutputs = [], refetch: refetchOutputs, isLoading: outputsLoading } = useQuery({
    queryKey: ["product-outputs", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      
      console.log("Fetching outputs for product:", selectedProduct.id);
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const { data, error } = await supabase.functions.invoke("easyquote-outputs", {
        body: { token, productId: selectedProduct.id }
      });

      if (error) {
        console.error("Error fetching outputs:", error);
        throw new Error("Error fetching product outputs");
      }

      console.log("Product outputs received:", data);
      return data;
    },
    enabled: !!selectedProduct?.id
  });

  // Mutations para prompts y outputs
  const createPromptMutation = useMutation({
    mutationFn: async (newPrompt: Omit<ProductPrompt, 'id'>) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newPrompt)
      });

      if (!response.ok) throw new Error("Error creating prompt");
      
      // Handle potentially empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Prompt añadido",
        description: "El nuevo prompt se ha creado correctamente.",
      });
      refetchPrompts();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al crear el prompt",
        variant: "destructive",
      });
    }
  });

  const createOutputMutation = useMutation({
    mutationFn: async (newOutput: Omit<ProductOutput, 'id'>) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newOutput)
      });

      if (!response.ok) throw new Error("Error creating output");
      
      // Handle potentially empty responses  
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Output añadido",
        description: "El nuevo output se ha creado correctamente.",
      });
      refetchOutputs();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al crear el output",
        variant: "destructive",
      });
    }
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/prompts/${promptId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error deleting prompt");
    },
    onSuccess: () => {
      toast({
        title: "Prompt eliminado",
        description: "El prompt se ha eliminado correctamente.",
      });
      refetchPrompts();
    }
  });

  const deleteOutputMutation = useMutation({
    mutationFn: async (outputId: string) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/outputs/${outputId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error deleting output");
    },
    onSuccess: () => {
      toast({
        title: "Output eliminado",
        description: "El output se ha eliminado correctamente.",
      });
      refetchOutputs();
    }
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (updatedPrompt: ProductPrompt) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedPrompt)
      });

      if (!response.ok) throw new Error("Error updating prompt");
      
      // Return success without trying to parse JSON since PUT often returns empty response
      return { success: true };
    },
    onSuccess: () => {
      refetchPrompts();
    }
  });

  const updateOutputMutation = useMutation({
    mutationFn: async (updatedOutput: ProductOutput) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedOutput)
      });

      if (!response.ok) throw new Error("Error updating output");
      
      // Return success without trying to parse JSON since PUT often returns empty response
      return { success: true };
    },
    onSuccess: () => {
      refetchOutputs();
    }
  });


  // Fetch products from EasyQuote API
  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ["easyquote-products", includeInactive],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
      }

      console.log("ProductManagement: Fetching products", { includeInactive });

      const { data, error } = await invokeEasyQuoteFunction("easyquote-products", {
        token,
        includeInactive 
      });

      if (error) {
        console.error("ProductManagement: Edge function error", error);
        throw error;
      }

      if (!data) {
        console.warn("ProductManagement: No data received");
        return [];
      }

      console.log("ProductManagement: Products received", data.length);
      return data as EasyQuoteProduct[];
    },
    enabled: !!hasToken,
    retry: (failureCount, error: any) => {
      // Si es error de autorización, no reintentar
      if (error?.message?.includes("401") || error?.message?.includes("EASYQUOTE_UNAUTHORIZED")) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Fetch ALL products for stats (siempre incluye inactivos)
  const { data: allProductsForStats = [] } = useQuery({
    queryKey: ["easyquote-products-stats"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) return [];

      const { data, error } = await invokeEasyQuoteFunction("easyquote-products", {
        token,
        includeInactive: true 
      });

      if (error || !data) return [];
      return data as EasyQuoteProduct[];
    },
    enabled: !!hasToken,
    retry: false
  });

  // Filtrar productos localmente
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.id?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtrar por categorías locales usando los mappings
    let matchesCategory = true;
    if (categoryFilter !== "all") {
      const mapping = getProductMapping(product.id);
      if (categoryFilter === "uncategorized") {
        // Mostrar productos sin categoría
        matchesCategory = !mapping?.category_id;
      } else {
        // Mostrar productos de la categoría seleccionada
        matchesCategory = mapping?.category_id === categoryFilter;
      }
    }

    // Filtrar por subcategorías
    let matchesSubcategory = true;
    if (subcategoryFilter !== "all" && categoryFilter !== "all" && categoryFilter !== "uncategorized") {
      const mapping = getProductMapping(product.id);
      if (subcategoryFilter === "no-subcategory") {
        // Mostrar productos sin subcategoría pero con categoría
        matchesSubcategory = mapping?.category_id && !mapping?.subcategory_id;
      } else {
        // Mostrar productos de la subcategoría seleccionada
        matchesSubcategory = mapping?.subcategory_id === subcategoryFilter;
      }
    }

    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  // Obtener categorías locales activas para el filtro
  const availableCategories = allCategories.filter(cat => cat.is_active);
  
  // Obtener subcategorías disponibles para la categoría seleccionada
  const availableSubcategories = allSubcategories.filter(sub => 
    sub.is_active && 
    (categoryFilter === "all" || sub.category_id === categoryFilter)
  );

  // Estadísticas - usar allProductsForStats para contar siempre todos
  const activeProducts = allProductsForStats.filter(p => p.isActive);
  const inactiveProducts = allProductsForStats.filter(p => !p.isActive);

  const handleEditProduct = async (product: EasyQuoteProduct) => {
    console.log("=== handleEditProduct called ===");
    console.log("Product ID:", product.id);
    console.log("Product Name:", product.productName);
    console.log("Excel File ID:", product.excelfileId);
    
    setSelectedProduct({ ...product });
    
    // Cargar categoría actual del producto
    const mapping = getProductMapping(product.id);
    setSelectedCategoryId(mapping?.category_id || "");
    setSelectedSubcategoryId(mapping?.subcategory_id || "");
    
    // Fetch Excel sheets if excelfileId exists
    if (product.excelfileId) {
      console.log("Excel File ID exists, fetching sheets...");
      try {
        const token = sessionStorage.getItem("easyquote_token");
        console.log("Token found:", token ? "YES" : "NO");
        
        if (token) {
          console.log("Calling easyquote-excel-files edge function with fileId:", product.excelfileId);
          
          const { data, error } = await supabase.functions.invoke("easyquote-excel-files", {
            body: { token, fileId: product.excelfileId }
          });
          
          console.log("Edge function response:", { data, error });
          
          if (!error && data) {
            console.log("Excel file data received:", data);
            console.log("Type of data:", typeof data);
            console.log("Has excelfilesSheets:", "excelfilesSheets" in data);
            
            if (data.excelfilesSheets && Array.isArray(data.excelfilesSheets)) {
              const sheetNames = data.excelfilesSheets.map((sheet: any) => sheet.sheetName).sort();
              console.log("Sheet names extracted:", sheetNames);
              console.log("Total sheets:", sheetNames.length);
              setExcelSheets(sheetNames);
            } else {
              console.warn("No excelfilesSheets found in response. Data structure:", Object.keys(data));
              setExcelSheets([]);
            }
          } else {
            console.error("Error from edge function:", error);
            setExcelSheets([]);
          }
        } else {
          console.warn("No token found in sessionStorage");
          setExcelSheets([]);
        }
      } catch (error) {
        console.error("Error fetching Excel sheets:", error);
        setExcelSheets([]); // Fallback
      }
    } else {
      console.log("No Excel File ID, skipping sheets fetch");
      setExcelSheets([]); // No Excel file associated
    }
    
    setIsEditDialogOpen(true);
  };

  // Auto-open edit dialog if editProduct parameter is present
  useEffect(() => {
    const editProductId = searchParams.get('editProduct');
    if (editProductId && products.length > 0) {
      const productToEdit = products.find(p => p.id === editProductId);
      if (productToEdit) {
        handleEditProduct(productToEdit);
        // Remove the parameter from URL to avoid reopening on refresh
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('editProduct');
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, [products, searchParams, setSearchParams]);

  // Mutation para actualizar producto
  const updateProductMutation = useMutation({
    mutationFn: async ({ product, action, closeDialog = true }: { product: EasyQuoteProduct; action?: 'delete' | 'update'; closeDialog?: boolean }) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      const payload = {
        id: product.id,
        productName: product.productName,
        isActive: product.isActive,
        description: product.description || "",
        category: product.category || "",
        excelfileId: product.excelfileId
      };

      console.log("Updating product with payload:", payload, "action:", action);

      const { data, error } = await invokeEasyQuoteFunction("easyquote-update-product", {
        token, 
        product: payload, 
        action
      });

      if (error) {
        console.error("Error response:", error);
        throw new Error(error.message || "Error al actualizar el producto");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Error al actualizar el producto");
      }

      return { data, closeDialog };
    },
    onSuccess: ({ closeDialog }) => {
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      if (closeDialog) {
        setIsEditDialogOpen(false);
        setSelectedProduct(null);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSaveProduct = () => {
    if (selectedProduct) {
      // Determinar acción: delete si está inactivo, update si está activo
      const action = selectedProduct.isActive ? 'update' : 'delete';
      
      // Actualizar producto en EasyQuote
      updateProductMutation.mutate({ product: selectedProduct, action });
      
      // Actualizar categoría en Supabase
      if (selectedCategoryId || selectedSubcategoryId) {
        upsertCategoryMapping.mutate({
          easyquote_product_id: selectedProduct.id,
          product_name: selectedProduct.productName,
          category_id: selectedCategoryId || undefined,
          subcategory_id: selectedSubcategoryId || undefined
        });
      }
    }
  };

  // Handle category assignment - integrado en handleSaveProduct

  // Add new prompt
  const addNewPrompt = () => {
    if (!selectedProduct || !promptTypes.length) return;
    
    // Calculate next sequence number
    const nextSeq = productPrompts.length === 0 ? 1 : Math.max(...productPrompts.map(p => p.promptSeq || 0)) + 1;
    
    // Calculate next row based on existing cells
    const getNextRow = () => {
      if (productPrompts.length === 0) return 2;
      
      const usedRows = productPrompts
        .map(p => {
          const promptMatch = p.promptCell?.match(/(\d+)/);
          const valueMatch = p.valueCell?.match(/(\d+)/);
          return [
            promptMatch ? parseInt(promptMatch[1]) : 0,
            valueMatch ? parseInt(valueMatch[1]) : 0
          ];
        })
        .flat()
        .filter(row => row > 0);
      
      const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : 1;
      return maxRow + 1;
    };
    
    const nextRow = getNextRow();
    
    // Reset form data and open dialog
    setNewPromptData({
      promptSheet: "",
      promptCell: "",
      valueSheet: "",
      valueCell: "",
      valueOptionSheet: "",
      valueOptionRange: "",
      promptType: promptTypes[0]?.id || 0,
      valueRequired: false,
      valueQuantityAllowedDecimals: 0,
      valueQuantityMin: 1,
      valueQuantityMax: 9999,
      promptSeq: nextSeq
    });
    setIsNewPromptDialogOpen(true);
  };

  const createNewPrompt = () => {
    if (!selectedProduct) return;

    // Calculate next sequence number to avoid duplicates
    const nextSeq = productPrompts.length === 0 ? 1 : Math.max(...productPrompts.map(p => p.promptSeq || 0)) + 1;

    // Verificar si el tipo es numérico
    const promptType = promptTypes.find(t => t.id === newPromptData.promptType);
    const isNumericType = promptType?.promptType === "Number" || promptType?.promptType === "Quantity";

    const newPrompt = {
      productId: selectedProduct.id,
      promptSeq: newPromptData.promptSeq,
      promptType: newPromptData.promptType,
      promptSheet: newPromptData.promptSheet,
      promptCell: newPromptData.promptCell,
      valueSheet: newPromptData.valueSheet, 
      valueCell: newPromptData.valueCell,
      valueOptionSheet: newPromptData.valueOptionSheet,
      valueOptionRange: newPromptData.valueOptionRange,
      valueRequired: newPromptData.valueRequired,
      // Solo incluir estos campos si el tipo es numérico con valores por defecto
      valueQuantityAllowedDecimals: isNumericType ? (newPromptData.valueQuantityAllowedDecimals ?? 0) : null,
      valueQuantityMin: isNumericType ? (newPromptData.valueQuantityMin ?? 1) : null,
      valueQuantityMax: isNumericType ? (newPromptData.valueQuantityMax ?? 9999) : null
    };

    createPromptMutation.mutate(newPrompt);
    setIsNewPromptDialogOpen(false);
  };

  // Add new output
  const addNewOutput = () => {
    if (!selectedProduct || !outputTypes.length) return;
    
    // Calculate next sequence number
    const nextSeq = productOutputs.length === 0 ? 1 : Math.max(...productOutputs.map(o => o.orderSeq || 0)) + 1;
    
    // Calculate next row based on existing cells
    const getNextRow = () => {
      if (productOutputs.length === 0) return 25;
      
      const usedRows = productOutputs
        .map(output => {
          const nameMatch = output.nameCell?.match(/(\d+)/);
          const valueMatch = output.valueCell?.match(/(\d+)/);
          return [
            nameMatch ? parseInt(nameMatch[1]) : 0,
            valueMatch ? parseInt(valueMatch[1]) : 0
          ];
        })
        .flat()
        .filter(row => row > 0);
      
      const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : 24;
      return maxRow + 1;
    };
    
    const nextRow = getNextRow();
    
    // Reset form data and open dialog
    setNewOutputData({
      sheet: "",
      prompt: "",
      defaultValue: "",
      outputTypeId: outputTypes[0]?.id || 0
    });
    setIsNewOutputDialogOpen(true);
  };

  const createNewOutput = () => {
    if (!selectedProduct) return;

    const newOutput = {
      productId: selectedProduct.id,
      outputTypeId: newOutputData.outputTypeId,
      sheet: newOutputData.sheet,
      nameCell: newOutputData.prompt,
      valueCell: newOutputData.defaultValue
    };

    createOutputMutation.mutate(newOutput);
    setIsNewOutputDialogOpen(false);
  };

  // Bulk create prompts
  const handleBulkSavePrompts = async (prompts: any[]) => {
    if (!selectedProduct) return;
    
    try {
      for (const promptData of prompts) {
        // Verificar si el tipo es numérico
        const promptType = promptTypes.find(t => t.id === promptData.promptType);
        const isNumericType = promptType?.promptType === "Number" || promptType?.promptType === "Quantity";
        
        const newPrompt = {
          productId: selectedProduct.id,
          promptSeq: promptData.promptSeq,
          promptType: promptData.promptType,
          promptSheet: promptData.sheet,
          promptCell: promptData.promptCell,
          valueSheet: promptData.sheet,  // Same sheet
          valueCell: promptData.valueCell,
          valueOptionSheet: promptData.sheet,  // Same sheet
          valueOptionRange: promptData.valueOptionRange,
          valueRequired: promptData.valueRequired,
          // Solo incluir estos campos si el tipo es numérico con valores por defecto
          valueQuantityAllowedDecimals: isNumericType ? (promptData.valueQuantityAllowedDecimals ?? 0) : null,
          valueQuantityMin: isNumericType ? (promptData.valueQuantityMin ?? 1) : null,
          valueQuantityMax: isNumericType ? (promptData.valueQuantityMax ?? 9999) : null
        };
        
        await createPromptMutation.mutateAsync(newPrompt);
      }
      
      setIsBulkPromptsDialogOpen(false);
      toast({
        title: "Éxito",
        description: `Se crearon ${prompts.length} datos de entrada correctamente.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear los datos de entrada",
        variant: "destructive",
      });
    }
  };

  // Bulk create outputs  
  const handleBulkSaveOutputs = async (outputs: any[]) => {
    if (!selectedProduct) return;
    
    try {
      for (const outputData of outputs) {
        const newOutput = {
          productId: selectedProduct.id,
          outputTypeId: outputData.outputTypeId,
          sheet: outputData.sheet,
          nameCell: outputData.nameCell,
          valueCell: outputData.valueCell
        };
        
        await createOutputMutation.mutateAsync(newOutput);
      }
      
      setIsBulkOutputsDialogOpen(false);
      toast({
        title: "Éxito",
        description: `Se crearon ${outputs.length} datos de salida correctamente.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear los datos de salida",
        variant: "destructive",
      });
    }
  };

  // Delete prompt
  const deletePrompt = (promptId: string) => {
    deletePromptMutation.mutate(promptId);
  };

  // Delete output
  const deleteOutput = (outputId: string) => {
    deleteOutputMutation.mutate(outputId);
  };

  // ALL CONDITIONAL LOGIC AND EARLY RETURNS MUST COME AFTER ALL HOOKS
  // Check permissions
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden ver productos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuración de EasyQuote requerida</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Para ver los productos, necesitas configurar tus credenciales de EasyQuote.</p>
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
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>No se pudieron cargar los productos de EasyQuote.</p>
            {error.message && (
              <p className="text-sm">{error.message}</p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="mt-2"
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold">Productos EasyQuote</h1>
          <p className="text-muted-foreground mt-1 lg:mt-2 text-sm">
            Catálogo de productos del API de EasyQuote para presupuestos
          </p>
        </div>
        <div className="flex-shrink-0 flex gap-2">
          <Button 
            onClick={() => navigate("/admin/productos/nuevo")}
            className="flex items-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Crear Producto</span>
            <span className="sm:hidden">Crear</span>
          </Button>
          <Button 
            onClick={() => navigate("/admin/productos/test")}
            variant="outline"
            className="flex items-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            <TestTube className="h-4 w-4" />
            <span className="hidden sm:inline">Probar Productos</span>
            <span className="sm:hidden">Probar</span>
          </Button>
        </div>
      </div>

      <Separator />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busca y filtra productos por diferentes criterios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4 items-end">
            {/* Búsqueda */}
            <div className="lg:col-span-2">
              <Label htmlFor="search" className="text-sm">Buscar productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre, ID o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Categoría */}
            <div>
              <Label className="text-sm">Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="uncategorized">Sin categoría</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Incluir inactivos */}
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
              <Label htmlFor="include-inactive" className="text-sm">Incluir inactivos</Label>
            </div>
          </div>
          
          {/* Filtro por subcategoría - línea separada solo si hay categoría seleccionada */}
          {categoryFilter !== "all" && categoryFilter !== "uncategorized" && availableSubcategories.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm">Subcategoría</Label>
              <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Todas las subcategorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las subcategorías</SelectItem>
                  <SelectItem value="no-subcategory">Sin subcategoría</SelectItem>
                  {availableSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xs lg:text-sm font-medium">Total Productos</CardTitle>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <div className="text-lg lg:text-2xl font-bold">{allProductsForStats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xs lg:text-sm font-medium">Productos activos</CardTitle>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <div className="text-lg lg:text-2xl font-bold text-green-600">{activeProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xs lg:text-sm font-medium">Productos inactivos</CardTitle>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <div className="text-lg lg:text-2xl font-bold text-red-600">{inactiveProducts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Productos</CardTitle>
              <CardDescription>
                Lista de productos obtenidos del API de EasyQuote
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 lg:p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando productos desde EasyQuote...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {products.length === 0 
                  ? "No hay productos en EasyQuote" 
                  : "No hay productos que coincidan con los filtros"
                }
              </p>
              {searchTerm || categoryFilter !== "all" || subcategoryFilter !== "all" ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setSubcategoryFilter("all");
                  }}
                  className="mt-2"
                >
                  Limpiar filtros
                </Button>
              ) : null}
            </div>
          ) : (
            <ProductTable 
              products={filteredProducts}
              getProductMapping={getProductMapping}
              onEditProduct={handleEditProduct}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
            <DialogDescription>
              Modifica los detalles del producto, datos de entrada y datos de salida
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
          <div>
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="prompts">Datos de entrada ({productPrompts.length})</TabsTrigger>
                <TabsTrigger value="outputs">Datos de salida ({productOutputs.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="productName">Nombre del producto</Label>
                    <Input
                      id="productName"
                      value={selectedProduct.productName}
                      onChange={(e) => setSelectedProduct({
                        ...selectedProduct,
                        productName: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={selectedProduct.description || ""}
                      onChange={(e) => setSelectedProduct({
                        ...selectedProduct,
                        description: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category-select">Categoría</Label>
                    <Select
                      value={selectedCategoryId || "none"}
                      onValueChange={(value) => {
                        setSelectedCategoryId(value === "none" ? "" : value);
                        setSelectedSubcategoryId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {allCategories.filter(cat => cat.is_active).map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedCategoryId && (
                    <div>
                      <Label htmlFor="subcategory-select">Subcategoría</Label>
                      <Select
                        value={selectedSubcategoryId || "none"}
                        onValueChange={(value) => setSelectedSubcategoryId(value === "none" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin subcategoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin subcategoría</SelectItem>
                          {allSubcategories
                            .filter(subcat => 
                              subcat.category_id === selectedCategoryId && subcat.is_active
                            )
                            .map((subcategory) => (
                              <SelectItem key={subcategory.id} value={subcategory.id}>
                                {subcategory.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={selectedProduct.isActive}
                    onCheckedChange={(checked) => setSelectedProduct({
                      ...selectedProduct,
                      isActive: checked
                    })}
                  />
                  <Label htmlFor="isActive">Producto activo</Label>
                </div>
              </TabsContent>

              <TabsContent value="prompts" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Datos de entrada del Producto</h3>
                    <p className="text-sm text-muted-foreground">
                      Gestiona los campos de entrada para este producto
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addNewPrompt} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir uno
                    </Button>
                    <Button onClick={() => setIsBulkPromptsDialogOpen(true)} size="sm">
                      <Layers className="h-4 w-4 mr-2" />
                      Añadir Varios
                    </Button>
                  </div>
                </div>

                {promptsLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando datos entrada...</p>
                  </div>
                ) : productPrompts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay datos de entrada configurados</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {productPrompts.map((prompt, index) => (
                      <div key={prompt.id} className="p-4 border rounded-lg">
                        <div className="mb-4">
                          <h4 className="font-medium">Campo nº {index + 1}</h4>
                        </div>
                        
                        {(() => {
                          const currentPromptType = promptTypes.find(type => type.id === prompt.promptType);
                          const isNumericType = currentPromptType?.promptType === "Number" || currentPromptType?.promptType === "Quantity";
                          const isDropdownType = currentPromptType?.promptType === "DropDown";
                          
                          return (
                            <>
                            <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-2">
                                <Label>Hoja</Label>
                                <Select
                                  value={prompt.promptSheet || ""}
                                  onValueChange={(value) => {
                                    const updatedPrompt = { 
                                      ...prompt, 
                                      promptSheet: value,
                                      // Asegurar que los campos numéricos sean null si no es tipo numérico
                                      valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                      valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                      valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                    };
                                    updatePromptMutation.mutate(updatedPrompt);
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={prompt.promptSheet || "Seleccionar hoja"} />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    {/* Mostrar valor actual si existe y no está en la lista */}
                                    {prompt.promptSheet && !excelSheets.includes(prompt.promptSheet) && (
                                      <SelectItem value={prompt.promptSheet}>
                                        {prompt.promptSheet}
                                      </SelectItem>
                                    )}
                                    {excelSheets.map((sheet) => (
                                      <SelectItem key={sheet} value={sheet}>
                                        {sheet}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-1">
                                <Label>Rótulo</Label>
                                <Input
                                  defaultValue={prompt.promptCell}
                                  onBlur={(e) => {
                                    const updatedPrompt = { 
                                      ...prompt, 
                                      promptCell: e.target.value,
                                      // Asegurar que los campos numéricos sean null si no es tipo numérico
                                      valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                      valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                      valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                    };
                                    updatePromptMutation.mutate(updatedPrompt);
                                  }}
                                />
                              </div>
                              <div className="col-span-1">
                                <Label>Valor</Label>
                                <Input
                                  defaultValue={prompt.valueCell || ""}
                                  onBlur={(e) => {
                                    const updatedPrompt = { 
                                      ...prompt, 
                                      valueCell: e.target.value,
                                      // Asegurar que los campos numéricos sean null si no es tipo numérico
                                      valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                      valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                      valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                    };
                                    updatePromptMutation.mutate(updatedPrompt);
                                  }}
                                />
                              </div>
                              <div className="col-span-1">
                                <Label>Orden</Label>
                                <Input
                                  type="number"
                                  defaultValue={prompt.promptSeq}
                                  onBlur={(e) => {
                                    const updatedPrompt = { 
                                      ...prompt, 
                                      promptSeq: parseInt(e.target.value),
                                      // Asegurar que los campos numéricos sean null si no es tipo numérico
                                      valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                      valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                      valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                    };
                                    updatePromptMutation.mutate(updatedPrompt);
                                  }}
                                />
                              </div>
                              
                              {/* Rango - Solo para tipos no numéricos */}
                              {!isNumericType && (
                                <div className="col-span-2">
                                  <Label>Rango</Label>
                                  <Input
                                    defaultValue={prompt.valueOptionRange || ""}
                                    placeholder="$E$2:$E$3"
                                    onBlur={(e) => {
                                      const updatedPrompt = { 
                                        ...prompt, 
                                        valueOptionRange: e.target.value,
                                        // Asegurar que los campos numéricos sean null para tipos no numéricos
                                        valueQuantityAllowedDecimals: null,
                                        valueQuantityMin: null,
                                        valueQuantityMax: null
                                      };
                                      updatePromptMutation.mutate(updatedPrompt);
                                    }}
                                  />
                                </div>
                              )}

                                <div className="col-span-2">
                                 <Label>Typo</Label>
                                 <Select
                                   value={prompt.promptType?.toString() || ""}
                                   onValueChange={(value) => {
                                     const newType = parseInt(value);
                                     const newPromptType = promptTypes.find(t => t.id === newType);
                                     const isNewTypeNumeric = newPromptType?.promptType === "Number" || newPromptType?.promptType === "Quantity";
                                     
                                     const updatedPrompt = { 
                                       ...prompt, 
                                       promptType: newType,
                                       // Si el nuevo tipo NO es numérico, establecer los campos numéricos como null
                                       valueQuantityAllowedDecimals: isNewTypeNumeric ? prompt.valueQuantityAllowedDecimals : null,
                                       valueQuantityMin: isNewTypeNumeric ? prompt.valueQuantityMin : null,
                                       valueQuantityMax: isNewTypeNumeric ? prompt.valueQuantityMax : null
                                     };
                                     updatePromptMutation.mutate(updatedPrompt);
                                   }}
                                 >
                                   <SelectTrigger>
                                     <SelectValue />
                                   </SelectTrigger>
                                    <SelectContent className="bg-background border shadow-lg z-50">
                                      {promptTypes.map((type) => (
                                        <SelectItem key={type.id} value={type.id?.toString() || "0"}>
                                          {type.promptType}
                                        </SelectItem>
                                      ))}
                                   </SelectContent>
                                 </Select>
                               </div>

                              <div className="col-span-1">
                                <Label>Requerido</Label>
                                <Switch
                                  checked={prompt.valueRequired}
                                  onCheckedChange={(checked) => {
                                    const updatedPrompt = { 
                                      ...prompt, 
                                      valueRequired: checked,
                                      // Asegurar que los campos numéricos sean null si no es tipo numérico
                                      valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                      valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                      valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                    };
                                    updatePromptMutation.mutate(updatedPrompt);
                                  }}
                                />
                              </div>

                              {/* Campos numéricos - Solo para tipos Number/Quantity */}
                              {isNumericType && (
                                <>
                                  <div className="col-span-1">
                                    <Label>Decs.</Label>
                                    <Input
                                      type="number"
                                      defaultValue={prompt.valueQuantityAllowedDecimals ?? 0}
                                      onBlur={(e) => {
                                        const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                        const updatedPrompt = { 
                                          ...prompt, 
                                          valueQuantityAllowedDecimals: value,
                                          valueQuantityMin: prompt.valueQuantityMin ?? 1,
                                          valueQuantityMax: prompt.valueQuantityMax ?? 9999
                                        };
                                        updatePromptMutation.mutate(updatedPrompt);
                                      }}
                                    />
                                  </div>
                                   <div className="col-span-1">
                                     <Label>Mínimo</Label>
                                     <Input
                                       type="number"
                                       defaultValue={prompt.valueQuantityMin ?? 1}
                                       onBlur={(e) => {
                                         const value = e.target.value === '' ? 1 : parseInt(e.target.value);
                                         const updatedPrompt = { 
                                           ...prompt, 
                                           valueQuantityMin: value,
                                           valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals ?? 0,
                                           valueQuantityMax: prompt.valueQuantityMax ?? 9999
                                         };
                                         updatePromptMutation.mutate(updatedPrompt);
                                       }}
                                     />
                                   </div>
                                   <div className="col-span-1">
                                     <Label>Máximo</Label>
                                     <Input
                                       type="number"
                                       defaultValue={prompt.valueQuantityMax ?? 9999}
                                       onBlur={(e) => {
                                         const value = e.target.value === '' ? 9999 : parseInt(e.target.value);
                                         const updatedPrompt = { 
                                           ...prompt, 
                                           valueQuantityMax: value,
                                           valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals ?? 0,
                                           valueQuantityMin: prompt.valueQuantityMin ?? 1
                                         };
                                         updatePromptMutation.mutate(updatedPrompt);
                                       }}
                                     />
                                   </div>
                                 </>
                               )}

                               {/* Espacios vacíos para mantener alineación cuando no hay campos numéricos */}
                               {!isNumericType && <div className="col-span-1"></div>}

                              <div className="col-span-1">
                                <Label>Acción</Label>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                     onClick={() => {
                                       // Al guardar manualmente, asegurar que los valores numéricos tengan defaults o sean null
                                       const updatedPrompt = {
                                         ...prompt,
                                         valueQuantityAllowedDecimals: isNumericType ? (prompt.valueQuantityAllowedDecimals ?? 0) : null,
                                         valueQuantityMin: isNumericType ? (prompt.valueQuantityMin ?? 1) : null,
                                         valueQuantityMax: isNumericType ? (prompt.valueQuantityMax ?? 9999) : null
                                       };
                                       updatePromptMutation.mutate(updatedPrompt);
                                     }}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deletePrompt(prompt.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Variable de producción - Línea separada */}
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                              <Label className="w-48 text-sm font-medium">Variable de producción</Label>
                              <Select
                                value={getMappedVariableId(prompt.promptCell) || "none"}
                                onValueChange={(value) => {
                                  if (selectedProduct) {
                                    upsertVariableMapping({
                                      easyquoteProductId: selectedProduct.id,
                                      productName: selectedProduct.productName,
                                      promptOrOutputName: prompt.promptCell,
                                      variableId: value === "none" ? null : value,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Sin variable asignada" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-50">
                                  <SelectItem value="none">Sin variable asignada</SelectItem>
                                  {productionVariables
                                    .filter(v => {
                                      const mappedNames = getMappedNames();
                                      const currentMapping = getMappedVariableId(prompt.promptCell);
                                      return !mappedNames.includes(prompt.promptCell) || 
                                             (currentMapping && v.id === currentMapping);
                                    })
                                    .map((variable) => (
                                      <SelectItem key={variable.id} value={variable.id}>
                                        {variable.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="outputs" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Datos de salida del Producto</h3>
                    <p className="text-sm text-muted-foreground">
                      Gestiona los campos de salida para este producto
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addNewOutput} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir uno
                    </Button>
                    <Button onClick={() => setIsBulkOutputsDialogOpen(true)} size="sm">
                      <Layers className="h-4 w-4 mr-2" />
                      Añadir Varios
                    </Button>
                  </div>
                </div>

                {outputsLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando datos de salida...</p>
                  </div>
                ) : productOutputs.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay datos de salida configurados</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {productOutputs.map((output, index) => (
                      <div key={output.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-medium">Campo nº {index + 1}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOutput(output.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Hoja</Label>
                            <Select
                              value={output.sheet || ""}
                              onValueChange={(value) => {
                                const updatedOutput = { ...output, sheet: value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={output.sheet || "Seleccionar hoja"} />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {/* Mostrar valor actual si existe y no está en la lista */}
                                {output.sheet && !excelSheets.includes(output.sheet) && (
                                  <SelectItem value={output.sheet}>
                                    {output.sheet}
                                  </SelectItem>
                                )}
                                {excelSheets.map((sheet) => (
                                  <SelectItem key={sheet} value={sheet}>
                                    {sheet}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Rótulo</Label>
                            <Input
                              value={output.nameCell || ""}
                              placeholder="ej: A25"
                              onChange={(e) => {
                                const updatedOutput = { ...output, nameCell: e.target.value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Valor por defecto</Label>
                            <Input
                              value={output.valueCell || ""}
                              placeholder="ej: B25"
                              onChange={(e) => {
                                const updatedOutput = { ...output, valueCell: e.target.value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Tipo</Label>
                            <Select
                              value={output.outputTypeId?.toString() || ""}
                              onValueChange={(value) => {
                                const updatedOutput = { ...output, outputTypeId: parseInt(value) };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {outputTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id?.toString() || "0"}>
                                    {type.outputType}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Variable de producción - Línea separada */}
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                          <Label className="w-48 text-sm font-medium">Variable de producción</Label>
                          <Select
                            value={getMappedVariableId(output.nameCell) || "none"}
                            onValueChange={(value) => {
                              if (selectedProduct) {
                                upsertVariableMapping({
                                  easyquoteProductId: selectedProduct.id,
                                  productName: selectedProduct.productName,
                                  promptOrOutputName: output.nameCell,
                                  variableId: value === "none" ? null : value,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Sin variable asignada" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="none">Sin variable asignada</SelectItem>
                              {productionVariables
                                .filter(v => {
                                  const mappedNames = getMappedNames();
                                  const currentMapping = getMappedVariableId(output.nameCell);
                                  return !mappedNames.includes(output.nameCell) || 
                                         (currentMapping && v.id === currentMapping);
                                })
                                .map((variable) => (
                                  <SelectItem key={variable.id} value={variable.id}>
                                    {variable.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveProduct}
                disabled={updateProductMutation.isPending}
              >
                {updateProductMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo para nuevo prompt */}
      <Dialog open={isNewPromptDialogOpen} onOpenChange={setIsNewPromptDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Añadir nuevo dato de entrada</DialogTitle>
            <DialogDescription>
              Configura los datos del nuevo valor de entrada
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <Label htmlFor="promptSheet">Hoja</Label>
                <Select
                  value={newPromptData.promptSheet || ""}
                  onValueChange={(value) => setNewPromptData({...newPromptData, promptSheet: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hoja" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {excelSheets.map((sheet) => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label htmlFor="promptCell">Celda rótulo</Label>
                <Input
                  id="promptCell"
                  value={newPromptData.promptCell}
                  onChange={(e) => setNewPromptData({...newPromptData, promptCell: e.target.value})}
                  placeholder="ej: A1"
                />
              </div>
              <div className="col-span-3">
                <Label htmlFor="valueCell">Celda valor</Label>
                <Input
                  id="valueCell"
                  value={newPromptData.valueCell}
                  onChange={(e) => setNewPromptData({...newPromptData, valueCell: e.target.value})}
                  placeholder="ej: B1"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="promptSeq">Orden</Label>
                <Input
                  id="promptSeq"
                  type="number"
                  value={newPromptData.promptSeq}
                  onChange={(e) => setNewPromptData({...newPromptData, promptSeq: parseInt(e.target.value) || 1})}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <Label htmlFor="promptType">Tipo</Label>
                <Select
                  value={newPromptData.promptType.toString()}
                  onValueChange={(value) => setNewPromptData({...newPromptData, promptType: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promptTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.promptType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center space-x-2 pt-6">
                <Switch
                  id="valueRequired"
                  checked={newPromptData.valueRequired}
                  onCheckedChange={(checked) => setNewPromptData({...newPromptData, valueRequired: checked})}
                />
                <Label htmlFor="valueRequired">Requerido</Label>
              </div>
              <div className="col-span-6">
                <Label htmlFor="valueOptionRange">Rango</Label>
                <Input
                  id="valueOptionRange"
                  value={newPromptData.valueOptionRange}
                  onChange={(e) => setNewPromptData({...newPromptData, valueOptionRange: e.target.value})}
                  placeholder="ej: $E$2:$E$3"
                />
              </div>
            </div>
            {/* Campos numéricos - solo si el tipo es Number (0) */}
            {newPromptData.promptType === 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="valueQuantityAllowedDecimals">Decimales</Label>
                  <Input
                    id="valueQuantityAllowedDecimals"
                    type="number"
                    value={newPromptData.valueQuantityAllowedDecimals}
                    onChange={(e) => setNewPromptData({...newPromptData, valueQuantityAllowedDecimals: parseInt(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="valueQuantityMin">Mínimo</Label>
                  <Input
                    id="valueQuantityMin"
                    type="number"
                    value={newPromptData.valueQuantityMin}
                    onChange={(e) => setNewPromptData({...newPromptData, valueQuantityMin: parseFloat(e.target.value) || 1})}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="valueQuantityMax">Máximo</Label>
                  <Input
                    id="valueQuantityMax"
                    type="number"
                    value={newPromptData.valueQuantityMax}
                    onChange={(e) => setNewPromptData({...newPromptData, valueQuantityMax: parseFloat(e.target.value) || 9999})}
                    placeholder="9999"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsNewPromptDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createNewPrompt}>
              Crear valor de entrada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para nuevo output */}
      <Dialog open={isNewOutputDialogOpen} onOpenChange={setIsNewOutputDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Añadir nuevo dato de salida</DialogTitle>
            <DialogDescription>
              Configura los datos del nuevo output
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="outputSheet">Hoja</Label>
                <Select
                  value={newOutputData.sheet || ""}
                  onValueChange={(value) => setNewOutputData({...newOutputData, sheet: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hoja" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {excelSheets.map((sheet) => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="outputPrompt">Rótulo</Label>
                <Input
                  id="outputPrompt"
                  value={newOutputData.prompt}
                  onChange={(e) => setNewOutputData({...newOutputData, prompt: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="outputDefault">Valor por defecto</Label>
                <Input
                  id="outputDefault"
                  value={newOutputData.defaultValue}
                  onChange={(e) => setNewOutputData({...newOutputData, defaultValue: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="outputType">Tipo</Label>
                <Select
                  value={newOutputData.outputTypeId.toString()}
                  onValueChange={(value) => setNewOutputData({...newOutputData, outputTypeId: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {outputTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.outputType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsNewOutputDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createNewOutput}>
              Crear Output
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogos masivos */}
      <BulkPromptsDialog
        open={isBulkPromptsDialogOpen}
        onOpenChange={setIsBulkPromptsDialogOpen}
        onSave={handleBulkSavePrompts}
        promptTypes={promptTypes}
        isSaving={createPromptMutation.isPending}
        existingPrompts={productPrompts}
      />

      <BulkOutputsDialog
        open={isBulkOutputsDialogOpen}
        onOpenChange={setIsBulkOutputsDialogOpen}
        onSave={handleBulkSaveOutputs}
        outputTypes={outputTypes}
        isSaving={createOutputMutation.isPending}
        existingOutputs={productOutputs}
      />
    </div>
  );
}