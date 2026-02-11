import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useProductCategoryMappings } from "@/hooks/useProductCategoryMappings";
import { useProductionVariables } from "@/hooks/useProductionVariables";
import { useProductVariableMappings } from "@/hooks/useProductVariableMappings";
import { ProductTable } from "@/components/ProductTable";
import { Package, Search, AlertCircle, AlertTriangle, CheckCircle2, XCircle, Loader2, Edit, Settings, Plus, Trash2, Save, TestTube, Layers, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { BulkPromptsDialog } from "@/components/quotes/BulkPromptsDialog";
import { BulkOutputsDialog } from "@/components/quotes/BulkOutputsDialog";
import { useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExcelErrorScannerDialog } from "@/components/diagnostics/ExcelErrorScannerDialog";
import { useProductComponentSettings, COMPONENT_PRESETS } from "@/hooks/useProductComponentSettings";
import { Checkbox } from "@/components/ui/checkbox";
import { CompositeProductConfig } from "@/components/products/CompositeProductConfig";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { normalizeApiUserId } from "@/utils/normalizeApiUserId";

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
  orderSeq?: number;
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

// Componente Sortable para outputs
function SortableOutputItem({
  output,
  index,
  excelSheets,
  outputTypes,
  onUpdate,
  onDelete,
  getMappedVariableId,
  getMappedNames,
  upsertVariableMapping,
  productionVariables,
  selectedProduct,
  labelValue,
  onLabelChange,
}: {
  output: ProductOutput;
  index: number;
  excelSheets: string[];
  outputTypes: OutputType[];
  onUpdate: (output: ProductOutput) => void;
  onDelete: (id: string) => void;
  getMappedVariableId: (name: string) => string | undefined;
  getMappedNames: () => string[];
  upsertVariableMapping: (data: any) => void;
  productionVariables: any[];
  selectedProduct: EasyQuoteProduct | null;
  labelValue: string;
  onLabelChange: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: output.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const displayLabel = labelValue || output.nameCell || `Campo nº ${index + 1}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 border rounded-lg bg-background ${
        isDragging ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            type="button"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <h4 className="font-medium">{displayLabel}</h4>
          {labelValue && (
            <span className="text-xs text-muted-foreground">({output.nameCell})</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-2">
          <Label>Hoja</Label>
          <Select
            value={output.sheet || ""}
            onValueChange={(value) =>
              onUpdate({
                ...output,
                sheet: value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={output.sheet || "Seleccionar hoja"} />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {output.sheet && !excelSheets.includes(output.sheet) && (
                <SelectItem value={output.sheet}>{output.sheet}</SelectItem>
              )}
              {excelSheets.map((sheet) => (
                <SelectItem key={sheet} value={sheet}>
                  {sheet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-3">
          <Label>Rótulo</Label>
          <Input
            defaultValue={output.nameCell || ""}
            placeholder="ej: A25"
            onBlur={(e) =>
              onUpdate({
                ...output,
                nameCell: e.target.value,
              })
            }
          />
        </div>

        <div className="col-span-3">
          <Label>Valor por defecto</Label>
          <Input
            defaultValue={output.valueCell || ""}
            placeholder="ej: B25"
            onBlur={(e) =>
              onUpdate({
                ...output,
                valueCell: e.target.value,
              })
            }
          />
        </div>

        <div className="col-span-2">
          <Label>Tipo</Label>
          <Select
            value={output.outputTypeId?.toString() || ""}
            onValueChange={(value) =>
              onUpdate({
                ...output,
                outputTypeId: parseInt(value),
              })
            }
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

        <div className="col-span-2">
          <Label>Acción</Label>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onUpdate(output)}>
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(output.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Etiqueta + Variable de prod. en la misma línea (sin "General") */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <Label className="text-sm font-medium whitespace-nowrap">Etiqueta</Label>
            <Input
              className="flex-1 h-8"
              value={labelValue}
              placeholder="Nombre descriptivo"
              onChange={(e) => onLabelChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Variable de prod.</Label>
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
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sin variable" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="none">Sin variable asignada</SelectItem>
                {productionVariables
                  .filter((v) => {
                    const mappedNames = getMappedNames();
                    const currentMapping = getMappedVariableId(output.nameCell);
                    return (
                      !mappedNames.includes(output.nameCell) ||
                      (currentMapping && v.id === currentMapping)
                    );
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
      </div>
    </div>
  );
}

export default function ProductManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const initialViewMode = searchParams.get('view') === 'componentes' ? 'componentes' : 'productos';
  const [viewMode, setViewMode] = useState<'productos' | 'componentes'>(initialViewMode);
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
  const [isDeleteProductDialogOpen, setIsDeleteProductDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [productType, setProductType] = useState<'sencillo' | 'compuesto' | 'kit'>('sencillo');
  const [selectedInputComponent, setSelectedInputComponent] = useState<string>('general');
  // Estado para labels de prompts y outputs (se guardan al hacer clic en "Guardar cambios")
  const [promptLabelDrafts, setPromptLabelDrafts] = useState<Record<string, string>>({});
  const [outputLabelDrafts, setOutputLabelDrafts] = useState<Record<string, string>>({});
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
    valueQuantityMin: 0,
    valueQuantityMax: 9999,
    promptSeq: 1,
    component: "general" // Componente asignado
  });
  const [newOutputData, setNewOutputData] = useState({
    sheet: "",
    prompt: "",
    defaultValue: "",
    outputTypeId: 0,
    component: "general"
  });
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [availableExcelFiles, setAvailableExcelFiles] = useState<EasyQuoteExcelFile[]>([]);
  const {
    isSuperAdmin,
    isOrgAdmin,
    organization,
    membership
  } = useSubscription();
  const organizationId = organization?.id || membership?.organization_id;
  const apiUserId = normalizeApiUserId(
    organization?.api_user_id ??
      (membership?.organization as any)?.api_user_id ??
      membership?.organization
  );
  const queryClient = useQueryClient();

  // Hooks for categories
  const {
    categories: allCategories,
    subcategories: allSubcategories
  } = useProductCategories();
  const {
    mappings: categoryMappings,
    getProductMapping,
    upsertMapping: upsertCategoryMapping,
    deleteMapping: deleteCategoryMapping
  } = useProductCategoryMappings();

  // Hooks for production variables
  const {
    variables: productionVariables
  } = useProductionVariables();
  const {
    mappings: variableMappings,
    upsertMapping: upsertVariableMapping,
    getMappedVariableId,
    getMappedNames
  } = useProductVariableMappings(selectedProduct?.id);

  // Hooks for product component settings (composite)
  const {
    componentSettings,
    promptComponents,
    isComposite,
    enabledComponents,
    productType: savedProductType,
    upsertSettings: upsertComponentSettings,
    assignPromptToComponent,
    getPromptComponent,
    isUpserting: isUpsertingComponents,
    isAssigning: isAssigningComponent
  } = useProductComponentSettings(selectedProduct?.id, apiUserId);

  // Sincronizar productType con el valor guardado en BD
  useEffect(() => {
    if (savedProductType) {
      setProductType(savedProductType);
    }
  }, [savedProductType]);

  // Query para obtener IDs de productos que son componentes (por api_user_id)
  const { data: componentProductIds = new Set<string>(), refetch: refetchComponentIds } = useQuery({
    queryKey: ['component-product-ids', apiUserId],
    queryFn: async () => {
      console.log("[ProductManagement] Fetching component IDs for apiUserId:", apiUserId);
      if (!apiUserId) {
        console.log("[ProductManagement] No apiUserId, returning empty Set");
        return new Set<string>();
      }
      const { data, error } = await supabase
        .from('product_component_settings')
        .select('easyquote_product_id')
        .eq('api_user_id', apiUserId)
        .eq('is_component', true);
      if (error) {
        console.error("Error fetching component IDs:", error);
        return new Set<string>();
      }
      const ids = new Set((data || []).map(d => d.easyquote_product_id));
      console.log("[ProductManagement] Component IDs found:", ids.size, [...ids]);
      return ids;
    },
    enabled: !!apiUserId,
  });

  // Query para obtener IDs de productos compuestos (por api_user_id)
  const { data: compositeProductIds = new Set<string>() } = useQuery({
    queryKey: ['composite-product-ids', apiUserId],
    queryFn: async () => {
      if (!apiUserId) return new Set<string>();
      const { data, error } = await supabase
        .from('product_component_settings')
        .select('easyquote_product_id')
        .eq('api_user_id', apiUserId)
        .eq('is_composite', true);
      if (error) {
        console.error("Error fetching composite IDs:", error);
        return new Set<string>();
      }
      return new Set((data || []).map(d => d.easyquote_product_id));
    },
    enabled: !!apiUserId,
    select: (data) => data instanceof Set ? data : new Set<string>()
  });

  // Ya no necesitamos query para productos compuestos locales (comp_*)
  // Todos los productos compuestos ahora vienen de EasyQuote con Excel

  // Mutación para cambiar si un producto es componente (por api_user_id)
  const toggleComponentMutation = useMutation({
    mutationFn: async ({ productId, isComponent }: { productId: string; isComponent: boolean }) => {
      if (!apiUserId || !organizationId) throw new Error('No organization');
      const { error } = await supabase
        .from('product_component_settings')
        .upsert({
          organization_id: organizationId,
          api_user_id: apiUserId,
          easyquote_product_id: productId,
          is_component: isComponent,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'api_user_id,easyquote_product_id',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-product-ids'] });
      toast({ title: "Producto actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Ya no necesitamos la mutación para eliminar productos locales comp_*

  // Helper to get current organization ID from sessionStorage or fetch it
  const getCurrentOrganizationIdAsync = async (): Promise<string | null> => {
    // First try sessionStorage
    const stored = sessionStorage.getItem('selectedOrganization');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id) return parsed.id;
      } catch {
        // continue to fallback
      }
    }

    // Fallback: query from Supabase
    const {
      data: userData
    } = await supabase.auth.getUser();
    if (!userData.user) return null;

    // Check if user owns an organization
    const {
      data: orgData
    } = await supabase.from('organizations').select('id').eq('api_user_id', userData.user.id).limit(1);
    if (orgData && orgData.length > 0) {
      return orgData[0].id;
    }

    // Check if user is member of an organization
    const {
      data: memberData
    } = await supabase.from('organization_members').select('organization_id').eq('user_id', userData.user.id).limit(1);
    if (memberData && memberData.length > 0) {
      return memberData[0].organization_id;
    }
    return null;
  };

  // Query for prompt settings (hide in documents / labels)
  // IMPORTANTE: Usar api_user_id para compartir configuración entre organizaciones del mismo grupo
  const {
    data: promptSettings = [],
    refetch: refetchPromptSettings,
  } = useQuery({
    queryKey: ["product-prompt-settings", selectedProduct?.id, apiUserId],
    queryFn: async () => {
      if (!selectedProduct?.id || !apiUserId) return [];

      const { data, error } = await supabase
        .from("product_prompt_settings")
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("easyquote_product_id", selectedProduct.id);

      if (error) {
        console.error("Error fetching prompt settings:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedProduct?.id && !!apiUserId,
  });

  // Mutation for prompt settings
  const upsertPromptSettingMutation = useMutation({
    mutationFn: async ({
      productId,
      promptName,
      hideInDocuments,
      adminOnly,
      forceResult,
      isHidden,
      label,
    }: {
      productId: string;
      promptName: string;
      hideInDocuments?: boolean;
      adminOnly?: boolean;
      forceResult?: boolean;
      isHidden?: boolean;
      label?: string;
    }) => {
      const normalizePromptKey = (v: string) =>
        String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
      const promptKey = normalizePromptKey(promptName);

      // IMPORTANT: Usar api_user_id para compartir configuración entre organizaciones del mismo grupo
      if (!apiUserId) throw new Error("No api_user_id available");

      console.log("Saving prompt setting:", {
        apiUserId,
        productId,
        promptName: promptKey,
        hideInDocuments,
        adminOnly,
        forceResult,
        label,
      });

      // First try to find existing record by api_user_id
      const { data: existing } = await supabase
        .from("product_prompt_settings")
        .select("id")
        .eq("api_user_id", apiUserId)
        .eq("easyquote_product_id", productId)
        .eq("prompt_name", promptKey)
        .maybeSingle();

      // Build update object with only provided fields
      const updateData: {
        hide_in_documents?: boolean;
        admin_only?: boolean;
        force_result?: boolean;
        is_hidden?: boolean;
        label?: string;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      if (hideInDocuments !== undefined) updateData.hide_in_documents = hideInDocuments;
      if (adminOnly !== undefined) updateData.admin_only = adminOnly;
      if (forceResult !== undefined) updateData.force_result = forceResult;
      if (isHidden !== undefined) updateData.is_hidden = isHidden;
      if (label !== undefined) updateData.label = label;

      if (existing?.id) {
        const { error } = await supabase
          .from("product_prompt_settings")
          .update(updateData)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_prompt_settings").insert({
          api_user_id: apiUserId,
          organization_id: organizationId!, // Keep for backwards compat
          easyquote_product_id: productId,
          prompt_name: promptKey,
          hide_in_documents: hideInDocuments ?? false,
          admin_only: adminOnly ?? false,
          force_result: forceResult ?? false,
          is_hidden: isHidden ?? false,
          label: label ?? null,
        });
        if (error) throw error;
      }

      return {
        apiUserId,
        productId,
        promptKey,
        patch: {
          hide_in_documents: hideInDocuments,
          admin_only: adminOnly,
          force_result: forceResult,
          is_hidden: isHidden,
          label,
        },
      };
    },
    onSuccess: async (result, variables) => {
      // Update cache immediately (avoids waiting for any delayed refetch pipeline)
      queryClient.setQueryData(
        ["product-prompt-settings", variables.productId, result.apiUserId],
        (old: any[] | undefined) => {
          const existing = Array.isArray(old) ? old : [];
          const idx = existing.findIndex(
            (s) =>
              String(s?.prompt_name ?? "").replace(/\$/g, "").trim().toUpperCase() ===
              result.promptKey
          );

          const nextItem = {
            ...(idx >= 0 ? existing[idx] : {}),
            api_user_id: result.apiUserId,
            easyquote_product_id: variables.productId,
            prompt_name: result.promptKey,
            ...(result.patch.hide_in_documents !== undefined
              ? { hide_in_documents: result.patch.hide_in_documents }
              : {}),
            ...(result.patch.admin_only !== undefined
              ? { admin_only: result.patch.admin_only }
              : {}),
            ...(result.patch.force_result !== undefined
              ? { force_result: result.patch.force_result }
              : {}),
            ...(result.patch.is_hidden !== undefined
              ? { is_hidden: result.patch.is_hidden }
              : {}),
            ...(result.patch.label !== undefined ? { label: result.patch.label } : {}),
            updated_at: new Date().toISOString(),
          };

          if (idx >= 0) {
            const copy = [...existing];
            copy[idx] = nextItem;
            return copy;
          }
          return [...existing, nextItem];
        }
      );

      // Then refetch to ensure we have the canonical DB state (ids, etc.)
      await refetchPromptSettings();
      // NOTE: Toast suppressed here — a single consolidated toast is shown in handleSaveProduct
    },
    onError: (error) => {
      console.error("Error saving prompt setting:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Helper to check if prompt is hidden in documents
  const isPromptHiddenInDocuments = (promptName: string): boolean => {
    const normalizePromptKey = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
    const key = normalizePromptKey(promptName);
    const setting = promptSettings.find(s => normalizePromptKey(s.prompt_name) === key);
    return setting?.hide_in_documents || false;
  };

  // Helper to check if prompt is admin only
  const isPromptAdminOnly = (promptName: string): boolean => {
    const normalizePromptKey = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
    const key = normalizePromptKey(promptName);
    const setting = promptSettings.find(s => normalizePromptKey(s.prompt_name) === key);
    return setting?.admin_only || false;
  };

  // Helper to check if prompt is "force result"
  const isPromptForceResult = (promptName: string): boolean => {
    const normalizePromptKey = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
    const key = normalizePromptKey(promptName);
    const setting = promptSettings.find(s => normalizePromptKey(s.prompt_name) === key);
    return setting?.force_result || false;
  };

  // Helper to check if prompt is hidden from users
  const isPromptHidden = (promptName: string): boolean => {
    const normalizePromptKey = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
    const key = normalizePromptKey(promptName);
    const setting = promptSettings.find(s => normalizePromptKey(s.prompt_name) === key);
    return setting?.is_hidden || false;
  };

  // Helper to get saved label for a prompt
  const getPromptLabel = (promptName: string): string | undefined => {
    const normalizePromptKey = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
    const key = normalizePromptKey(promptName);
    const setting = promptSettings.find(s => normalizePromptKey(s.prompt_name) === key);
    return setting?.label ?? undefined;
  };

  // Helper to detect sheet inconsistencies in prompts
  // Returns the dominant sheet and which prompts are in different sheets
  const getSheetInconsistencies = (prompts: ProductPrompt[]): {
    dominantSheet: string | null;
    inconsistentPrompts: Set<string>;
  } => {
    // Don't apply validation if there are too few prompts
    if (prompts.length < 3) {
      return { dominantSheet: null, inconsistentPrompts: new Set() };
    }

    // Count sheets used by prompts
    const sheetCounts: Record<string, number> = {};
    prompts.forEach(p => {
      const sheet = p.promptSheet || "";
      if (sheet) {
        sheetCounts[sheet] = (sheetCounts[sheet] || 0) + 1;
      }
    });

    // Find the dominant sheet (most used)
    const sortedSheets = Object.entries(sheetCounts).sort((a, b) => b[1] - a[1]);
    if (sortedSheets.length === 0) {
      return { dominantSheet: null, inconsistentPrompts: new Set() };
    }

    const [dominantSheet, dominantCount] = sortedSheets[0];
    const totalWithSheet = prompts.filter(p => p.promptSheet).length;

    // Only flag if dominant sheet has 80%+ of prompts
    if (dominantCount / totalWithSheet < 0.8) {
      return { dominantSheet: null, inconsistentPrompts: new Set() };
    }

    // Find prompts in different sheets
    const inconsistentPrompts = new Set<string>();
    prompts.forEach(p => {
      if (p.promptSheet && p.promptSheet !== dominantSheet) {
        inconsistentPrompts.add(p.id);
      }
    });

    return { dominantSheet, inconsistentPrompts };
  };

  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL LOGIC
  // Queries para tipos de prompts y outputs
  const {
    data: promptTypes = []
  } = useQuery({
    queryKey: ["prompt-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");
      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts/types", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Error fetching prompt types");
      return response.json();
    },
    staleTime: 1000 * 60 * 30 // 30 minutes - types don't change often
  });
  const {
    data: outputTypes = []
  } = useQuery({
    queryKey: ["output-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");
      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs/types", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Error fetching output types");
      return response.json();
    },
    staleTime: 1000 * 60 * 30 // 30 minutes - types don't change often
  });

  // Queries para prompts y outputs del producto seleccionado
  const {
    data: productPrompts = [],
    refetch: refetchPrompts,
    isLoading: promptsLoading
  } = useQuery({
    queryKey: ["product-prompts", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");
      const {
        data,
        error
      } = await supabase.functions.invoke("easyquote-prompts", {
        body: {
          token,
          productId: selectedProduct.id
        }
      });
      if (error) {
        console.error("Error fetching prompts:", error);
        throw new Error("Error fetching product prompts");
      }
      return data;
    },
    enabled: !!selectedProduct?.id,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // Calculate sheet inconsistencies for current product prompts
  const sheetInconsistencies = useMemo(
    () => getSheetInconsistencies(productPrompts),
    [productPrompts]
  );

  const {
    data: productOutputs = [],
    refetch: refetchOutputs,
    isLoading: outputsLoading
  } = useQuery({
    queryKey: ["product-outputs", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");
      const {
        data,
        error
      } = await supabase.functions.invoke("easyquote-outputs", {
        body: {
          token,
          productId: selectedProduct.id
        }
      });
      if (error) {
        console.error("Error fetching outputs:", error);
        throw new Error("Error fetching product outputs");
      }

      // Return data as-is - the order comes from EasyQuote API
      // (orderSeq field is not returned by the API, order is controlled in EasyQuote admin)
      return data;
    },
    enabled: !!selectedProduct?.id,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // Estado local para el orden de outputs (drag & drop)
  const [localOutputOrder, setLocalOutputOrder] = useState<string[]>([]);
  const [orderInitializedForProduct, setOrderInitializedForProduct] = useState<string | null>(null);

  // Cargar orden guardado desde Supabase
  const {
    data: savedOutputOrder,
    isFetched: savedOrderFetched
  } = useQuery({
    queryKey: ["product-output-order", selectedProduct?.id, organizationId],
    queryFn: async () => {
      if (!selectedProduct?.id || !organizationId) return null;
      const {
        data,
        error
      } = await supabase.from("product_output_order").select("output_order").eq("organization_id", organizationId).eq("easyquote_product_id", selectedProduct.id).maybeSingle();
      if (error) {
        console.error("Error loading output order:", error);
        return null;
      }
      return data?.output_order || null;
    },
    enabled: !!selectedProduct?.id && !!organizationId,
    staleTime: 1000 * 60 * 5
  });

  // Mutation para guardar el orden en Supabase
  const saveOutputOrderMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      if (!selectedProduct?.id || !organizationId) {
        throw new Error("Missing product or organization");
      }
      const {
        error
      } = await supabase.from("product_output_order").upsert({
        organization_id: organizationId,
        easyquote_product_id: selectedProduct.id,
        output_order: newOrder,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "organization_id,easyquote_product_id"
      });
      if (error) throw error;
      return newOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-output-order", selectedProduct?.id, organizationId]
      });
      toast({
        title: "Orden guardado",
        description: "El orden de outputs se ha guardado."
      });
    },
    onError: error => {
      console.error("Error saving output order:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el orden",
        variant: "destructive"
      });
    }
  });

  // Reset cuando cambia el producto seleccionado
  useEffect(() => {
    setLocalOutputOrder([]);
    setOrderInitializedForProduct(null);
  }, [selectedProduct?.id]);

  // Sincronizar orden local - espera a que llegue la consulta de Supabase
  useEffect(() => {
    // Solo procesar si tenemos outputs y la consulta de orden guardado ha terminado
    if (productOutputs.length === 0 || !savedOrderFetched) return;

    // (Antes se inicializaba una sola vez por producto; ahora recalculamos el orden visual
    // siempre que cambien los outputs para mantenerlo consistente por celda.)

    // NOTA: Para que el orden aquí coincida con las páginas de prueba/presupuestos/pedidos,
    // mostramos SIEMPRE los outputs ordenados por celda (columna, luego fila),
    // independientemente de si hay un orden guardado.
    // (El orden guardado sigue existiendo en BD, pero no gobierna el orden visual de esta lista.)
    // Si no hay orden guardado, usar orden basado en celda (columna, luego fila) - mismo orden que ProductTestPage
    const colToNumber = (col: string) => {
      return col.toUpperCase().split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
    };
    const parseCellRef = (cell?: string | null) => {
      const raw = (cell ?? "").replace(/\$/g, "").trim().toUpperCase();
      const match = raw.match(/^([A-Za-z]+)(\d+)$/);
      if (!match) return null;
      return {
        col: colToNumber(match[1]),
        row: Number.parseInt(match[2], 10)
      };
    };
    const sorted = [...productOutputs].sort((a, b) => {
      const cellA = parseCellRef(a.nameCell) ?? parseCellRef(a.valueCell);
      const cellB = parseCellRef(b.nameCell) ?? parseCellRef(b.valueCell);
      if (cellA && !cellB) return -1;
      if (!cellA && cellB) return 1;
      if (cellA && cellB) {
        // Ordenar primero por columna, luego por fila (igual que ProductTestPage)
        if (cellA.col !== cellB.col) return cellA.col - cellB.col;
        if (cellA.row !== cellB.row) return cellA.row - cellB.row;
      }
      return (a.id || "").localeCompare(b.id || "");
    });
    setLocalOutputOrder(sorted.map(o => o.id));
    // Nota: localOutputOrder usa IDs internamente, pero guardamos por name en Supabase
  }, [productOutputs, savedOrderFetched]);

  // Outputs ordenados según el orden local (drag & drop)
  const orderedProductOutputs = useMemo(() => {
    if (localOutputOrder.length === 0) return productOutputs;
    const outputMap = new Map(productOutputs.map(o => [o.id, o]));
    const ordered: typeof productOutputs = [];

    // Añadir outputs en el orden guardado
    for (const id of localOutputOrder) {
      const output = outputMap.get(id);
      if (output) {
        ordered.push(output);
        outputMap.delete(id);
      }
    }

    // Añadir cualquier output nuevo que no estaba en el orden local
    for (const output of outputMap.values()) {
      ordered.push(output);
    }
    return ordered;
  }, [productOutputs, localOutputOrder]);

  // Sensores para drag & drop
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));

  // Handler para drag end - guarda en Supabase (por nameCell)
  const handleDragEnd = (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    if (over && active.id !== over.id) {
      setLocalOutputOrder(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Convertir IDs a nameCells para guardar en Supabase (normalizados)
        const normalizeKey = (v: any) => String(v ?? "").replace(/\$/g, "").trim();
        const outputById = new Map<string, ProductOutput>(productOutputs.map(o => [o.id, o]));
        const orderByName = newOrder.map(id => outputById.get(id)?.nameCell).filter((name): name is string => !!name).map(name => normalizeKey(name));

        // Guardar el nuevo orden en Supabase
        saveOutputOrderMutation.mutate(orderByName);
        return newOrder;
      });
    }
  };

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
      return text ? JSON.parse(text) : {
        success: true
      };
    },
    onSuccess: () => {
      toast({
        title: "Prompt añadido",
        description: "El nuevo prompt se ha creado correctamente."
      });
      refetchPrompts();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al crear el prompt",
        variant: "destructive"
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
      return text ? JSON.parse(text) : {
        success: true
      };
    },
    onSuccess: () => {
      toast({
        title: "Output añadido",
        description: "El nuevo output se ha creado correctamente."
      });
      refetchOutputs();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al crear el output",
        variant: "destructive"
      });
    }
  });
  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");
      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/prompts/${promptId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Error deleting prompt");
    },
    onSuccess: () => {
      toast({
        title: "Prompt eliminado",
        description: "El prompt se ha eliminado correctamente."
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
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Error deleting output");
    },
    onSuccess: () => {
      toast({
        title: "Output eliminado",
        description: "El output se ha eliminado correctamente."
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
      return {
        success: true
      };
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
      return {
        success: true,
        updatedOutput
      };
    },
    onSuccess: (_, updatedOutput) => {
      // Update cache locally to preserve order - DO NOT refetch as API doesn't return orderSeq
      queryClient.setQueryData(["product-outputs", selectedProduct?.id], (oldData: ProductOutput[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(o => o.id === updatedOutput.id ? {
          ...o,
          ...updatedOutput
        } : o);
      });
    }
  });

  // Fetch products from EasyQuote API
  const {
    data: products = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["easyquote-products", includeInactive],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
      }
      console.log("ProductManagement: Fetching products", {
        includeInactive
      });
      const {
        data,
        error
      } = await invokeEasyQuoteFunction("easyquote-products", {
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
  const {
    data: allProductsForStats = []
  } = useQuery({
    queryKey: ["easyquote-products-stats"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) return [];
      const {
        data,
        error
      } = await invokeEasyQuoteFunction("easyquote-products", {
        token,
        includeInactive: true
      });
      if (error || !data) return [];
      return data as EasyQuoteProduct[];
    },
    enabled: !!hasToken,
    retry: false
  });

  // Todos los productos vienen de EasyQuote (ya no hay productos locales comp_*)
  const allProducts = products;

  // Filtrar productos localmente
  const filteredProducts = allProducts.filter(product => {
    // Filtrar por vista: productos vs componentes (nunca se mezclan)
    const isProductComponent = componentProductIds.has(product.id);
    if (viewMode === 'productos' && isProductComponent) return false;
    if (viewMode === 'componentes' && !isProductComponent) return false;

    const matchesSearch = !searchTerm || product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) || product.description?.toLowerCase().includes(searchTerm.toLowerCase()) || product.id?.toLowerCase().includes(searchTerm.toLowerCase());

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
  const availableSubcategories = allSubcategories.filter(sub => sub.is_active && (categoryFilter === "all" || sub.category_id === categoryFilter));

  // Estadísticas - filtrar según la vista actual (productos vs componentes)
  const statsProducts = allProductsForStats.filter(p => {
    const isProductComponent = componentProductIds.has(p.id);
    if (viewMode === 'productos') return !isProductComponent;
    return isProductComponent;
  });
  const activeProducts = statsProducts.filter(p => p.isActive);
  const inactiveProducts = statsProducts.filter(p => !p.isActive);
  const handleEditProduct = async (product: EasyQuoteProduct) => {
    console.log("=== handleEditProduct called ===");
    console.log("Product ID:", product.id);
    console.log("Product Name:", product.productName);
    console.log("Excel File ID:", product.excelfileId);
    setSelectedProduct({
      ...product
    });

    // Cargar categoría actual del producto
    const mapping = getProductMapping(product.id);
    setSelectedCategoryId(mapping?.category_id || "");
    setSelectedSubcategoryId(mapping?.subcategory_id || "");
    const token = sessionStorage.getItem("easyquote_token");

    // Fetch all available Excel files
    if (token) {
      try {
        const {
          data: allFiles,
          error: filesError
        } = await supabase.functions.invoke("easyquote-excel-files", {
          body: {
            token
          }
        });
        if (!filesError && Array.isArray(allFiles)) {
          setAvailableExcelFiles(allFiles.filter((f: EasyQuoteExcelFile) => f.isActive));
        } else {
          setAvailableExcelFiles([]);
        }
      } catch (error) {
        console.error("Error fetching Excel files:", error);
        setAvailableExcelFiles([]);
      }
    }

    // Fetch Excel sheets if excelfileId exists
    if (product.excelfileId) {
      console.log("Excel File ID exists, fetching sheets...");
      try {
        console.log("Token found:", token ? "YES" : "NO");
        if (token) {
          console.log("Calling easyquote-excel-files edge function with fileId:", product.excelfileId);
          const {
            data,
            error
          } = await supabase.functions.invoke("easyquote-excel-files", {
            body: {
              token,
              fileId: product.excelfileId
            }
          });
          console.log("Edge function response:", {
            data,
            error
          });
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

  // Track if we're waiting for a product to appear after refetch
  const [pendingEditProductId, setPendingEditProductId] = useState<string | null>(null);

  // Auto-open edit dialog if editProduct parameter is present
  useEffect(() => {
    const editProductId = searchParams.get('editProduct');
    if (!editProductId) {
      setPendingEditProductId(null);
      return;
    }

    // Si los productos ya están cargados, buscar y abrir
    if (products.length > 0 || !isLoading) {
      const productToEdit = products.find(p => p.id === editProductId);
      if (productToEdit) {
        handleEditProduct(productToEdit);
        // Remove the parameter from URL to avoid reopening on refresh
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('editProduct');
        setSearchParams(newSearchParams, {
          replace: true
        });
        setPendingEditProductId(null);
      } else if (!pendingEditProductId) {
        // Producto no encontrado en la lista actual, refrescar la lista
        // (puede ser un producto recién creado)
        console.log("Product not found, refetching products list...", editProductId);
        setPendingEditProductId(editProductId);
        refetch();
      }
    }
  }, [products, searchParams, setSearchParams, refetch, isLoading, pendingEditProductId]);

  // Mutation para actualizar producto
  const updateProductMutation = useMutation({
    mutationFn: async ({
      product,
      action,
      closeDialog = true
    }: {
      product: EasyQuoteProduct;
      action?: 'delete' | 'update';
      closeDialog?: boolean;
    }) => {
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
      const {
        data,
        error
      } = await invokeEasyQuoteFunction("easyquote-update-product", {
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
      return {
        data,
        closeDialog
      };
    },
    onSuccess: ({
      closeDialog
    }) => {
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado correctamente."
      });
      queryClient.invalidateQueries({
        queryKey: ["easyquote-products"]
      });
      if (closeDialog) {
        setIsEditDialogOpen(false);
        setSelectedProduct(null);
        setPromptLabelDrafts({});
        setOutputLabelDrafts({});
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const handleSaveProduct = async () => {
    if (!selectedProduct) return;

    // 1) Guardar categoría en Supabase (no bloqueante)
    if (selectedCategoryId || selectedSubcategoryId) {
      upsertCategoryMapping.mutate({
        easyquote_product_id: selectedProduct.id,
        product_name: selectedProduct.productName,
        category_id: selectedCategoryId || undefined,
        subcategory_id: selectedSubcategoryId || undefined,
      });
    }

    // 2) Guardar labels pendientes ANTES de cerrar el diálogo (evita estados inconsistentes)
    const labelsToSave = Object.entries(promptLabelDrafts);
    for (const [promptName, label] of labelsToSave) {
      await upsertPromptSettingMutation.mutateAsync({
        productId: selectedProduct.id,
        promptName,
        label,
      });
    }
    if (labelsToSave.length > 0) setPromptLabelDrafts({});

    const outputLabelsToSave = Object.entries(outputLabelDrafts);
    for (const [outputName, label] of outputLabelsToSave) {
      await upsertPromptSettingMutation.mutateAsync({
        productId: selectedProduct.id,
        promptName: outputName,
        label,
      });
    }
    if (outputLabelsToSave.length > 0) setOutputLabelDrafts({});

    // 3) Mostrar toast consolidado si hubo etiquetas guardadas
    const totalLabelsSaved = labelsToSave.length + outputLabelsToSave.length;
    if (totalLabelsSaved > 0) {
      toast({
        title: "Etiquetas guardadas",
        description: `Se han guardado ${totalLabelsSaved} etiqueta${totalLabelsSaved !== 1 ? 's' : ''} correctamente.`,
      });
    }

    // 4) Finalmente actualizar el producto en EasyQuote
    const action = selectedProduct.isActive ? "update" : "delete";
    updateProductMutation.mutate({
      product: selectedProduct,
      action,
    });
  };
  const handleDeleteProduct = () => {
    if (selectedProduct) {
      updateProductMutation.mutate({
        product: {
          ...selectedProduct,
          isActive: false
        },
        action: 'delete'
      });
      setIsDeleteProductDialogOpen(false);
    }
  };

  // Mutation para duplicar producto (completo con prompts y outputs)
  const duplicateProductMutation = useMutation({
    mutationFn: async (sourceProduct: EasyQuoteProduct) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No hay token de EasyQuote disponible");

      // 0. Obtener organization_id del usuario actual
      const orgId = await getCurrentOrganizationIdAsync();
      if (!orgId) throw new Error("No se pudo obtener la organización del usuario");

      // 1. Obtener prompts del producto original
      const {
        data: sourcePrompts
      } = await supabase.functions.invoke("easyquote-prompts", {
        body: {
          token,
          productId: sourceProduct.id
        }
      });

      // 2. Obtener outputs del producto original
      const {
        data: sourceOutputs
      } = await supabase.functions.invoke("easyquote-outputs", {
        body: {
          token,
          productId: sourceProduct.id
        }
      });

      // 3. Obtener configuración de componentes del producto original (Supabase) - por api_user_id
      const {
        data: sourceComponentSettings
      } = await supabase.from('product_component_settings').select('*').eq('api_user_id', apiUserId).eq('easyquote_product_id', sourceProduct.id).maybeSingle();

      // 4. Obtener asignaciones de prompts a componentes del producto original (Supabase) - por api_user_id
      const {
        data: sourcePromptComponents
      } = await supabase.from('product_prompt_components').select('*').eq('api_user_id', apiUserId).eq('easyquote_product_id', sourceProduct.id);

      // 5. Obtener orden de outputs del producto original (Supabase)
      const {
        data: sourceOutputOrder
      } = await supabase.from('product_output_order').select('*').eq('organization_id', orgId).eq('easyquote_product_id', sourceProduct.id).maybeSingle();

      // 6. Crear nuevo producto con el mismo excelfileId
      const response = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: `Copia de ${sourceProduct.productName}`,
          excelfileId: sourceProduct.excelfileId,
          currency: sourceProduct.currency || "EUR",
          isActive: true
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al crear producto: ${errorText}`);
      }
      const responseText = await response.text();
      let newProductId: string;
      try {
        newProductId = JSON.parse(responseText);
      } catch {
        newProductId = responseText.replace(/['"]/g, '').trim();
      }

      // 7. Duplicar prompts al nuevo producto (EasyQuote API)
      const promptsArray = Array.isArray(sourcePrompts) ? sourcePrompts : [];
      for (const prompt of promptsArray) {
        const newPrompt = {
          productId: newProductId,
          promptSeq: prompt.promptSeq,
          promptType: prompt.promptType,
          promptSheet: prompt.promptSheet,
          promptCell: prompt.promptCell,
          valueSheet: prompt.valueSheet,
          valueCell: prompt.valueCell,
          valueOptionSheet: prompt.valueOptionSheet,
          valueOptionRange: prompt.valueOptionRange,
          valueRequired: prompt.valueRequired,
          valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals,
          valueQuantityMin: prompt.valueQuantityMin,
          valueQuantityMax: prompt.valueQuantityMax,
          tooltipValueSheet: prompt.tooltipValueSheet,
          tooltipValueCell: prompt.tooltipValueCell,
          valueOptionLabelRange: prompt.valueOptionLabelRange
        };
        await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(newPrompt)
        });
      }

      // 8. Duplicar outputs al nuevo producto (EasyQuote API)
      const outputsArray = Array.isArray(sourceOutputs) ? sourceOutputs : [];
      for (const output of outputsArray) {
        const newOutput = {
          productId: newProductId,
          outputTypeId: output.outputTypeId,
          sheet: output.sheet,
          nameCell: output.nameCell,
          valueCell: output.valueCell
        };
        await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(newOutput)
        });
      }

      // 9. Copiar configuración de componentes (is_composite, enabled_components) a Supabase
      if (sourceComponentSettings) {
        // Get api_user_id for the organization
        const { data: orgData } = await supabase
          .from('organizations')
          .select('api_user_id')
          .eq('id', orgId)
          .single();
        
        const targetApiUserId = orgData?.api_user_id;
        
        if (targetApiUserId) {
          await supabase.from('product_component_settings').upsert({
            organization_id: orgId,
            api_user_id: targetApiUserId,
            easyquote_product_id: newProductId,
            is_composite: sourceComponentSettings.is_composite,
            enabled_components: sourceComponentSettings.enabled_components,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'api_user_id,easyquote_product_id'
          });
        }
      }

      // 10. Copiar asignaciones de prompts a componentes a Supabase
      if (sourcePromptComponents && sourcePromptComponents.length > 0) {
        // Get api_user_id for the organization (reuse if already fetched)
        const { data: orgData } = await supabase
          .from('organizations')
          .select('api_user_id')
          .eq('id', orgId)
          .single();
        
        const targetApiUserId = orgData?.api_user_id;
        
        if (targetApiUserId) {
          const newPromptComponents = sourcePromptComponents.map((pc: any) => ({
            organization_id: orgId,
            api_user_id: targetApiUserId,
            easyquote_product_id: newProductId,
            prompt_name: pc.prompt_name,
            component: pc.component,
            updated_at: new Date().toISOString()
          }));
          await supabase.from('product_prompt_components').upsert(newPromptComponents, {
            onConflict: 'api_user_id,easyquote_product_id,prompt_name'
          });
        }
      }

      // 11. Copiar orden de outputs a Supabase
      if (sourceOutputOrder && sourceOutputOrder.output_order?.length > 0) {
        await supabase.from('product_output_order').upsert({
          organization_id: orgId,
          easyquote_product_id: newProductId,
          output_order: sourceOutputOrder.output_order,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,easyquote_product_id'
        });
        }

      // 12. Copiar product_prompt_settings (etiquetas, visibilidad, force_result, is_hidden, admin_only)
      {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('api_user_id')
          .eq('id', orgId)
          .single();
        const targetApiUserId = orgData?.api_user_id;
        if (targetApiUserId) {
          const { data: sourceSettings } = await supabase
            .from('product_prompt_settings')
            .select('*')
            .eq('api_user_id', targetApiUserId)
            .eq('easyquote_product_id', sourceProduct.id);

          if (sourceSettings && sourceSettings.length > 0) {
            const newSettings = sourceSettings.map((s: any) => ({
              api_user_id: targetApiUserId,
              organization_id: s.organization_id,
              easyquote_product_id: newProductId,
              prompt_name: s.prompt_name,
              label: s.label,
              hide_in_documents: s.hide_in_documents,
              admin_only: s.admin_only,
              force_result: s.force_result,
              is_hidden: s.is_hidden,
              updated_at: new Date().toISOString(),
            }));
            await supabase.from('product_prompt_settings').insert(newSettings);
          }
        }
      }

      // 13. Copiar product_category_mappings (categoría asignada)
      {
        const { data: sourceMapping } = await supabase
          .from('product_category_mappings')
          .select('*')
          .eq('easyquote_product_id', sourceProduct.id)
          .maybeSingle();

        if (sourceMapping) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('product_category_mappings').insert({
            easyquote_product_id: newProductId,
            product_name: `Copia de ${sourceMapping.product_name}`,
            category_id: sourceMapping.category_id,
            subcategory_id: sourceMapping.subcategory_id,
            user_id: user?.id || sourceMapping.user_id,
          });
        }
      }

      // 14. Copiar configuración de producto compuesto (si aplica)
      {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('api_user_id')
          .eq('id', orgId)
          .single();
        const targetApiUserId = orgData?.api_user_id;
        if (targetApiUserId) {
          // composite_product_prompts
          const { data: srcPrompts } = await supabase
            .from('composite_product_prompts')
            .select('*')
            .eq('api_user_id', targetApiUserId)
            .eq('easyquote_product_id', sourceProduct.id);
          if (srcPrompts && srcPrompts.length > 0) {
            const rows = srcPrompts.map((p: any) => ({
              api_user_id: targetApiUserId,
              organization_id: p.organization_id,
              easyquote_product_id: newProductId,
              name: p.name,
              label: p.label,
              type: p.type,
              default_value: p.default_value,
              options: p.options,
              is_required: p.is_required,
              is_hidden: p.is_hidden,
              display_order: p.display_order,
            }));
            await supabase.from('composite_product_prompts').insert(rows);
          }

          // composite_product_outputs
          const { data: srcOutputs } = await supabase
            .from('composite_product_outputs')
            .select('*')
            .eq('api_user_id', targetApiUserId)
            .eq('easyquote_product_id', sourceProduct.id);
          if (srcOutputs && srcOutputs.length > 0) {
            const rows = srcOutputs.map((o: any) => ({
              api_user_id: targetApiUserId,
              organization_id: o.organization_id,
              easyquote_product_id: newProductId,
              name: o.name,
              label: o.label,
              type: o.type,
              formula: o.formula,
              display_order: o.display_order,
            }));
            await supabase.from('composite_product_outputs').insert(rows);
          }

          // composite_product_components
          const { data: srcComponents } = await supabase
            .from('composite_product_components')
            .select('*')
            .eq('api_user_id', targetApiUserId)
            .eq('composite_product_id', sourceProduct.id);
          if (srcComponents && srcComponents.length > 0) {
            const rows = srcComponents.map((c: any) => ({
              api_user_id: targetApiUserId,
              organization_id: c.organization_id,
              composite_product_id: newProductId,
              component_product_id: c.component_product_id,
              component_alias: c.component_alias,
              is_optional: c.is_optional,
              display_order: c.display_order,
            }));
            await supabase.from('composite_product_components').insert(rows);
          }

          // composite_prompt_connections
          const { data: srcConnections } = await supabase
            .from('composite_prompt_connections')
            .select('*')
            .eq('api_user_id', targetApiUserId)
            .eq('composite_product_id', sourceProduct.id);
          if (srcConnections && srcConnections.length > 0) {
            const rows = srcConnections.map((c: any) => ({
              api_user_id: targetApiUserId,
              organization_id: c.organization_id,
              composite_product_id: newProductId,
              source_prompt_name: c.source_prompt_name,
              target_component_id: c.target_component_id,
              target_prompt_name: c.target_prompt_name,
              transform_formula: c.transform_formula,
            }));
            await supabase.from('composite_prompt_connections').insert(rows);
          }

          // composite_output_aggregations
          const { data: srcAggs } = await supabase
            .from('composite_output_aggregations')
            .select('*')
            .eq('api_user_id', targetApiUserId)
            .eq('composite_product_id', sourceProduct.id);
          if (srcAggs && srcAggs.length > 0) {
            const rows = srcAggs.map((a: any) => ({
              api_user_id: targetApiUserId,
              organization_id: a.organization_id,
              composite_product_id: newProductId,
              source_output_name: a.source_output_name,
              target_output_name: a.target_output_name,
              target_output_label: a.target_output_label,
              aggregation_type: a.aggregation_type,
            }));
            await supabase.from('composite_output_aggregations').insert(rows);
          }
        }
      }

      return newProductId;
    },
    onSuccess: newProductId => {
      toast({
        title: "Producto duplicado",
        description: "El producto se ha duplicado correctamente con todos sus prompts y outputs."
      });
      queryClient.invalidateQueries({
        queryKey: ["easyquote-products"]
      });
      navigate(`/admin/productos?editProduct=${newProductId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const handleDuplicateProduct = (product: EasyQuoteProduct) => {
    if (!product.excelfileId) {
      toast({
        title: "Error",
        description: "Este producto no tiene un archivo Excel asociado y no puede ser duplicado.",
        variant: "destructive"
      });
      return;
    }
    duplicateProductMutation.mutate(product);
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
      const usedRows = productPrompts.map(p => {
        const promptMatch = p.promptCell?.match(/(\d+)/);
        const valueMatch = p.valueCell?.match(/(\d+)/);
        return [promptMatch ? parseInt(promptMatch[1]) : 0, valueMatch ? parseInt(valueMatch[1]) : 0];
      }).flat().filter(row => row > 0);
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
      valueQuantityMin: 0,
      valueQuantityMax: 9999,
      promptSeq: nextSeq,
      component: "general"
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

    // IMPORTANTE: Usar la misma hoja para los 3 campos (promptSheet, valueSheet, valueOptionSheet)
    // El sistema antiguo de EasyQuote usa una sola variable selectedSheet para los 3
    const sheetToUse = newPromptData.promptSheet;
    const newPrompt = {
      productId: selectedProduct.id,
      promptSeq: newPromptData.promptSeq,
      promptType: newPromptData.promptType,
      promptSheet: sheetToUse,
      promptCell: newPromptData.promptCell,
      valueSheet: sheetToUse,
      // Siempre igual a promptSheet
      valueCell: newPromptData.valueCell,
      valueOptionSheet: sheetToUse,
      // Siempre igual a promptSheet
      valueOptionRange: newPromptData.valueOptionRange,
      valueRequired: newPromptData.valueRequired,
      // Solo incluir estos campos si el tipo es numérico con valores por defecto
      valueQuantityAllowedDecimals: isNumericType ? newPromptData.valueQuantityAllowedDecimals ?? 0 : null,
      valueQuantityMin: isNumericType ? newPromptData.valueQuantityMin ?? 0 : null,
      valueQuantityMax: isNumericType ? newPromptData.valueQuantityMax ?? 9999 : null
    };
    createPromptMutation.mutate(newPrompt, {
      onSuccess: () => {
        // Si el producto es compuesto y se asignó un componente, guardarlo.
        // Usamos SIEMPRE el promptCell introducido (la API a veces no lo devuelve en la respuesta).
        const promptKey = String(newPromptData.promptCell ?? "").replace(/\$/g, "").trim().toUpperCase();
        if (isComposite && newPromptData.component && newPromptData.component !== "general" && promptKey) {
          assignPromptToComponent({
            easyquote_product_id: selectedProduct.id,
            prompt_name: promptKey,
            component: newPromptData.component
          });
        }
      }
    });
    setIsNewPromptDialogOpen(false);
    // Reset component to general for next prompt
    setNewPromptData(prev => ({
      ...prev,
      component: "general"
    }));
  };

  // Add new output
  const addNewOutput = () => {
    if (!selectedProduct || !outputTypes.length) return;

    // Calculate next sequence number
    const nextSeq = productOutputs.length === 0 ? 1 : Math.max(...productOutputs.map(o => o.orderSeq || 0)) + 1;

    // Calculate next row based on existing cells
    const getNextRow = () => {
      if (productOutputs.length === 0) return 25;
      const usedRows = productOutputs.map(output => {
        const nameMatch = output.nameCell?.match(/(\d+)/);
        const valueMatch = output.valueCell?.match(/(\d+)/);
        return [nameMatch ? parseInt(nameMatch[1]) : 0, valueMatch ? parseInt(valueMatch[1]) : 0];
      }).flat().filter(row => row > 0);
      const maxRow = usedRows.length > 0 ? Math.max(...usedRows) : 24;
      return maxRow + 1;
    };
    const nextRow = getNextRow();

    // Reset form data and open dialog
    const preferredDatos = excelSheets.find(s => String(s).toLowerCase().trim() === "datos");
    const defaultSheet = newOutputData.sheet || preferredDatos || excelSheets[0] || "";
    const defaultComponent = isComposite ? newOutputData.component || "general" : "general";
    setNewOutputData({
      sheet: defaultSheet,
      prompt: "",
      defaultValue: "",
      outputTypeId: outputTypes[0]?.id || 0,
      component: defaultComponent
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
    createOutputMutation.mutate(newOutput, {
      onSuccess: () => {
        // Si el producto es compuesto y se asignó un componente, guardarlo
        if (isComposite && newOutputData.component && newOutputData.prompt) {
          assignPromptToComponent({
            easyquote_product_id: selectedProduct.id,
            prompt_name: newOutputData.prompt,
            component: newOutputData.component
          });
        }
      }
    });
    setIsNewOutputDialogOpen(false);
    // Mantener hoja y componente para facilitar crear varios outputs seguidos
    setNewOutputData(prev => ({
      ...prev,
      prompt: "",
      defaultValue: ""
    }));
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
          valueSheet: promptData.sheet,
          // Same sheet
          valueCell: promptData.valueCell,
          valueOptionSheet: promptData.sheet,
          // Same sheet
          valueOptionRange: promptData.valueOptionRange,
          valueRequired: promptData.valueRequired,
          // Solo incluir estos campos si el tipo es numérico con valores por defecto
          valueQuantityAllowedDecimals: isNumericType ? promptData.valueQuantityAllowedDecimals ?? 0 : null,
          valueQuantityMin: isNumericType ? promptData.valueQuantityMin ?? 1 : null,
          valueQuantityMax: isNumericType ? promptData.valueQuantityMax ?? 9999 : null
        };
        const result = await createPromptMutation.mutateAsync(newPrompt);

        // Asignar componente si es producto compuesto
        // Usamos el promptCell de entrada; la respuesta de la API puede no incluirlo.
        const createdPromptKey = String(promptData.promptCell ?? result?.promptCell ?? "").replace(/\$/g, "").trim().toUpperCase();
        if (isComposite && promptData.component && promptData.component !== "general" && createdPromptKey) {
          await assignPromptToComponent({
            easyquote_product_id: selectedProduct.id,
            prompt_name: createdPromptKey,
            component: promptData.component
          });
        }

        // Guardar configuración de ocultar en documentos (usando api_user_id)
        if (promptData.hideInDocuments && createdPromptKey && apiUserId) {
          await supabase.from("product_prompt_settings").upsert({
            api_user_id: apiUserId,
            organization_id: organizationId,
            easyquote_product_id: selectedProduct.id,
            prompt_name: createdPromptKey,
            hide_in_documents: true,
          }, {
            onConflict: "api_user_id,easyquote_product_id,prompt_name"
          });
        }
      }

      // Refrescar queries para mostrar los cambios en la UI
      await refetchPromptSettings();
      queryClient.invalidateQueries({
        queryKey: ['product-prompt-components', selectedProduct.id]
      });
      setIsBulkPromptsDialogOpen(false);
      toast({
        title: "Éxito",
        description: `Se crearon ${prompts.length} datos de entrada correctamente.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear los datos de entrada",
        variant: "destructive"
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
        const result = await createOutputMutation.mutateAsync(newOutput);

        // Asignar componente si es producto compuesto
        // Usamos el nameCell de entrada; la respuesta de la API puede no incluirlo.
        const createdOutputKey = String(outputData.nameCell ?? result?.nameCell ?? "").replace(/\$/g, "").trim().toUpperCase();
        if (isComposite && outputData.component && outputData.component !== "general" && createdOutputKey) {
          await assignPromptToComponent({
            easyquote_product_id: selectedProduct.id,
            prompt_name: createdOutputKey,
            component: outputData.component
          });
        }
      }
      setIsBulkOutputsDialogOpen(false);
      toast({
        title: "Éxito",
        description: `Se crearon ${outputs.length} datos de salida correctamente.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear los datos de salida",
        variant: "destructive"
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
    return <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden ver productos.
          </AlertDescription>
        </Alert>
      </div>;
  }
  if (!hasToken) {
    return <div className="container mx-auto py-10">
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
      </div>;
  }
  if (error) {
    return <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>No se pudieron cargar los productos de EasyQuote.</p>
            {error.message && <p className="text-sm">{error.message}</p>}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>;
  }
  return <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold">Productos EasyQuote</h1>
          <p className="text-muted-foreground mt-1 lg:mt-2 text-sm">
            Catálogo de productos del API de EasyQuote para presupuestos
          </p>
        </div>
        <div className="flex-shrink-0 flex gap-2">
          <ExcelErrorScannerDialog />
          <Button onClick={() => navigate("/admin/productos/nuevo")} className="flex items-center gap-2 w-full sm:w-auto" size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Crear {viewMode === 'productos' ? 'producto' : 'componente'}</span>
            <span className="sm:hidden">Crear</span>
          </Button>
          <Button onClick={() => navigate(`/admin/productos/test?view=${viewMode}`)} variant="outline" className="flex items-center gap-2 w-full sm:w-auto" size="sm">
            <TestTube className="h-4 w-4" />
            <span className="hidden sm:inline">Probar {viewMode === 'productos' ? 'productos' : 'componentes'}</span>
            <span className="sm:hidden">Probar</span>
          </Button>
        </div>
      </div>

      {/* Tabs: Productos / Componentes */}
      <div className="flex items-center gap-2">
        <Button 
          variant={viewMode === 'productos' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setViewMode('productos')}
          className="flex items-center gap-2"
        >
          <Package className="h-4 w-4" />
          Productos
        </Button>
        <Button 
          variant={viewMode === 'componentes' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setViewMode('componentes')}
          className="flex items-center gap-2"
        >
          <Boxes className="h-4 w-4" />
          Componentes
        </Button>
      </div>

      <Separator />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busca y filtra {viewMode === 'productos' ? 'productos' : 'componentes'} por diferentes criterios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4 items-end">
            {/* Búsqueda */}
            <div className="lg:col-span-2">
              <Label htmlFor="search" className="text-sm">Buscar {viewMode === 'productos' ? 'productos' : 'componentes'}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="search" placeholder={`Buscar por nombre, ID o descripción...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
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
                  {availableCategories.map(category => <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{
                      backgroundColor: category.color
                    }} />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {/* Incluir inactivos */}
            <div className="flex items-center space-x-2 pt-6">
              <Switch id="include-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
              <Label htmlFor="include-inactive" className="text-sm">Incluir inactivos</Label>
            </div>
          </div>
          
          {/* Filtro por subcategoría - línea separada solo si hay categoría seleccionada */}
          {categoryFilter !== "all" && categoryFilter !== "uncategorized" && availableSubcategories.length > 0 && <div className="mt-4">
              <Label className="text-sm">Subcategoría</Label>
              <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Todas las subcategorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las subcategorías</SelectItem>
                  <SelectItem value="no-subcategory">Sin subcategoría</SelectItem>
                  {availableSubcategories.map(subcategory => <SelectItem key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>}
        </CardContent>
      </Card>

      {/* Products Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xs lg:text-sm font-medium">
              Total {viewMode === 'productos' ? 'productos' : 'componentes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <div className="text-lg lg:text-2xl font-bold">{statsProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xs lg:text-sm font-medium">
              {viewMode === 'productos' ? 'Productos' : 'Componentes'} activos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <div className="text-lg lg:text-2xl font-bold text-green-600">{activeProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xs lg:text-sm font-medium">
              {viewMode === 'productos' ? 'Productos' : 'Componentes'} inactivos
            </CardTitle>
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
              <CardTitle>{viewMode === 'productos' ? 'Productos' : 'Componentes'}</CardTitle>
              <CardDescription>
                {viewMode === 'productos' 
                  ? 'Lista de productos para presupuestos y pedidos' 
                  : 'Componentes para usar dentro de productos compuestos'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 lg:p-6">
          {isLoading ? <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando productos desde EasyQuote...</p>
            </div> : filteredProducts.length === 0 ? <div className="text-center py-8">
              {viewMode === 'productos' 
                ? <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                : <Boxes className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              }
              <p className="text-muted-foreground">
                {viewMode === 'productos'
                  ? (products.length === 0 ? "No hay productos en EasyQuote" : "No hay productos que coincidan con los filtros")
                  : "No hay componentes configurados"
                }
              </p>
              {viewMode === 'componentes' && (
                <p className="text-sm text-muted-foreground mt-2">
                  Marca productos como componentes desde la vista "Productos"
                </p>
              )}
              {viewMode === 'productos' && (searchTerm || categoryFilter !== "all" || subcategoryFilter !== "all") ? <Button variant="outline" size="sm" onClick={() => {
            setSearchTerm("");
            setCategoryFilter("all");
            setSubcategoryFilter("all");
          }} className="mt-2">
                  Limpiar filtros
                </Button> : null}
            </div> : <ProductTable 
              products={filteredProducts} 
              getProductMapping={getProductMapping} 
              onEditProduct={handleEditProduct} 
              onDuplicateProduct={handleDuplicateProduct}
              componentProductIds={componentProductIds}
              compositeProductIds={compositeProductIds}
              onToggleComponent={(productId, isComponent) => toggleComponentMutation.mutate({ productId, isComponent })}
              isTogglingComponent={toggleComponentMutation.isPending}
              viewMode={viewMode}
            />}
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
          
          {selectedProduct && <div>
            <Tabs defaultValue="general" className="w-full">
              {/* Todos los tipos de producto muestran General + Datos de entrada + Datos de salida */}
              <TabsList className={`grid w-full ${productType === 'sencillo' ? 'grid-cols-3' : 'grid-cols-4'}`}>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="prompts">Datos de entrada ({productPrompts.length})</TabsTrigger>
                <TabsTrigger value="outputs">Datos de salida ({productOutputs.length})</TabsTrigger>
                {productType === 'compuesto' && (
                  <TabsTrigger value="composite-config">Componentes</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="productName">Nombre del producto</Label>
                    <Input id="productName" value={selectedProduct.productName} onChange={e => setSelectedProduct({
                    ...selectedProduct,
                    productName: e.target.value
                  })} />
                  </div>
                  <div>
                    <Label htmlFor="excelFile">Archivo Excel (Calculadora)</Label>
                    <Select value={selectedProduct.excelfileId || "none"} onValueChange={async value => {
                    const newExcelId = value === "none" ? undefined : value;
                    setSelectedProduct({
                      ...selectedProduct,
                      excelfileId: newExcelId
                    });

                    // Recargar hojas del nuevo Excel
                    if (newExcelId) {
                      const token = sessionStorage.getItem("easyquote_token");
                      if (token) {
                        try {
                          const {
                            data,
                            error
                          } = await supabase.functions.invoke("easyquote-excel-files", {
                            body: {
                              token,
                              fileId: newExcelId
                            }
                          });
                          if (!error && data?.excelfilesSheets) {
                            const sheetNames = data.excelfilesSheets.map((sheet: any) => sheet.sheetName).sort();
                            setExcelSheets(sheetNames);
                          } else {
                            setExcelSheets([]);
                          }
                        } catch {
                          setExcelSheets([]);
                        }
                      }
                    } else {
                      setExcelSheets([]);
                    }
                  }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar archivo Excel..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin archivo Excel</SelectItem>
                        {availableExcelFiles.map(file => <SelectItem key={file.id} value={file.id}>
                            {file.fileName}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" value={selectedProduct.description || ""} onChange={e => setSelectedProduct({
                  ...selectedProduct,
                  description: e.target.value
                })} />
                </div>

                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label htmlFor="category-select">Categoría</Label>
                    <Select value={selectedCategoryId || "none"} onValueChange={value => {
                    setSelectedCategoryId(value === "none" ? "" : value);
                    setSelectedSubcategoryId("");
                  }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {allCategories.filter(cat => cat.is_active).map(category => <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{
                            backgroundColor: category.color
                          }} />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="product-type">Tipo de producto</Label>
                    <Select value={productType} onValueChange={async (value: 'sencillo' | 'compuesto' | 'kit') => {
                    if (value === 'kit') return; // Kit está deshabilitado
                    setProductType(value);
                    if (selectedProduct) {
                      const newIsComposite = value === 'compuesto';
                      // Determinar componentes según el tipo
                      let newEnabledComponents: string[] = [];
                      if (value === 'compuesto') {
                        // Compuesto empieza vacío o mantiene los existentes
                        newEnabledComponents = enabledComponents.length > 0 ? enabledComponents : [];
                      }
                      try {
                        await upsertComponentSettings({
                          easyquote_product_id: selectedProduct.id,
                          is_composite: newIsComposite,
                          enabled_components: newEnabledComponents,
                          product_type: value
                        });
                      } catch (error) {
                        console.error("Error updating product type:", error);
                      }
                    }
                  }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sencillo">Sencillo</SelectItem>
                        <SelectItem value="compuesto">Compuesto</SelectItem>
                        <SelectItem value="kit" disabled className="text-muted-foreground">
                          Kit <span className="ml-2 text-xs">(próximamente)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 pb-2">
                    <Switch id="isActive" checked={selectedProduct.isActive} onCheckedChange={checked => setSelectedProduct({
                    ...selectedProduct,
                    isActive: checked
                  })} />
                    <Label htmlFor="isActive">Producto activo</Label>
                  </div>
                </div>

                {selectedCategoryId && <div className="max-w-xs">
                    <Label htmlFor="subcategory-select">Subcategoría</Label>
                    <Select value={selectedSubcategoryId || "none"} onValueChange={value => setSelectedSubcategoryId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin subcategoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin subcategoría</SelectItem>
                        {allSubcategories.filter(subcat => subcat.category_id === selectedCategoryId && subcat.is_active).map(subcategory => <SelectItem key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>}
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


                {promptsLoading ? <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando datos entrada...</p>
                  </div> : productPrompts.length === 0 ? <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay datos de entrada configurados</p>
                  </div> : <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {productPrompts.map((prompt, index) => {
                    const promptName = prompt.promptCell || prompt.id;
                    const assignedComponent = getPromptComponent(promptName);
                    const componentLabel = assignedComponent === 'general' ? 'General' : COMPONENT_PRESETS.compuesto.components.find(c => c.value === assignedComponent)?.label || assignedComponent;
                    return <div key={prompt.id} className="p-4 border rounded-lg">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="font-medium">Campo nº {index + 1}</h4>
                        </div>
                        
                        {(() => {
                        const currentPromptType = promptTypes.find(type => type.id === prompt.promptType);
                        const isNumericType = currentPromptType?.promptType === "Number" || currentPromptType?.promptType === "Quantity";
                        const isDropdownType = currentPromptType?.promptType === "DropDown";
                        return <>
                            <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-2">
                                <div className="flex items-center gap-1">
                                  <Label>Hoja</Label>
                                  {sheetInconsistencies.inconsistentPrompts.has(prompt.id) && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">
                                            Este campo usa una hoja diferente al resto ({sheetInconsistencies.dominantSheet}). Verifica si es intencional.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <Select value={prompt.promptSheet || ""} onValueChange={value => {
                                const updatedPrompt = {
                                  ...prompt,
                                  promptSheet: value,
                                  valueSheet: value,
                                  // Actualizar también valueSheet
                                  valueOptionSheet: value,
                                  // Actualizar también valueOptionSheet
                                  valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                  valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                  valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}>
                                  <SelectTrigger className={sheetInconsistencies.inconsistentPrompts.has(prompt.id) ? "border-amber-500" : ""}>
                                    <SelectValue placeholder={prompt.promptSheet || "Seleccionar hoja"} />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    {prompt.promptSheet && !excelSheets.includes(prompt.promptSheet) && <SelectItem value={prompt.promptSheet}>
                                        {prompt.promptSheet}
                                      </SelectItem>}
                                    {excelSheets.map(sheet => <SelectItem key={sheet} value={sheet}>
                                        {sheet}
                                      </SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-1">
                                <Label>Rótulo</Label>
                                <Input defaultValue={prompt.promptCell} onBlur={e => {
                                const updatedPrompt = {
                                  ...prompt,
                                  promptCell: e.target.value,
                                  valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                  valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                  valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }} />
                              </div>
                              <div className="col-span-1">
                                <Label>Valor</Label>
                                <Input defaultValue={prompt.valueCell || ""} onBlur={e => {
                                const updatedPrompt = {
                                  ...prompt,
                                  valueCell: e.target.value,
                                  valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                  valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                  valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }} />
                              </div>
                              <div className="col-span-1">
                                <Label>Orden</Label>
                                <Input type="number" defaultValue={prompt.promptSeq} onBlur={e => {
                                const updatedPrompt = {
                                  ...prompt,
                                  promptSeq: parseInt(e.target.value),
                                  valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                  valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                  valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }} />
                              </div>
                              
                              {/* Rango - Solo para tipos no numéricos */}
                              {!isNumericType && <div className="col-span-2">
                                  <Label>Rango</Label>
                                  <Input defaultValue={prompt.valueOptionRange || ""} placeholder="$E$2:$E$3" onBlur={e => {
                                const updatedPrompt = {
                                  ...prompt,
                                  valueOptionRange: e.target.value.replace(/^=/, ''),
                                  valueQuantityAllowedDecimals: null,
                                  valueQuantityMin: null,
                                  valueQuantityMax: null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }} />
                                </div>}

                                <div className="col-span-2">
                                 <Label>Typo</Label>
                                 <Select value={prompt.promptType?.toString() || ""} onValueChange={value => {
                                const newType = parseInt(value);
                                const newPromptType = promptTypes.find(t => t.id === newType);
                                const isNewTypeNumeric = newPromptType?.promptType === "Number" || newPromptType?.promptType === "Quantity";
                                const updatedPrompt = {
                                  ...prompt,
                                  promptType: newType,
                                  valueQuantityAllowedDecimals: isNewTypeNumeric ? prompt.valueQuantityAllowedDecimals : null,
                                  valueQuantityMin: isNewTypeNumeric ? prompt.valueQuantityMin : null,
                                  valueQuantityMax: isNewTypeNumeric ? prompt.valueQuantityMax : null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}>
                                   <SelectTrigger>
                                     <SelectValue />
                                   </SelectTrigger>
                                    <SelectContent className="bg-background border shadow-lg z-50">
                                      {promptTypes.map(type => <SelectItem key={type.id} value={type.id?.toString() || "0"}>
                                          {type.promptType}
                                        </SelectItem>)}
                                   </SelectContent>
                                 </Select>
                               </div>

                              {/* Campos numéricos - Solo para tipos Number/Quantity */}
                              {isNumericType && <>
                                  <div className="col-span-1">
                                    <Label>Decs.</Label>
                                    <Input type="number" defaultValue={prompt.valueQuantityAllowedDecimals ?? 0} onBlur={e => {
                                  const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                  const updatedPrompt = {
                                    ...prompt,
                                    valueQuantityAllowedDecimals: value,
                                    valueQuantityMin: prompt.valueQuantityMin ?? 0,
                                    valueQuantityMax: prompt.valueQuantityMax ?? 9999
                                  };
                                  updatePromptMutation.mutate(updatedPrompt);
                                }} />
                                  </div>
                                   <div className="col-span-1">
                                     <Label>Mínimo</Label>
                                     <Input type="number" step="any" defaultValue={prompt.valueQuantityMin ?? 0} onBlur={e => {
                                  const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  const updatedPrompt = {
                                    ...prompt,
                                    valueQuantityMin: value,
                                    valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals ?? 0,
                                    valueQuantityMax: prompt.valueQuantityMax ?? 9999
                                  };
                                  updatePromptMutation.mutate(updatedPrompt);
                                }} />
                                   </div>
                                   <div className="col-span-2">
                                     <Label>Máximo</Label>
                                     <Input type="number" step="any" defaultValue={prompt.valueQuantityMax ?? 9999} onBlur={e => {
                                  const value = e.target.value === '' ? 9999 : parseFloat(e.target.value);
                                  const updatedPrompt = {
                                    ...prompt,
                                    valueQuantityMax: value,
                                    valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals ?? 0,
                                    valueQuantityMin: prompt.valueQuantityMin ?? 0
                                  };
                                  updatePromptMutation.mutate(updatedPrompt);
                                }} />
                                   </div>
                                 </>}

                               {/* Espacios vacíos para mantener alineación cuando no hay campos numéricos */}
                               {!isNumericType && <div className="col-span-2"></div>}

                              <div className="col-span-1">
                                <Label>Acción</Label>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => {
                                  const updatedPrompt = {
                                    ...prompt,
                                    valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals ?? 0 : null,
                                    valueQuantityMin: isNumericType ? prompt.valueQuantityMin ?? 0 : null,
                                    valueQuantityMax: isNumericType ? prompt.valueQuantityMax ?? 9999 : null
                                  };
                                  updatePromptMutation.mutate(updatedPrompt);
                                }}>
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deletePrompt(prompt.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Requerido + Ocultar en documentos + Componente + Variable de producción - Línea separada */}
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium">Requerido</Label>
                                <Switch checked={prompt.valueRequired} onCheckedChange={checked => {
                                const updatedPrompt = {
                                  ...prompt,
                                  valueRequired: checked,
                                  valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                  valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                  valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null
                                };
                                updatePromptMutation.mutate(updatedPrompt);
                              }} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium whitespace-nowrap">Ocultar docs.</Label>
                                <Switch checked={isPromptHiddenInDocuments(prompt.promptCell)} onCheckedChange={checked => {
                                if (selectedProduct) {
                                  upsertPromptSettingMutation.mutate({
                                    productId: selectedProduct.id,
                                    promptName: prompt.promptCell,
                                    hideInDocuments: checked
                                  });
                                }
                              }} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium whitespace-nowrap">Solo admin</Label>
                                <Switch checked={isPromptAdminOnly(prompt.promptCell)} onCheckedChange={checked => {
                                if (selectedProduct) {
                                  upsertPromptSettingMutation.mutate({
                                    productId: selectedProduct.id,
                                    promptName: prompt.promptCell,
                                    adminOnly: checked
                                  });
                                }
                              }} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium whitespace-nowrap">Opc. restrictiva</Label>
                                <Switch checked={isPromptForceResult(prompt.promptCell)} onCheckedChange={checked => {
                                if (selectedProduct) {
                                  upsertPromptSettingMutation.mutate({
                                    productId: selectedProduct.id,
                                    promptName: prompt.promptCell,
                                    forceResult: checked
                                  });
                                }
                              }} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium whitespace-nowrap">Oculto</Label>
                                <Switch checked={isPromptHidden(prompt.promptCell)} onCheckedChange={checked => {
                                if (selectedProduct) {
                                  upsertPromptSettingMutation.mutate({
                                    productId: selectedProduct.id,
                                    promptName: prompt.promptCell,
                                    isHidden: checked
                                  });
                                }
                              }} />
                              </div>
                              {/* Etiqueta y Variable de prod. en la misma línea */}
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex items-center gap-2 flex-1">
                                  <Label className="text-sm font-medium whitespace-nowrap">Etiqueta</Label>
                                  <Input 
                                    className="flex-1 h-8"
                                    placeholder="Nombre descriptivo"
                                    value={promptLabelDrafts[prompt.promptCell] ?? getPromptLabel(prompt.promptCell) ?? prompt.promptText ?? ""}
                                    onChange={e => {
                                      setPromptLabelDrafts(prev => ({
                                        ...prev,
                                        [prompt.promptCell]: e.target.value
                                      }));
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm font-medium whitespace-nowrap">Variable de prod.</Label>
                                  <Select value={getMappedVariableId(prompt.promptCell) || "none"} onValueChange={value => {
                                    if (selectedProduct) {
                                      upsertVariableMapping({
                                        easyquoteProductId: selectedProduct.id,
                                        productName: selectedProduct.productName,
                                        promptOrOutputName: prompt.promptCell,
                                        variableId: value === "none" ? null : value
                                      });
                                    }
                                  }}>
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Sin variable" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border shadow-lg z-50">
                                      <SelectItem value="none">Sin variable asignada</SelectItem>
                                      {productionVariables.filter(v => {
                                        const mappedNames = getMappedNames();
                                        const currentMapping = getMappedVariableId(prompt.promptCell);
                                        return !mappedNames.includes(prompt.promptCell) || currentMapping && v.id === currentMapping;
                                      }).map(variable => (
                                        <SelectItem key={variable.id} value={variable.id}>
                                          {variable.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                            </>;
                      })()}
                      </div>;
                  })}
                    </div>
                  </ScrollArea>}
              </TabsContent>

              <TabsContent value="outputs" className="space-y-4">
                {/* Alerta sobre output PRICE obligatorio */}
                {(() => {
                  const priceOutputs = productOutputs.filter(o => {
                    const typeName = outputTypes.find(t => t.id === o.outputTypeId)?.outputType?.toLowerCase();
                    return typeName === 'price';
                  });
                  const hasPriceOutput = priceOutputs.length === 1;
                  const hasMultiplePriceOutputs = priceOutputs.length > 1;
                  
                  if (!hasPriceOutput || hasMultiplePriceOutputs) {
                    return (
                      <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                        <AlertCircle className="h-5 w-5" />
                        <AlertTitle className="text-lg font-bold">
                          ⚠️ Configuración de precio incorrecta
                        </AlertTitle>
                        <AlertDescription className="text-base mt-2">
                          {hasMultiplePriceOutputs ? (
                            <span>
                              Este producto tiene <strong>{priceOutputs.length} datos de salida de tipo PRICE</strong>. 
                              Solo debe tener <strong>exactamente uno</strong> para que el sistema pueda calcular el precio correctamente.
                            </span>
                          ) : (
                            <span>
                              Este producto <strong>no tiene ningún dato de salida de tipo PRICE</strong>. 
                              Debes añadir <strong>exactamente uno</strong> para que el sistema pueda obtener el precio del producto.
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}
                
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

                {outputsLoading ? <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando datos de salida...</p>
                  </div> : productOutputs.length === 0 ? <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay datos de salida configurados</p>
                  </div> : <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-6">
                      {/* Sección General */}
                      <div>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={orderedProductOutputs.map(o => o.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-3">
                              {orderedProductOutputs.map((output, index) => (
                                <SortableOutputItem
                                  key={output.id}
                                  output={output}
                                  index={index}
                                  excelSheets={excelSheets}
                                  outputTypes={outputTypes}
                                  onUpdate={(updatedOutput) => updateOutputMutation.mutate(updatedOutput)}
                                  onDelete={deleteOutput}
                                  getMappedVariableId={getMappedVariableId}
                                  getMappedNames={getMappedNames}
                                  upsertVariableMapping={upsertVariableMapping}
                                  productionVariables={productionVariables}
                                  selectedProduct={selectedProduct}
                                  labelValue={outputLabelDrafts[output.nameCell] ?? getPromptLabel(output.nameCell) ?? ""}
                                  onLabelChange={(value) =>
                                    setOutputLabelDrafts((prev) => ({
                                      ...prev,
                                      [output.nameCell]: value,
                                    }))
                                  }
                                />
                              ))}
                              {orderedProductOutputs.length === 0 && <div className="text-center py-4">
                                  <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">No hay campos de salida</p>
                                </div>}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    </div>
                  </ScrollArea>}
              </TabsContent>

              {/* Pestaña para productos compuestos */}
              <TabsContent value="components" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Configuración de componentes</h3>
                  <p className="text-sm text-muted-foreground">
                    Configura las partes del producto (cubierta, interior, etc.) y asigna cada dato de entrada a su componente.
                  </p>
                </div>

                {/* Componentes habilitados */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Componentes habilitados</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Selecciona qué partes tiene este producto
                    </p>
                    <div className="space-y-2">
                      {COMPONENT_PRESETS.compuesto.components.map(comp => {
                      const isEnabled = enabledComponents.includes(comp.value);
                      const isRequired = comp.value === 'interior_1';
                      const hints: Record<string, string> = {
                        cubierta: 'papel o acabado distinto al interior',
                        interior_1: 'páginas interiores principales',
                        interior_2: 'segundas páginas interiores (opcional)'
                      };
                      return <div key={comp.value} className="flex items-center space-x-2">
                            <Checkbox id={`comp-${comp.value}`} checked={isEnabled} disabled={isRequired || isUpsertingComponents} onCheckedChange={async checked => {
                          if (selectedProduct) {
                            const newComponents = checked ? [...enabledComponents, comp.value] : enabledComponents.filter(c => c !== comp.value);
                            try {
                              await upsertComponentSettings({
                                easyquote_product_id: selectedProduct.id,
                                is_composite: true,
                                enabled_components: newComponents
                              });
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "No se pudo guardar",
                                variant: "destructive"
                              });
                            }
                          }
                        }} />
                            <Label htmlFor={`comp-${comp.value}`} className={`cursor-pointer ${isRequired ? 'text-muted-foreground' : ''}`}>
                              {comp.label}
                              {hints[comp.value] && <span className="text-xs text-muted-foreground ml-1">({hints[comp.value]})</span>}
                              {isRequired && <span className="text-xs ml-1">(obligatorio)</span>}
                            </Label>
                          </div>;
                    })}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Pestaña para Compuesto (arquitectura flexible) */}
              <TabsContent value="composite-config" className="space-y-4">
                <CompositeProductConfig 
                  easyquoteProductId={selectedProduct.id}
                  productName={selectedProduct.productName}
                  availableProducts={products.map(p => ({ id: p.id, name: p.productName }))}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="destructive" onClick={() => setIsDeleteProductDialogOpen(true)} disabled={updateProductMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar producto
              </Button>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsEditDialogOpen(false);
                  setPromptLabelDrafts({});
                  setOutputLabelDrafts({});
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveProduct} disabled={updateProductMutation.isPending}>
                  {updateProductMutation.isPending ? <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </> : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </div>}
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
                <Select value={newPromptData.promptSheet || ""} onValueChange={value => setNewPromptData({
                ...newPromptData,
                promptSheet: value,
                valueSheet: value,
                valueOptionSheet: value
              })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hoja" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {excelSheets.map(sheet => <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label htmlFor="promptCell">Celda rótulo</Label>
                <Input id="promptCell" value={newPromptData.promptCell} onChange={e => setNewPromptData({
                ...newPromptData,
                promptCell: e.target.value
              })} placeholder="ej: A1" />
              </div>
              <div className="col-span-3">
                <Label htmlFor="valueCell">Celda valor</Label>
                <Input id="valueCell" value={newPromptData.valueCell} onChange={e => setNewPromptData({
                ...newPromptData,
                valueCell: e.target.value
              })} placeholder="ej: B1" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="promptSeq">Orden</Label>
                <Input id="promptSeq" type="number" value={newPromptData.promptSeq} onChange={e => setNewPromptData({
                ...newPromptData,
                promptSeq: parseInt(e.target.value) || 1
              })} placeholder="1" />
              </div>
            </div>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <Label htmlFor="promptType">Tipo</Label>
                <Select value={newPromptData.promptType.toString()} onValueChange={value => setNewPromptData({
                ...newPromptData,
                promptType: parseInt(value)
              })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promptTypes.map(type => <SelectItem key={type.id} value={type.id.toString()}>
                        {type.promptType}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center space-x-2 pt-6">
                <Switch id="valueRequired" checked={newPromptData.valueRequired} onCheckedChange={checked => setNewPromptData({
                ...newPromptData,
                valueRequired: checked
              })} />
                <Label htmlFor="valueRequired">Requerido</Label>
              </div>
              <div className="col-span-6">
                <Label htmlFor="valueOptionRange">Rango</Label>
                <Input id="valueOptionRange" value={newPromptData.valueOptionRange} onChange={e => setNewPromptData({
                ...newPromptData,
                valueOptionRange: e.target.value.replace(/^=/, '')
              })} placeholder="ej: $E$2:$E$3" />
              </div>
            </div>
            {/* Campos numéricos - solo si el tipo es Number (0) */}
            {newPromptData.promptType === 0 && <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="valueQuantityAllowedDecimals">Decimales</Label>
                  <Input id="valueQuantityAllowedDecimals" type="number" value={newPromptData.valueQuantityAllowedDecimals} onChange={e => setNewPromptData({
                ...newPromptData,
                valueQuantityAllowedDecimals: parseInt(e.target.value) || 0
              })} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="valueQuantityMin">Mínimo</Label>
                  <Input
                    id="valueQuantityMin"
                    type="number"
                    value={newPromptData.valueQuantityMin}
                    onChange={e => {
                      const raw = e.target.value;
                      setNewPromptData({
                        ...newPromptData,
                        valueQuantityMin: raw === '' ? 0 : parseFloat(raw)
                      });
                    }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="valueQuantityMax">Máximo</Label>
                  <Input id="valueQuantityMax" type="number" value={newPromptData.valueQuantityMax} onChange={e => setNewPromptData({
                ...newPromptData,
                valueQuantityMax: parseFloat(e.target.value) || 9999
              })} placeholder="9999" />
                </div>
              </div>}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsNewPromptDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createNewPrompt} disabled={!newPromptData.promptSheet}>
              Crear valor de entrada
            </Button>
          </div>
          {!newPromptData.promptSheet && (
            <p className="text-sm text-destructive mt-2">⚠️ Debes seleccionar una hoja del Excel</p>
          )}
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
                <Select value={newOutputData.sheet || ""} onValueChange={value => setNewOutputData(prev => ({
                ...prev,
                sheet: value
              }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hoja" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {excelSheets.map(sheet => <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="outputPrompt">Rótulo</Label>
                <Input id="outputPrompt" value={newOutputData.prompt} onChange={e => setNewOutputData({
                ...newOutputData,
                prompt: e.target.value
              })} />
              </div>
              <div>
                <Label htmlFor="outputDefault">Valor por defecto</Label>
                <Input id="outputDefault" value={newOutputData.defaultValue} onChange={e => setNewOutputData({
                ...newOutputData,
                defaultValue: e.target.value
              })} />
              </div>
              <div>
                <Label htmlFor="outputType">Tipo</Label>
                <Select value={newOutputData.outputTypeId.toString()} onValueChange={value => setNewOutputData({
                ...newOutputData,
                outputTypeId: parseInt(value)
              })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {outputTypes.map(type => <SelectItem key={type.id} value={type.id.toString()}>
                        {type.outputType}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsNewOutputDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createNewOutput} disabled={!newOutputData.sheet}>
              Crear Output
            </Button>
          </div>
          {!newOutputData.sheet && (
            <p className="text-sm text-destructive mt-2">⚠️ Debes seleccionar una hoja del Excel</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogos masivos */}
      <BulkPromptsDialog open={isBulkPromptsDialogOpen} onOpenChange={setIsBulkPromptsDialogOpen} onSave={handleBulkSavePrompts} promptTypes={promptTypes} isSaving={createPromptMutation.isPending} existingPrompts={productPrompts} availableSheets={excelSheets} isComposite={isComposite} enabledComponents={enabledComponents} />

      <BulkOutputsDialog open={isBulkOutputsDialogOpen} onOpenChange={setIsBulkOutputsDialogOpen} onSave={handleBulkSaveOutputs} outputTypes={outputTypes} isSaving={createOutputMutation.isPending} existingOutputs={productOutputs} availableSheets={excelSheets} isComposite={isComposite} enabledComponents={enabledComponents} />

      {/* AlertDialog para confirmar eliminación de producto */}
      <AlertDialog open={isDeleteProductDialogOpen} onOpenChange={setIsDeleteProductDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará el producto "{selectedProduct?.productName}". 
              El producto dejará de estar disponible pero puede reactivarse más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}