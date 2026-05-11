import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction, getEasyQuoteToken } from "@/lib/easyquoteApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useProductCategoryMappings } from "@/hooks/useProductCategoryMappings";
import { useProductionVariables } from "@/hooks/useProductionVariables";
import { useProductVariableMappings } from "@/hooks/useProductVariableMappings";
import { Package, AlertCircle, AlertTriangle, Loader2, Save, Plus, Trash2, Layers, GripVertical, ArrowLeft, ChevronRight, Lock, EyeOff, FileText, ShieldCheck, Hash, ClipboardList, ChevronsUpDown, GitBranch, Lightbulb, X as XIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";
import { BulkPromptsDialog } from "@/components/quotes/BulkPromptsDialog";
import { BulkOutputsDialog } from "@/components/quotes/BulkOutputsDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProductComponentSettings, COMPONENT_PRESETS } from "@/hooks/useProductComponentSettings";
import { Checkbox } from "@/components/ui/checkbox";
import { CompositeProductConfig } from "@/components/products/CompositeProductConfig";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { normalizeApiUserId } from "@/utils/normalizeApiUserId";
import { useProductOutputOtSettings } from "@/hooks/useProductOutputOtSettings";

// Interfaces
interface EasyQuoteProduct {
  id: string;
  productName: string;
  isActive: boolean;
  category?: string;
  description?: string;
  basePrice?: number;
  excelfileId?: string;
  currency?: string;
  [key: string]: any;
}

interface ProductPrompt {
  id: string;
  productId: string;
  promptSeq: number;
  promptType: number;
  promptSheet: string;
  promptCell: string;
  valueSheet: string;
  valueCell: string;
  valueOptionSheet: string;
  valueOptionRange: string;
  valueRequired: boolean;
  valueQuantityAllowedDecimals: number | null;
  valueQuantityMin: number | null;
  valueQuantityMax: number | null;
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

/** Valida que un valor tenga formato de referencia de celda Excel (ej: B10, C13, $B$10) */
function isValidCellReference(value: string): boolean {
  if (!value || !value.trim()) return true;
  const cleaned = value.replace(/\$/g, "").trim();
  return /^[A-Z]+\d+$/i.test(cleaned);
}

function validateCellRef(value: string, fieldName: string): boolean {
  if (!value || !value.trim()) return true;
  if (!isValidCellReference(value)) {
    toast({
      title: "Referencia de celda inválida",
      description: `El campo "${fieldName}" tiene el valor "${value}" que no es una referencia válida de Excel (ej: B10, C13, $B$10). Verifica que incluya la letra de columna.`,
      variant: "destructive",
    });
    return false;
  }
  return true;
}

// SortableOutputItem component
function SortableOutputItem({
  output, index, excelSheets, outputTypes, onUpdate, onDelete,
  getMappedVariableId, getMappedNames, upsertVariableMapping, productionVariables,
  selectedProduct, labelValue, onLabelChange, isOutputInOt, getOutputOtSection,
  onOtToggle, onOtSectionChange, isExpanded, onToggle,
}: {
  output: ProductOutput; index: number; excelSheets: string[]; outputTypes: OutputType[];
  onUpdate: (output: ProductOutput) => void; onDelete: (id: string) => void;
  getMappedVariableId: (name: string) => string | undefined; getMappedNames: () => string[];
  upsertVariableMapping: (data: any) => void; productionVariables: any[];
  selectedProduct: EasyQuoteProduct | null; labelValue: string;
  onLabelChange: (value: string) => void; isOutputInOt: boolean;
  getOutputOtSection: string | null; onOtToggle: (checked: boolean) => void;
  onOtSectionChange: (section: string) => void;
  isExpanded: boolean; onToggle: (open: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: output.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const displayLabel = labelValue || output.nameCell || `Campo nº ${index + 1}`;
  const typeName = outputTypes.find((t) => t.id === output.outputTypeId)?.outputType || '?';
  const cellsText = `${output.nameCell || '?'}→${output.valueCell || '?'}`;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div ref={setNodeRef} style={style} className={`border rounded-lg bg-background ${isDragging ? "ring-2 ring-primary" : ""}`}>
        {/* Summary header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded shrink-0" type="button">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left text-base leading-6 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors" type="button">
              <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              <span className="font-medium text-base leading-6 min-w-0 break-words">{displayLabel}</span>
              <span className="text-sm leading-5 font-mono text-muted-foreground shrink-0">({cellsText})</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">{typeName}</span>
              {output.sheet && <span className="text-sm text-muted-foreground">· {output.sheet}</span>}
              {isOutputInOt && (
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                  <span className="text-muted-foreground"><ClipboardList className="h-3.5 w-3.5" /></span>
                </TooltipTrigger><TooltipContent>Mostrar en OT</TooltipContent></Tooltip></TooltipProvider>
              )}
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onUpdate(output)}>
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(output.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t">
            {/* Section 1: Excel Config */}
            <div className="pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Configuración Excel</p>
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-3">
                  <Label className="text-xs">Hoja</Label>
                  <Select value={output.sheet || ""} onValueChange={(value) => onUpdate({ ...output, sheet: value })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={output.sheet || "Seleccionar hoja"} /></SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {output.sheet && !excelSheets.includes(output.sheet) && <SelectItem value={output.sheet}>{output.sheet}</SelectItem>}
                      {excelSheets.map((sheet) => <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Rótulo</Label>
                  <Input className="h-9" defaultValue={output.nameCell || ""} placeholder="ej: A25" onBlur={(e) => onUpdate({ ...output, nameCell: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Valor</Label>
                  <Input className="h-9" defaultValue={output.valueCell || ""} placeholder="ej: B25" onBlur={(e) => onUpdate({ ...output, valueCell: e.target.value })} />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={output.outputTypeId?.toString() || ""} onValueChange={(value) => onUpdate({ ...output, outputTypeId: parseInt(value) })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {outputTypes.map((type) => <SelectItem key={type.id} value={type.id?.toString() || "0"}>{type.outputType}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Labels & Mappings */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Etiquetas y mapeos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Etiqueta personalizada</Label>
                  <Input className="h-9 mt-1" value={labelValue} placeholder="Nombre descriptivo" onChange={(e) => onLabelChange(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Variable de producción</Label>
                  <Select value={getMappedVariableId(output.nameCell) || "none"} onValueChange={(value) => {
                    if (selectedProduct) {
                      upsertVariableMapping({
                        easyquoteProductId: selectedProduct.id,
                        productName: selectedProduct.productName,
                        promptOrOutputName: output.nameCell,
                        variableId: value === "none" ? null : value,
                      });
                    }
                  }}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sin variable" /></SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Sin variable asignada</SelectItem>
                      {productionVariables.map((variable) => <SelectItem key={variable.id} value={variable.id}>{variable.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 3: OT */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Orden de trabajo</p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id={`ot-out-${output.id}`} checked={isOutputInOt} onCheckedChange={(checked: boolean) => onOtToggle(checked)} />
                  <Label htmlFor={`ot-out-${output.id}`} className="text-sm cursor-pointer">Mostrar en OT</Label>
                </div>
                {isOutputInOt && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Sección OT</Label>
                    <Select value={getOutputOtSection || "datos_destacados"} onValueChange={onOtSectionChange}>
                      <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="datos_destacados">Datos destacados</SelectItem>
                        <SelectItem value="impresion">Impresión</SelectItem>
                        <SelectItem value="acabados">Acabados</SelectItem>
                        <SelectItem value="imposiciones">Imposiciones</SelectItem>
                        <SelectItem value="ajustes">Ajustes</SelectItem>
                        <SelectItem value="observaciones">Observaciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function ProductConfigPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    isSuperAdmin, isOrgAdmin, organization, membership
  } = useSubscription();
  const organizationId = organization?.id || membership?.organization_id;
  const apiUserId = normalizeApiUserId(
    organization?.api_user_id ??
      (membership?.organization as any)?.api_user_id ??
      membership?.organization
  );

  // State
  const [selectedProduct, setSelectedProduct] = useState<EasyQuoteProduct | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [productType, setProductType] = useState<'sencillo' | 'compuesto' | 'kit'>('sencillo');
  const [promptLabelDrafts, setPromptLabelDrafts] = useState<Record<string, string>>({});
  const [outputLabelDrafts, setOutputLabelDrafts] = useState<Record<string, string>>({});
  const [isNewPromptDialogOpen, setIsNewPromptDialogOpen] = useState(false);
  const [isNewOutputDialogOpen, setIsNewOutputDialogOpen] = useState(false);
  const [isBulkPromptsDialogOpen, setIsBulkPromptsDialogOpen] = useState(false);
  const [isBulkOutputsDialogOpen, setIsBulkOutputsDialogOpen] = useState(false);
  const [isDeleteProductDialogOpen, setIsDeleteProductDialogOpen] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set());
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [availableExcelFiles, setAvailableExcelFiles] = useState<EasyQuoteExcelFile[]>([]);
  const [newPromptData, setNewPromptData] = useState({
    promptSheet: "", promptCell: "", valueSheet: "", valueCell: "",
    valueOptionSheet: "", valueOptionRange: "", promptType: 0,
    valueRequired: false, valueQuantityAllowedDecimals: 0,
    valueQuantityMin: 0, valueQuantityMax: 9999, promptSeq: 1,
    component: "general"
  });
  const [newOutputData, setNewOutputData] = useState({
    sheet: "", prompt: "", defaultValue: "", outputTypeId: 0, component: "general"
  });

  // Hooks
  const { categories: allCategories, subcategories: allSubcategories } = useProductCategories();
  const { getProductMapping, upsertMapping: upsertCategoryMapping } = useProductCategoryMappings();
  const { variables: productionVariables } = useProductionVariables();
  const { upsertMapping: upsertVariableMapping, getMappedVariableId, getMappedNames } = useProductVariableMappings(productId);

  const {
    componentSettings, promptComponents, isComposite, enabledComponents,
    productType: savedProductType, upsertSettings: upsertComponentSettings,
    assignPromptToComponent, getPromptComponent,
    isUpserting: isUpsertingComponents,
    hasSubproducts,
  } = useProductComponentSettings(productId, apiUserId, organizationId);

  const {
    isOutputInOt: checkOutputInOt, getOutputOtSection: checkOutputOtSection,
    upsertOutputOtSetting,
  } = useProductOutputOtSettings(productId);

  useEffect(() => {
    if (savedProductType) setProductType(savedProductType);
  }, [savedProductType]);

  // Fetch product details
  const { data: allProducts = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["easyquote-products", true],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction("easyquote-products", { token, includeInactive: true });
      if (error || !data) return [];
      return data as EasyQuoteProduct[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Load product and excel sheets on mount
  useEffect(() => {
    if (!productId || allProducts.length === 0) return;
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    if (selectedProduct?.id === product.id) return;
    
    setSelectedProduct({ ...product });

    const mapping = getProductMapping(product.id);
    setSelectedCategoryId(mapping?.category_id || "");
    setSelectedSubcategoryId(mapping?.subcategory_id || "");

    // Load excel files and sheets
    (async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) return;

      try {
        const { data: allFiles, error: filesError } = await supabase.functions.invoke("easyquote-excel-files", { body: { token } });
        if (!filesError && Array.isArray(allFiles)) {
          setAvailableExcelFiles(allFiles.filter((f: EasyQuoteExcelFile) => f.isActive));
        }
      } catch {}

      if (product.excelfileId) {
        try {
          const { data, error } = await supabase.functions.invoke("easyquote-excel-files", {
            body: { token, fileId: product.excelfileId }
          });
          if (!error && data?.excelfilesSheets) {
            setExcelSheets(data.excelfilesSheets.map((s: any) => s.sheetName).sort());
          }
        } catch {}
      }
    })();
  }, [productId, allProducts]);

  // Prompt settings query
  const { data: promptSettings = [], refetch: refetchPromptSettings } = useQuery({
    queryKey: ["product-prompt-settings", productId, apiUserId],
    queryFn: async () => {
      if (!productId || !apiUserId) return [];
      const { data, error } = await supabase
        .from("product_prompt_settings").select("*")
        .eq("api_user_id", apiUserId).eq("easyquote_product_id", productId);
      if (error) return [];
      return data || [];
    },
    enabled: !!productId && !!apiUserId,
  });

  // Prompt settings mutation
  const upsertPromptSettingMutation = useMutation({
    mutationFn: async ({ productId: pid, promptName, hideInDocuments, adminOnly, forceResult, isHidden, isQuantity, label, showInOt, otSection, hideWhenValue }: {
      productId: string; promptName: string; hideInDocuments?: boolean; adminOnly?: boolean;
      forceResult?: boolean; isHidden?: boolean; isQuantity?: boolean; label?: string;
      showInOt?: boolean; otSection?: string | null;
      hideWhenValue?: string | null;
    }) => {
      if (!apiUserId || !pid || !promptName) throw new Error("Missing required parameters");
      const promptKey = String(promptName).replace(/\$/g, "").trim();
      const existing = promptSettings?.find(
        (s: any) => s.api_user_id === apiUserId && s.easyquote_product_id === pid && s.prompt_name === promptKey
      );

      const updateData: any = { updated_at: new Date().toISOString() };
      if (hideInDocuments !== undefined) {
        updateData.hide_in_documents = hideInDocuments;
        // If always-hide is enabled, drop conditional hide
        if (hideInDocuments) updateData.hide_when_value = null;
      }
      if (adminOnly !== undefined) {
        updateData.admin_only = adminOnly;
        if (adminOnly) {
          updateData.hide_in_documents = true;
          updateData.force_result = true;
          updateData.hide_when_value = null;
        }
      }
      if (forceResult !== undefined) updateData.force_result = forceResult;
      if (isHidden !== undefined) updateData.is_hidden = isHidden;
      if (isQuantity !== undefined) updateData.is_quantity = isQuantity;
      if (label !== undefined) updateData.label = label;
      if (showInOt !== undefined) updateData.show_in_ot = showInOt;
      if (otSection !== undefined) updateData.ot_section = otSection;
      if (hideWhenValue !== undefined) {
        updateData.hide_when_value = hideWhenValue && hideWhenValue.trim() !== '' ? hideWhenValue.trim() : null;
      }

      if (existing) {
        const { error } = await supabase.from("product_prompt_settings").update(updateData).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_prompt_settings").insert({
          api_user_id: apiUserId, organization_id: organizationId!,
          easyquote_product_id: pid, prompt_name: promptKey,
          hide_in_documents: hideInDocuments ?? false, admin_only: adminOnly ?? false,
          force_result: forceResult ?? false, is_hidden: isHidden ?? false,
          is_quantity: isQuantity ?? false, label: label ?? null,
          show_in_ot: showInOt ?? false, ot_section: otSection ?? null,
          hide_when_value: hideWhenValue && hideWhenValue.trim() !== '' ? hideWhenValue.trim() : null,
        });
        if (error) throw error;
      }

      return { apiUserId, productId: pid, promptKey, patch: { hide_in_documents: hideInDocuments, admin_only: adminOnly, force_result: forceResult, is_hidden: isHidden, label, show_in_ot: showInOt, ot_section: otSection, hide_when_value: hideWhenValue } };
    },
    onSuccess: async (result, variables) => {
      queryClient.setQueryData(
        ["product-prompt-settings", variables.productId, result.apiUserId],
        (old: any[] | undefined) => {
          const existing = Array.isArray(old) ? old : [];
          const idx = existing.findIndex(s => String(s?.prompt_name ?? "").replace(/\$/g, "").trim().toUpperCase() === result.promptKey);
          const nextItem = {
            ...(idx >= 0 ? existing[idx] : {}),
            api_user_id: result.apiUserId, easyquote_product_id: variables.productId,
            prompt_name: result.promptKey,
            ...(result.patch.hide_in_documents !== undefined ? { hide_in_documents: result.patch.hide_in_documents } : {}),
            ...(result.patch.admin_only !== undefined ? { admin_only: result.patch.admin_only } : {}),
            ...(result.patch.force_result !== undefined ? { force_result: result.patch.force_result } : {}),
            ...(result.patch.is_hidden !== undefined ? { is_hidden: result.patch.is_hidden } : {}),
            ...(result.patch.label !== undefined ? { label: result.patch.label } : {}),
            ...(result.patch.show_in_ot !== undefined ? { show_in_ot: result.patch.show_in_ot } : {}),
            ...(result.patch.ot_section !== undefined ? { ot_section: result.patch.ot_section } : {}),
            updated_at: new Date().toISOString(),
          };
          if (idx >= 0) { const copy = [...existing]; copy[idx] = nextItem; return copy; }
          return [...existing, nextItem];
        }
      );
      await refetchPromptSettings();
    },
    onError: (error) => {
      console.error("Error saving prompt setting:", error);
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    },
  });

  // Prompt setting helpers
  const normalizePromptKey = (v: unknown) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

  const settingsByPromptKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const setting of promptSettings as any[]) {
      const byPromptName = normalizePromptKey(setting?.prompt_name);
      const byLabel = normalizePromptKey(setting?.label);
      if (byPromptName) map.set(byPromptName, setting);
      if (byLabel) map.set(byLabel, setting);
    }
    return map;
  }, [promptSettings]);

  const getPromptSettingByKeys = (...promptKeys: Array<string | null | undefined>) => {
    for (const rawKey of promptKeys) {
      const key = normalizePromptKey(rawKey);
      if (!key) continue;
      const setting = settingsByPromptKey.get(key);
      if (setting) return setting;
    }
    return undefined;
  };

  const isPromptHiddenInDocuments = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.hide_in_documents || false;
  const isPromptAdminOnly = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.admin_only || false;
  const isPromptForceResult = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.force_result || false;
  const isPromptHidden = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.is_hidden || false;
  const isPromptQuantity = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.is_quantity || false;
  const isPromptSubproductSelector = (...k: Array<string | null | undefined>) => (getPromptSettingByKeys(...k) as any)?.is_subproduct_selector || false;
  const getPromptHideWhenValue = (...k: Array<string | null | undefined>) => ((getPromptSettingByKeys(...k) as any)?.hide_when_value as string | null | undefined) ?? '';
  const isPromptInOt = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.show_in_ot || false;
  const getPromptOtSection = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.ot_section || null;
  const getPromptLabel = (...k: Array<string | null | undefined>) => getPromptSettingByKeys(...k)?.label ?? undefined;

  const getSheetInconsistencies = (prompts: ProductPrompt[]) => {
    if (prompts.length < 3) return { dominantSheet: null, inconsistentPrompts: new Set<string>() };
    const sheetCounts: Record<string, number> = {};
    prompts.forEach(p => { if (p.promptSheet) sheetCounts[p.promptSheet] = (sheetCounts[p.promptSheet] || 0) + 1; });
    const sortedSheets = Object.entries(sheetCounts).sort((a, b) => b[1] - a[1]);
    if (sortedSheets.length === 0) return { dominantSheet: null, inconsistentPrompts: new Set<string>() };
    const [dominantSheet, dominantCount] = sortedSheets[0];
    const totalWithSheet = prompts.filter(p => p.promptSheet).length;
    if (dominantCount / totalWithSheet < 0.8) return { dominantSheet: null, inconsistentPrompts: new Set<string>() };
    const inconsistentPrompts = new Set<string>();
    prompts.forEach(p => { if (p.promptSheet && p.promptSheet !== dominantSheet) inconsistentPrompts.add(p.id); });
    return { dominantSheet, inconsistentPrompts };
  };

  // Prompt/Output types
  const { data: promptTypes = [] } = useQuery({
    queryKey: ["prompt-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch("https://api.easyquote.cloud/api/v1/products/prompts/types", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: outputTypes = [] } = useQuery({
    queryKey: ["output-types"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch("https://api.easyquote.cloud/api/v1/products/outputs/types", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  // Product prompts & outputs
  const { data: productPrompts = [], refetch: refetchPrompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["product-prompts", productId],
    queryFn: async () => {
      if (!productId) return [];
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const { data, error } = await supabase.functions.invoke("easyquote-prompts", { body: { token, productId } });
      if (error) throw new Error("Error fetching prompts");
      return data;
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: productOutputs = [], refetch: refetchOutputs, isLoading: outputsLoading } = useQuery({
    queryKey: ["product-outputs", productId],
    queryFn: async () => {
      if (!productId) return [];
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const { data, error } = await supabase.functions.invoke("easyquote-outputs", { body: { token, productId } });
      if (error) throw new Error("Error fetching outputs");
      return data;
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });

  const sheetInconsistencies = useMemo(() => getSheetInconsistencies(productPrompts), [productPrompts]);

  // Output order
  const [localOutputOrder, setLocalOutputOrder] = useState<string[]>([]);

  const { data: savedOutputOrder, isFetched: savedOrderFetched } = useQuery({
    queryKey: ["product-output-order", productId, organizationId],
    queryFn: async () => {
      if (!productId || !organizationId) return null;
      const { data, error } = await supabase.from("product_output_order").select("output_order")
        .eq("organization_id", organizationId).eq("easyquote_product_id", productId).maybeSingle();
      if (error) return null;
      return data?.output_order || null;
    },
    enabled: !!productId && !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  const saveOutputOrderMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      if (!productId || !organizationId) throw new Error("Missing data");
      const { error } = await supabase.from("product_output_order").upsert({
        organization_id: organizationId, easyquote_product_id: productId,
        output_order: newOrder, updated_at: new Date().toISOString()
      }, { onConflict: "organization_id,easyquote_product_id" });
      if (error) throw error;
      return newOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-output-order", productId, organizationId] });
      toast({ title: "Orden guardado", description: "El orden de outputs se ha guardado." });
    },
  });

  useEffect(() => { setLocalOutputOrder([]); }, [productId]);

  useEffect(() => {
    if (productOutputs.length === 0 || !savedOrderFetched) return;
    const colToNumber = (col: string) => col.toUpperCase().split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
    const parseCellRef = (cell?: string | null) => {
      const raw = (cell ?? "").replace(/\$/g, "").trim().toUpperCase();
      const match = raw.match(/^([A-Za-z]+)(\d+)$/);
      if (!match) return null;
      return { col: colToNumber(match[1]), row: Number.parseInt(match[2], 10) };
    };
    const sorted = [...productOutputs].sort((a, b) => {
      const cellA = parseCellRef(a.nameCell) ?? parseCellRef(a.valueCell);
      const cellB = parseCellRef(b.nameCell) ?? parseCellRef(b.valueCell);
      if (cellA && !cellB) return -1;
      if (!cellA && cellB) return 1;
      if (cellA && cellB) {
        if (cellA.col !== cellB.col) return cellA.col - cellB.col;
        if (cellA.row !== cellB.row) return cellA.row - cellB.row;
      }
      return (a.id || "").localeCompare(b.id || "");
    });
    setLocalOutputOrder(sorted.map(o => o.id));
  }, [productOutputs, savedOrderFetched]);

  const orderedProductOutputs = useMemo(() => {
    if (localOutputOrder.length === 0) return productOutputs;
    const outputMap = new Map(productOutputs.map(o => [o.id, o]));
    const ordered: typeof productOutputs = [];
    for (const id of localOutputOrder) {
      const output = outputMap.get(id);
      if (output) { ordered.push(output); outputMap.delete(id); }
    }
    for (const output of outputMap.values()) ordered.push(output);
    return ordered;
  }, [productOutputs, localOutputOrder]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalOutputOrder(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        const normalizeKey = (v: any) => String(v ?? "").replace(/\$/g, "").trim();
        const outputById = new Map<string, ProductOutput>(productOutputs.map(o => [o.id, o]));
        const orderByName = newOrder.map(id => outputById.get(id)?.nameCell).filter((name): name is string => !!name).map(name => normalizeKey(name));
        saveOutputOrderMutation.mutate(orderByName);
        return newOrder;
      });
    }
  };

  // CRUD Mutations
  const createPromptMutation = useMutation({
    mutationFn: async (newPrompt: Omit<ProductPrompt, 'id'>) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newPrompt)
      });
      if (!r.ok) throw new Error("Error creating prompt");
      const text = await r.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => { toast({ title: "Prompt añadido" }); refetchPrompts(); },
  });

  const createOutputMutation = useMutation({
    mutationFn: async (newOutput: Omit<ProductOutput, 'id'>) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newOutput)
      });
      if (!r.ok) throw new Error("Error creating output");
      const text = await r.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => { toast({ title: "Output añadido" }); refetchOutputs(); },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch(`https://api.easyquote.cloud/api/v1/products/prompts/${promptId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error("Error");
    },
    onSuccess: () => { toast({ title: "Prompt eliminado" }); refetchPrompts(); },
  });

  const deleteOutputMutation = useMutation({
    mutationFn: async (outputId: string) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch(`https://api.easyquote.cloud/api/v1/products/outputs/${outputId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error("Error");
    },
    onSuccess: () => { toast({ title: "Output eliminado" }); refetchOutputs(); },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (updatedPrompt: ProductPrompt) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedPrompt)
      });
      if (!r.ok) throw new Error("Error");
      return { success: true };
    },
    onSuccess: () => { refetchPrompts(); },
  });

  const updateOutputMutation = useMutation({
    mutationFn: async (updatedOutput: ProductOutput) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const r = await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedOutput)
      });
      if (!r.ok) throw new Error("Error");
      return { success: true, updatedOutput };
    },
    onSuccess: (_, updatedOutput) => {
      queryClient.setQueryData(["product-outputs", productId], (old: ProductOutput[] | undefined) => {
        if (!old) return old;
        return old.map(o => o.id === updatedOutput.id ? { ...o, ...updatedOutput } : o);
      });
    },
  });

  // Marcar/desmarcar un prompt como selector de subproducto.
  // Solo un prompt por (api_user_id, easyquote_product_id) puede ser selector
  // (constraint a nivel BD). Esta mutación primero limpia cualquier otro y
  // luego upserta el flag para el prompt indicado.
  const setSubproductSelectorMutation = useMutation({
    mutationFn: async ({ promptKey, value }: { promptKey: string; value: boolean }) => {
      if (!apiUserId || !organizationId || !productId) throw new Error("Missing context");
      const cleanKey = String(promptKey).replace(/\$/g, "").trim();

      // 1) Limpiar cualquier otro selector existente para este producto
      if (value) {
        await supabase
          .from("product_prompt_settings")
          .update({ is_subproduct_selector: false, updated_at: new Date().toISOString() })
          .eq("api_user_id", apiUserId)
          .eq("easyquote_product_id", productId)
          .eq("is_subproduct_selector", true);
      }

      // 2) Buscar setting existente para este prompt
      const existing = (promptSettings as any[])?.find(
        (s) => s.api_user_id === apiUserId && s.easyquote_product_id === productId && String(s.prompt_name).replace(/\$/g, "").trim() === cleanKey
      );

      if (existing) {
        const { error } = await supabase
          .from("product_prompt_settings")
          .update({ is_subproduct_selector: value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_prompt_settings").insert({
          api_user_id: apiUserId,
          organization_id: organizationId,
          easyquote_product_id: productId,
          prompt_name: cleanKey,
          is_subproduct_selector: value,
        });
        if (error) throw error;
      }
      return { promptKey: cleanKey, value };
    },
    onSuccess: async (res) => {
      await refetchPromptSettings();
      toast({
        title: res.value ? "Selector de subproducto activado" : "Selector de subproducto desactivado",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ product, action }: { product: EasyQuoteProduct; action?: 'delete' | 'update' }) => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token");
      const payload = {
        id: product.id, productName: product.productName,
        isActive: product.isActive, description: product.description || "",
        category: product.category || "", excelfileId: product.excelfileId
      };
      const { data, error } = await invokeEasyQuoteFunction("easyquote-update-product", { token, product: payload, action });
      if (error) throw new Error(error.message || "Error al actualizar");
      if (!data?.success) throw new Error(data?.error || "Error");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Producto actualizado", description: "El producto se ha actualizado correctamente." });
      queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      navigate("/admin/productos");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handlers
  const handleSaveProduct = async () => {
    if (!selectedProduct) return;

    if (selectedCategoryId || selectedSubcategoryId) {
      upsertCategoryMapping.mutate({
        easyquote_product_id: selectedProduct.id,
        product_name: selectedProduct.productName,
        category_id: selectedCategoryId || undefined,
        subcategory_id: selectedSubcategoryId || undefined,
      });
    }

    const labelsToSave = Object.entries(promptLabelDrafts);
    for (const [promptName, label] of labelsToSave) {
      await upsertPromptSettingMutation.mutateAsync({ productId: selectedProduct.id, promptName, label });
    }
    if (labelsToSave.length > 0) setPromptLabelDrafts({});

    const outputLabelsToSave = Object.entries(outputLabelDrafts);
    for (const [outputName, label] of outputLabelsToSave) {
      await upsertPromptSettingMutation.mutateAsync({ productId: selectedProduct.id, promptName: outputName, label });
    }
    if (outputLabelsToSave.length > 0) setOutputLabelDrafts({});

    const totalLabelsSaved = labelsToSave.length + outputLabelsToSave.length;
    if (totalLabelsSaved > 0) {
      toast({ title: "Etiquetas guardadas", description: `Se han guardado ${totalLabelsSaved} etiqueta${totalLabelsSaved !== 1 ? 's' : ''} correctamente.` });
    }

    const action = selectedProduct.isActive ? "update" : "delete";
    updateProductMutation.mutate({ product: selectedProduct, action });
  };

  const handleDeleteProduct = () => {
    if (selectedProduct) {
      updateProductMutation.mutate({ product: { ...selectedProduct, isActive: false }, action: 'delete' });
      setIsDeleteProductDialogOpen(false);
    }
  };

  const addNewPrompt = () => {
    if (!selectedProduct || !promptTypes.length) return;
    const nextSeq = productPrompts.length === 0 ? 1 : Math.max(...productPrompts.map((p: any) => p.promptSeq || 0)) + 1;
    setNewPromptData({
      promptSheet: "", promptCell: "", valueSheet: "", valueCell: "",
      valueOptionSheet: "", valueOptionRange: "",
      promptType: promptTypes[0]?.id || 0, valueRequired: false,
      valueQuantityAllowedDecimals: 0, valueQuantityMin: 0, valueQuantityMax: 9999,
      promptSeq: nextSeq, component: "general"
    });
    setIsNewPromptDialogOpen(true);
  };

  const createNewPrompt = () => {
    if (!selectedProduct) return;
    if (!validateCellRef(newPromptData.promptCell, "Rótulo")) return;
    if (!validateCellRef(newPromptData.valueCell, "Valor")) return;

    const nextSeq = productPrompts.length === 0 ? 1 : Math.max(...productPrompts.map((p: any) => p.promptSeq || 0)) + 1;
    const pType = promptTypes.find((t: PromptType) => t.id === newPromptData.promptType);
    const isNumericType = pType?.promptType === "Number" || pType?.promptType === "Quantity";
    const sheetToUse = newPromptData.promptSheet;

    createPromptMutation.mutate({
      productId: selectedProduct.id, promptSeq: newPromptData.promptSeq,
      promptType: newPromptData.promptType, promptSheet: sheetToUse,
      promptCell: newPromptData.promptCell, valueSheet: sheetToUse,
      valueCell: newPromptData.valueCell, valueOptionSheet: sheetToUse,
      valueOptionRange: newPromptData.valueOptionRange,
      valueRequired: newPromptData.valueRequired,
      valueQuantityAllowedDecimals: isNumericType ? newPromptData.valueQuantityAllowedDecimals ?? 0 : null,
      valueQuantityMin: isNumericType ? newPromptData.valueQuantityMin ?? 0 : null,
      valueQuantityMax: isNumericType ? newPromptData.valueQuantityMax ?? 9999 : null,
    }, {
      onSuccess: () => {
        const promptKey = String(newPromptData.promptCell ?? "").replace(/\$/g, "").trim().toUpperCase();
        if (isComposite && newPromptData.component && newPromptData.component !== "general" && promptKey) {
          assignPromptToComponent({ easyquote_product_id: selectedProduct.id, prompt_name: promptKey, component: newPromptData.component });
        }
      }
    });
    setIsNewPromptDialogOpen(false);
    setNewPromptData(prev => ({ ...prev, component: "general" }));
  };

  const addNewOutput = () => {
    if (!selectedProduct || !outputTypes.length) return;
    const preferredDatos = excelSheets.find(s => String(s).toLowerCase().trim() === "datos");
    const defaultSheet = newOutputData.sheet || preferredDatos || excelSheets[0] || "";
    setNewOutputData({ sheet: defaultSheet, prompt: "", defaultValue: "", outputTypeId: outputTypes[0]?.id || 0, component: isComposite ? newOutputData.component || "general" : "general" });
    setIsNewOutputDialogOpen(true);
  };

  const createNewOutput = () => {
    if (!selectedProduct) return;
    createOutputMutation.mutate({
      productId: selectedProduct.id, outputTypeId: newOutputData.outputTypeId,
      sheet: newOutputData.sheet, nameCell: newOutputData.prompt, valueCell: newOutputData.defaultValue,
    }, {
      onSuccess: () => {
        if (isComposite && newOutputData.component && newOutputData.prompt) {
          assignPromptToComponent({ easyquote_product_id: selectedProduct.id, prompt_name: newOutputData.prompt, component: newOutputData.component });
        }
      }
    });
    setIsNewOutputDialogOpen(false);
    setNewOutputData(prev => ({ ...prev, prompt: "", defaultValue: "" }));
  };

  const handleBulkSavePrompts = async (prompts: any[]) => {
    if (!selectedProduct) return;
    try {
      for (const promptData of prompts) {
        if (!validateCellRef(promptData.promptCell, "Rótulo") || !validateCellRef(promptData.valueCell, "Valor")) continue;
        const pType = promptTypes.find((t: PromptType) => t.id === promptData.promptType);
        const isNumericType = pType?.promptType === "Number" || pType?.promptType === "Quantity";
        const result = await createPromptMutation.mutateAsync({
          productId: selectedProduct.id, promptSeq: promptData.promptSeq,
          promptType: promptData.promptType, promptSheet: promptData.sheet,
          promptCell: promptData.promptCell, valueSheet: promptData.sheet,
          valueCell: promptData.valueCell, valueOptionSheet: promptData.sheet,
          valueOptionRange: promptData.valueOptionRange, valueRequired: promptData.valueRequired,
          valueQuantityAllowedDecimals: isNumericType ? promptData.valueQuantityAllowedDecimals ?? 0 : null,
          valueQuantityMin: isNumericType ? promptData.valueQuantityMin ?? 1 : null,
          valueQuantityMax: isNumericType ? promptData.valueQuantityMax ?? 9999 : null,
        });

        const createdPromptKey = String(promptData.promptCell ?? result?.promptCell ?? "").replace(/\$/g, "").trim().toUpperCase();
        if (isComposite && promptData.component && promptData.component !== "general" && createdPromptKey) {
          await assignPromptToComponent({ easyquote_product_id: selectedProduct.id, prompt_name: createdPromptKey, component: promptData.component });
        }

        const isAdminOnly = !!promptData.adminOnly;
        const hasSettings = promptData.hideInDocuments || promptData.forceResult || isAdminOnly;
        if (hasSettings && createdPromptKey && apiUserId) {
          await supabase.from("product_prompt_settings").upsert({
            api_user_id: apiUserId, organization_id: organizationId,
            easyquote_product_id: selectedProduct.id, prompt_name: createdPromptKey,
            hide_in_documents: isAdminOnly ? true : !!promptData.hideInDocuments,
            force_result: isAdminOnly ? true : !!promptData.forceResult,
            admin_only: isAdminOnly,
          }, { onConflict: "api_user_id,easyquote_product_id,prompt_name" });
        }
      }
      await refetchPromptSettings();
      queryClient.invalidateQueries({ queryKey: ['product-prompt-components', selectedProduct.id] });
      setIsBulkPromptsDialogOpen(false);
      toast({ title: "Éxito", description: `Se crearon ${prompts.length} datos de entrada correctamente.` });
    } catch {
      toast({ title: "Error", description: "Error al crear los datos de entrada", variant: "destructive" });
    }
  };

  const handleBulkSaveOutputs = async (outputs: any[]) => {
    if (!selectedProduct) return;
    try {
      for (const outputData of outputs) {
        const result = await createOutputMutation.mutateAsync({
          productId: selectedProduct.id, outputTypeId: outputData.outputTypeId,
          sheet: outputData.sheet, nameCell: outputData.nameCell, valueCell: outputData.valueCell,
        });
        const createdOutputKey = String(outputData.nameCell ?? result?.nameCell ?? "").replace(/\$/g, "").trim().toUpperCase();
        if (isComposite && outputData.component && outputData.component !== "general" && createdOutputKey) {
          await assignPromptToComponent({ easyquote_product_id: selectedProduct.id, prompt_name: createdOutputKey, component: outputData.component });
        }
      }
      setIsBulkOutputsDialogOpen(false);
      toast({ title: "Éxito", description: `Se crearon ${outputs.length} datos de salida correctamente.` });
    } catch {
      toast({ title: "Error", description: "Error al crear los datos de salida", variant: "destructive" });
    }
  };

  // Loading state
  if (isLoadingProducts || !selectedProduct) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Acceso denegado</AlertTitle></Alert>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/productos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate !text-xl font-bold lg:!text-2xl" style={{ lineHeight: 1.2 }}>
            {selectedProduct.productName}
          </h1>
          <p className="!text-sm text-muted-foreground" style={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
            Configuración del producto
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => setIsDeleteProductDialogOpen(true)} disabled={updateProductMutation.isPending}>
            <Trash2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Eliminar</span>
          </Button>
          <Button onClick={handleSaveProduct} disabled={updateProductMutation.isPending}>
            {updateProductMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : <>
              <Save className="h-4 w-4 mr-2" />Guardar cambios
            </>}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className={`grid w-full ${productType === 'sencillo' ? 'grid-cols-3' : 'grid-cols-4'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="prompts">Datos de entrada ({productPrompts.length})</TabsTrigger>
          <TabsTrigger value="outputs">Datos de salida ({productOutputs.length})</TabsTrigger>
          {productType === 'compuesto' && <TabsTrigger value="composite-config">Componentes</TabsTrigger>}
        </TabsList>

        {/* TAB: General */}
        <TabsContent value="general" className="space-y-4 mt-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="productName">Nombre del producto</Label>
                  <Input id="productName" value={selectedProduct.productName} onChange={e => setSelectedProduct({ ...selectedProduct, productName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="excelFile">Archivo Excel (Calculadora)</Label>
                  <Select value={selectedProduct.excelfileId || "none"} onValueChange={async value => {
                    const newExcelId = value === "none" ? undefined : value;
                    setSelectedProduct({ ...selectedProduct, excelfileId: newExcelId });
                    if (newExcelId) {
                      const token = sessionStorage.getItem("easyquote_token");
                      if (token) {
                        try {
                          const { data, error } = await supabase.functions.invoke("easyquote-excel-files", { body: { token, fileId: newExcelId } });
                          if (!error && data?.excelfilesSheets) {
                            setExcelSheets(data.excelfilesSheets.map((s: any) => s.sheetName).sort());
                          } else { setExcelSheets([]); }
                        } catch { setExcelSheets([]); }
                      }
                    } else { setExcelSheets([]); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar archivo Excel..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin archivo Excel</SelectItem>
                      {availableExcelFiles.map(file => <SelectItem key={file.id} value={file.id}>{file.fileName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" value={selectedProduct.description || ""} onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label>Categoría</Label>
                  <Select value={selectedCategoryId || "none"} onValueChange={value => { setSelectedCategoryId(value === "none" ? "" : value); setSelectedSubcategoryId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {allCategories.filter(cat => cat.is_active).map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span>{cat.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de producto</Label>
                  <Select value={productType} onValueChange={async (value: 'sencillo' | 'compuesto' | 'kit') => {
                    if (value === 'kit') return;
                    setProductType(value);
                    if (selectedProduct) {
                      try {
                        await upsertComponentSettings({
                          easyquote_product_id: selectedProduct.id,
                          is_composite: value === 'compuesto',
                          enabled_components: value === 'compuesto' ? (enabledComponents.length > 0 ? enabledComponents : []) : [],
                          product_type: value
                        });
                      } catch {}
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sencillo">Sencillo</SelectItem>
                      <SelectItem value="compuesto">Compuesto</SelectItem>
                      <SelectItem value="kit" disabled className="text-muted-foreground">Kit <span className="ml-2 text-xs">(próximamente)</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-2">
                <div className="flex items-center space-x-2">
                  <Switch id="isActive" checked={selectedProduct.isActive} onCheckedChange={checked => setSelectedProduct({ ...selectedProduct, isActive: checked })} />
                  <Label htmlFor="isActive">Producto activo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="hasImposition" checked={componentSettings?.has_imposition ?? false} onCheckedChange={async (checked) => {
                    if (selectedProduct) {
                      try {
                        await upsertComponentSettings({ easyquote_product_id: selectedProduct.id, has_imposition: checked });
                        toast({ title: checked ? "Imposición activada" : "Imposición desactivada" });
                      } catch {}
                    }
                  }} />
                  <Label htmlFor="hasImposition">Imposición automática</Label>
                </div>
              </div>

              {selectedCategoryId && (
                <div className="max-w-xs">
                  <Label>Subcategoría</Label>
                  <Select value={selectedSubcategoryId || "none"} onValueChange={value => setSelectedSubcategoryId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Sin subcategoría" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin subcategoría</SelectItem>
                      {allSubcategories.filter(sub => sub.category_id === selectedCategoryId && sub.is_active).map(sub => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Prompts */}
        <TabsContent value="prompts" className="space-y-4 mt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Datos de entrada del Producto</h3>
              <p className="text-sm text-muted-foreground">Gestiona los campos de entrada para este producto</p>
            </div>
            <div className="flex gap-2">
              {productPrompts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (expandedPrompts.size === productPrompts.length) {
                      setExpandedPrompts(new Set());
                    } else {
                      setExpandedPrompts(new Set(productPrompts.map((p: any) => p.id)));
                    }
                  }}
                >
                  <ChevronsUpDown className="h-4 w-4 mr-2" />
                  {expandedPrompts.size === productPrompts.length ? "Colapsar" : "Expandir"} todos
                </Button>
              )}
              <Button onClick={addNewPrompt} size="sm" variant="outline"><Plus className="h-4 w-4 mr-2" />Añadir uno</Button>
              <Button onClick={() => setIsBulkPromptsDialogOpen(true)} size="sm"><Layers className="h-4 w-4 mr-2" />Añadir Varios</Button>
            </div>
          </div>

          {promptsLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /><p className="text-sm text-muted-foreground mt-2">Cargando datos entrada...</p></div>
          ) : productPrompts.length === 0 ? (
            <div className="text-center py-8"><Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">No hay datos de entrada configurados</p></div>
          ) : (
            <div className="space-y-2">
              {productPrompts.map((prompt: any, index: number) => {
                const promptLabel = prompt?.promptText;
                const promptAliases = [prompt.promptCell, promptLabel, prompt.id];
                const promptSettingKey = prompt.promptCell || promptLabel || prompt.id;
                const promptName = prompt.promptCell || prompt.id;
                const assignedComponent = getPromptComponent(promptName);
                const componentLabel = assignedComponent === 'general' ? 'General' : COMPONENT_PRESETS.compuesto.components.find(c => c.value === assignedComponent)?.label || assignedComponent;
                const currentPromptType = promptTypes.find((type: PromptType) => type.id === prompt.promptType);
                const isNumericType = currentPromptType?.promptType === "Number" || currentPromptType?.promptType === "Quantity";
                const isExpanded = expandedPrompts.has(prompt.id);
                const displayLabel = promptLabelDrafts[prompt.promptCell] ?? getPromptLabel(...promptAliases) ?? promptLabel ?? prompt.promptCell;
                const cellsText = `${prompt.promptCell || '?'}→${prompt.valueCell || '?'}`;

                // Collect active flags for badges
                const activeFlags: { icon: React.ReactNode; label: string }[] = [];
                if (prompt.valueRequired) activeFlags.push({ icon: <Lock className="h-3 w-3" />, label: "Requerido" });
                if (isPromptHiddenInDocuments(...promptAliases)) activeFlags.push({ icon: <FileText className="h-3 w-3" />, label: "Oculto docs" });
                if (isPromptAdminOnly(...promptAliases)) activeFlags.push({ icon: <ShieldCheck className="h-3 w-3" />, label: "Admin" });
                if (isPromptHidden(...promptAliases)) activeFlags.push({ icon: <EyeOff className="h-3 w-3" />, label: "Oculto" });
                if (isPromptQuantity(...promptAliases)) activeFlags.push({ icon: <Hash className="h-3 w-3" />, label: "Cantidad" });
                if (isPromptInOt(...promptAliases)) activeFlags.push({ icon: <ClipboardList className="h-3 w-3" />, label: "OT" });

                return (
                  <Collapsible
                    key={prompt.id}
                    open={isExpanded}
                    onOpenChange={(open) => {
                      setExpandedPrompts(prev => {
                        const next = new Set(prev);
                        if (open) next.add(prompt.id); else next.delete(prompt.id);
                        return next;
                      });
                    }}
                  >
                    <div className="border rounded-lg bg-background">
                      {/* Collapsed summary header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-3 flex-1 min-w-0 text-left text-base leading-6 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors" type="button">
                            <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <span className="text-xs font-mono text-muted-foreground w-6">#{prompt.promptSeq}</span>
                            <span className="font-medium text-base leading-6 min-w-0 break-words">{displayLabel}</span>
                            <span className="text-sm leading-5 font-mono text-muted-foreground shrink-0">({cellsText})</span>
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0 bg-secondary text-secondary-foreground">{currentPromptType?.promptType || '?'}</span>
                            {prompt.promptSheet && <span className="text-sm text-muted-foreground hidden sm:inline">· {prompt.promptSheet}</span>}
                            {activeFlags.length > 0 && (
                              <div className="flex items-center gap-1 ml-auto">
                                {activeFlags.map((flag, i) => (
                                  <TooltipProvider key={i}><Tooltip><TooltipTrigger asChild>
                                    <span className="text-muted-foreground">{flag.icon}</span>
                                  </TooltipTrigger><TooltipContent>{flag.label}</TooltipContent></Tooltip></TooltipProvider>
                                ))}
                              </div>
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { updatePromptMutation.mutate({ ...prompt, valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals ?? 0 : null, valueQuantityMin: isNumericType ? prompt.valueQuantityMin ?? 0 : null, valueQuantityMax: isNumericType ? prompt.valueQuantityMax ?? 9999 : null }); }}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePromptMutation.mutate(prompt.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded content */}
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-4 border-t">
                          {/* Section 1: Excel Config */}
                          <div className="pt-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Configuración Excel</p>
                            <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-2">
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs">Hoja</Label>
                                  {sheetInconsistencies.inconsistentPrompts.has(prompt.id) && (
                                    <TooltipProvider><Tooltip><TooltipTrigger asChild><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /></TooltipTrigger>
                                      <TooltipContent><p className="max-w-xs">Hoja diferente al resto ({sheetInconsistencies.dominantSheet})</p></TooltipContent>
                                    </Tooltip></TooltipProvider>
                                  )}
                                </div>
                                <Select value={prompt.promptSheet || ""} onValueChange={value => {
                                  updatePromptMutation.mutate({
                                    ...prompt, promptSheet: value, valueSheet: value, valueOptionSheet: value,
                                    valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null,
                                    valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null,
                                    valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null,
                                  });
                                }}>
                                  <SelectTrigger className={`h-9 ${sheetInconsistencies.inconsistentPrompts.has(prompt.id) ? "border-amber-500" : ""}`}>
                                    <SelectValue placeholder={prompt.promptSheet || "Hoja"} />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    {prompt.promptSheet && !excelSheets.includes(prompt.promptSheet) && <SelectItem value={prompt.promptSheet}>{prompt.promptSheet}</SelectItem>}
                                    {excelSheets.map((sheet: string) => <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-1">
                                <Label className="text-xs">Rótulo</Label>
                                <Input className="h-9" defaultValue={prompt.promptCell} onBlur={e => {
                                  if (!validateCellRef(e.target.value, "Rótulo")) { e.target.value = prompt.promptCell; return; }
                                  updatePromptMutation.mutate({ ...prompt, promptCell: e.target.value, valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null, valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null, valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null });
                                }} />
                              </div>
                              <div className="col-span-1">
                                <Label className="text-xs">Valor</Label>
                                <Input className="h-9" defaultValue={prompt.valueCell || ""} onBlur={e => {
                                  if (!validateCellRef(e.target.value, "Valor")) { e.target.value = prompt.valueCell || ""; return; }
                                  updatePromptMutation.mutate({ ...prompt, valueCell: e.target.value, valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null, valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null, valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null });
                                }} />
                              </div>
                              <div className="col-span-1">
                                <Label className="text-xs">Orden</Label>
                                <Input className="h-9" type="number" defaultValue={prompt.promptSeq} onBlur={e => {
                                  updatePromptMutation.mutate({ ...prompt, promptSeq: parseInt(e.target.value), valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null, valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null, valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null });
                                }} />
                              </div>
                              {!isNumericType && (
                                <div className="col-span-2">
                                  <Label className="text-xs">Rango</Label>
                                  <Input className="h-9" defaultValue={prompt.valueOptionRange || ""} placeholder="$E$2:$E$3" onBlur={e => {
                                    updatePromptMutation.mutate({ ...prompt, valueOptionRange: e.target.value.replace(/^=/, ''), valueQuantityAllowedDecimals: null, valueQuantityMin: null, valueQuantityMax: null });
                                  }} />
                                </div>
                              )}
                              <div className="col-span-2">
                                <Label className="text-xs">Tipo</Label>
                                <Select value={prompt.promptType?.toString() || ""} onValueChange={value => {
                                  const newType = parseInt(value);
                                  const newPT = promptTypes.find((t: PromptType) => t.id === newType);
                                  const isNew = newPT?.promptType === "Number" || newPT?.promptType === "Quantity";
                                  updatePromptMutation.mutate({ ...prompt, promptType: newType, valueQuantityAllowedDecimals: isNew ? prompt.valueQuantityAllowedDecimals : null, valueQuantityMin: isNew ? prompt.valueQuantityMin : null, valueQuantityMax: isNew ? prompt.valueQuantityMax : null });
                                }}>
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    {promptTypes.map((type: PromptType) => <SelectItem key={type.id} value={type.id?.toString() || "0"}>{type.promptType}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              {isNumericType && (
                                <>
                                  <div className="col-span-1"><Label className="text-xs">Decs.</Label><Input className="h-9" type="number" defaultValue={prompt.valueQuantityAllowedDecimals ?? 0} onBlur={e => { updatePromptMutation.mutate({ ...prompt, valueQuantityAllowedDecimals: e.target.value === '' ? 0 : parseInt(e.target.value), valueQuantityMin: prompt.valueQuantityMin ?? 0, valueQuantityMax: prompt.valueQuantityMax ?? 9999 }); }} /></div>
                                  <div className="col-span-1"><Label className="text-xs">Mínimo</Label><Input className="h-9" type="number" step="any" defaultValue={prompt.valueQuantityMin ?? 0} onBlur={e => { updatePromptMutation.mutate({ ...prompt, valueQuantityMin: e.target.value === '' ? 0 : parseFloat(e.target.value), valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals ?? 0, valueQuantityMax: prompt.valueQuantityMax ?? 9999 }); }} /></div>
                                  <div className="col-span-2"><Label className="text-xs">Máximo</Label><Input className="h-9" type="number" step="any" defaultValue={prompt.valueQuantityMax ?? 9999} onBlur={e => { updatePromptMutation.mutate({ ...prompt, valueQuantityMax: e.target.value === '' ? 9999 : parseFloat(e.target.value), valueQuantityAllowedDecimals: prompt.valueQuantityAllowedDecimals ?? 0, valueQuantityMin: prompt.valueQuantityMin ?? 0 }); }} /></div>
                                </>
                              )}
                              {!isNumericType && <div className="col-span-3"></div>}
                            </div>
                          </div>

                          {/* Section 2: Visibility & Behavior */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Visibilidad y comportamiento</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                              <div className="flex items-center gap-2">
                                <Checkbox id={`req-${prompt.id}`} checked={prompt.valueRequired} onCheckedChange={(checked: boolean) => { updatePromptMutation.mutate({ ...prompt, valueRequired: checked, valueQuantityAllowedDecimals: isNumericType ? prompt.valueQuantityAllowedDecimals : null, valueQuantityMin: isNumericType ? prompt.valueQuantityMin : null, valueQuantityMax: isNumericType ? prompt.valueQuantityMax : null }); }} />
                                <Label htmlFor={`req-${prompt.id}`} className="text-sm cursor-pointer">Requerido</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox id={`hdoc-${prompt.id}`} checked={isPromptHiddenInDocuments(...promptAliases)} onCheckedChange={(checked: boolean) => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, hideInDocuments: checked }); }} />
                                <Label htmlFor={`hdoc-${prompt.id}`} className="text-sm cursor-pointer">Ocultar en docs.</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox id={`admin-${prompt.id}`} checked={isPromptAdminOnly(...promptAliases)} onCheckedChange={(checked: boolean) => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, adminOnly: checked }); }} />
                                <Label htmlFor={`admin-${prompt.id}`} className="text-sm cursor-pointer">Solo admin</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox id={`force-${prompt.id}`} checked={isPromptForceResult(...promptAliases)} onCheckedChange={(checked: boolean) => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, forceResult: checked }); }} />
                                <Label htmlFor={`force-${prompt.id}`} className="text-sm cursor-pointer">Opc. restrictiva</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox id={`hidden-${prompt.id}`} checked={isPromptHidden(...promptAliases)} onCheckedChange={(checked: boolean) => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, isHidden: checked }); }} />
                                <Label htmlFor={`hidden-${prompt.id}`} className="text-sm cursor-pointer">Oculto</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox id={`qty-${prompt.id}`} checked={isPromptQuantity(...promptAliases)} onCheckedChange={(checked: boolean) => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, isQuantity: checked, label: checked ? (promptLabel || promptSettingKey) : undefined }); }} />
                                <Label htmlFor={`qty-${prompt.id}`} className="text-sm cursor-pointer">Cantidad</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox id={`ot-${prompt.id}`} checked={isPromptInOt(...promptAliases)} onCheckedChange={(checked: boolean) => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, showInOt: checked, otSection: checked ? (getPromptOtSection(...promptAliases) || 'datos_destacados') : null }); }} />
                                <Label htmlFor={`ot-${prompt.id}`} className="text-sm cursor-pointer">Mostrar en OT</Label>
                              </div>
                              {isPromptInOt(...promptAliases) && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm whitespace-nowrap">Sección OT</Label>
                                  <Select value={getPromptOtSection(...promptAliases) || "datos_destacados"} onValueChange={value => { upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, otSection: value }); }}>
                                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-background border shadow-lg z-50">
                                      <SelectItem value="datos_destacados">Datos destacados</SelectItem>
                                      <SelectItem value="impresion">Impresión</SelectItem>
                                      <SelectItem value="acabados">Acabados</SelectItem>
                                      <SelectItem value="imposiciones">Imposiciones</SelectItem>
                                      <SelectItem value="ajustes">Ajustes</SelectItem>
                                      <SelectItem value="observaciones">Observaciones</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {!isPromptHiddenInDocuments(...promptAliases) && !isPromptAdminOnly(...promptAliases) && (
                                <div className="flex items-center gap-2 col-span-2 sm:col-span-3 lg:col-span-2">
                                  <Label htmlFor={`hwv-${prompt.id}`} className="text-sm whitespace-nowrap" title='Si el valor del campo coincide con este texto, no se muestra en documentos. Ej: "0", "sin plastificar".'>
                                    No mostrar si valor =
                                  </Label>
                                  <Input
                                    id={`hwv-${prompt.id}`}
                                    className="h-8 flex-1"
                                    placeholder='ej: 0, sin plastificar'
                                    defaultValue={getPromptHideWhenValue(...promptAliases)}
                                    key={`hwv-${prompt.id}-${getPromptHideWhenValue(...promptAliases)}`}
                                    onBlur={(e) => {
                                      const newVal = e.target.value;
                                      const current = getPromptHideWhenValue(...promptAliases);
                                      if (newVal === current) return;
                                      upsertPromptSettingMutation.mutate({ productId: selectedProduct.id, promptName: promptSettingKey, hideWhenValue: newVal });
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Section 3: Labels & Mappings */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Etiquetas y mapeos</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs">Etiqueta personalizada</Label>
                                <Input className="h-9 mt-1" placeholder="Nombre descriptivo"
                                  value={promptLabelDrafts[prompt.promptCell] ?? getPromptLabel(...promptAliases) ?? prompt.promptText ?? ""}
                                  onChange={e => { setPromptLabelDrafts(prev => ({ ...prev, [prompt.promptCell]: e.target.value })); }} />
                              </div>
                              <div>
                                <Label className="text-xs">Variable de producción</Label>
                                <Select value={getMappedVariableId(prompt.promptCell) || "none"} onValueChange={value => {
                                  upsertVariableMapping({ easyquoteProductId: selectedProduct.id, productName: selectedProduct.productName, promptOrOutputName: prompt.promptCell, variableId: value === "none" ? null : value });
                                }}>
                                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Sin variable" /></SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    <SelectItem value="none">Sin variable asignada</SelectItem>
                                    {productionVariables.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB: Outputs */}
        <TabsContent value="outputs" className="space-y-4 mt-6">
          {(() => {
            const priceOutputs = productOutputs.filter((o: any) => {
              const typeName = outputTypes.find((t: OutputType) => t.id === o.outputTypeId)?.outputType?.toLowerCase();
              return typeName === 'price';
            });
            if (priceOutputs.length !== 1) {
              return (
                <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="text-lg font-bold">⚠️ Configuración de precio incorrecta</AlertTitle>
                  <AlertDescription className="text-base mt-2">
                    {priceOutputs.length > 1 ? (
                      <span>Este producto tiene <strong>{priceOutputs.length} datos de salida de tipo PRICE</strong>. Solo debe tener <strong>exactamente uno</strong>.</span>
                    ) : (
                      <span>Este producto <strong>no tiene ningún dato de salida de tipo PRICE</strong>. Debes añadir <strong>exactamente uno</strong>.</span>
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
              <p className="text-sm text-muted-foreground">Gestiona los campos de salida para este producto</p>
            </div>
            <div className="flex gap-2">
              {productOutputs.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => {
                  if (expandedOutputs.size === productOutputs.length) setExpandedOutputs(new Set());
                  else setExpandedOutputs(new Set(productOutputs.map((o: any) => o.id)));
                }}>
                  <ChevronsUpDown className="h-4 w-4 mr-2" />
                  {expandedOutputs.size === productOutputs.length ? "Colapsar" : "Expandir"} todos
                </Button>
              )}
              <Button onClick={addNewOutput} size="sm" variant="outline"><Plus className="h-4 w-4 mr-2" />Añadir uno</Button>
              <Button onClick={() => setIsBulkOutputsDialogOpen(true)} size="sm"><Layers className="h-4 w-4 mr-2" />Añadir Varios</Button>
            </div>
          </div>

          {outputsLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : productOutputs.length === 0 ? (
            <div className="text-center py-8"><Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">No hay datos de salida configurados</p></div>
          ) : (
            <div className="space-y-6">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedProductOutputs.map((o: any) => o.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {orderedProductOutputs.map((output: any, index: number) => (
                      <SortableOutputItem
                        key={output.id} output={output} index={index} excelSheets={excelSheets}
                        outputTypes={outputTypes} onUpdate={(u) => updateOutputMutation.mutate(u)}
                        onDelete={(id) => deleteOutputMutation.mutate(id)}
                        getMappedVariableId={getMappedVariableId} getMappedNames={getMappedNames}
                        upsertVariableMapping={upsertVariableMapping} productionVariables={productionVariables}
                        selectedProduct={selectedProduct}
                        labelValue={outputLabelDrafts[output.nameCell] ?? getPromptLabel(output.nameCell) ?? ""}
                        onLabelChange={(value) => setOutputLabelDrafts(prev => ({ ...prev, [output.nameCell]: value }))}
                        isOutputInOt={checkOutputInOt(output.nameCell)}
                        getOutputOtSection={checkOutputOtSection(output.nameCell)}
                        onOtToggle={(checked) => upsertOutputOtSetting({ output_name: output.nameCell, label: outputLabelDrafts[output.nameCell] ?? getPromptLabel(output.nameCell) ?? output.nameCell, show_in_ot: checked, ot_section: checked ? (checkOutputOtSection(output.nameCell) || 'datos_destacados') : null })}
                        onOtSectionChange={(section) => upsertOutputOtSetting({ output_name: output.nameCell, label: outputLabelDrafts[output.nameCell] ?? getPromptLabel(output.nameCell) ?? output.nameCell, show_in_ot: true, ot_section: section })}
                        isExpanded={expandedOutputs.has(output.id)}
                        onToggle={(open) => setExpandedOutputs(prev => { const next = new Set(prev); if (open) next.add(output.id); else next.delete(output.id); return next; })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </TabsContent>

        {/* TAB: Composite config */}
        {productType === 'compuesto' && (
          <TabsContent value="composite-config" className="space-y-4 mt-6">
            <CompositeProductConfig
              easyquoteProductId={selectedProduct.id}
              productName={selectedProduct.productName}
              availableProducts={allProducts.map(p => ({ id: p.id, name: p.productName }))}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* New Prompt Dialog */}
      <Dialog open={isNewPromptDialogOpen} onOpenChange={setIsNewPromptDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Añadir nuevo dato de entrada</DialogTitle>
            <DialogDescription>Configura los datos del nuevo valor de entrada</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">
                <Label>Hoja</Label>
                <Select value={newPromptData.promptSheet || ""} onValueChange={value => setNewPromptData(prev => ({ ...prev, promptSheet: value }))}>
                  <SelectTrigger><SelectValue placeholder="Hoja" /></SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {excelSheets.map(sheet => <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Rótulo</Label>
                <Input value={newPromptData.promptCell} onChange={e => setNewPromptData({ ...newPromptData, promptCell: e.target.value })} placeholder="ej: B5" />
              </div>
              <div className="col-span-2">
                <Label>Valor</Label>
                <Input value={newPromptData.valueCell} onChange={e => setNewPromptData({ ...newPromptData, valueCell: e.target.value })} placeholder="ej: C5" />
              </div>
              <div className="col-span-2">
                <Label>Rango</Label>
                <Input value={newPromptData.valueOptionRange} onChange={e => setNewPromptData({ ...newPromptData, valueOptionRange: e.target.value })} placeholder="ej: $E$2:$E$10" />
              </div>
              <div className="col-span-2">
                <Label>Tipo</Label>
                <Select value={newPromptData.promptType.toString()} onValueChange={value => setNewPromptData({ ...newPromptData, promptType: parseInt(value) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {promptTypes.map((type: PromptType) => <SelectItem key={type.id} value={type.id.toString()}>{type.promptType}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label>Orden</Label>
                <Input type="number" value={newPromptData.promptSeq} onChange={e => setNewPromptData({ ...newPromptData, promptSeq: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="col-span-1 flex items-end">
                <div className="flex items-center gap-1">
                  <Switch checked={newPromptData.valueRequired} onCheckedChange={checked => setNewPromptData({ ...newPromptData, valueRequired: checked })} />
                  <Label className="text-xs">Req.</Label>
                </div>
              </div>
            </div>
            {(() => {
              const pt = promptTypes.find((t: PromptType) => t.id === newPromptData.promptType);
              const isNum = pt?.promptType === "Number" || pt?.promptType === "Quantity";
              if (!isNum) return null;
              return (
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Decimales</Label><Input type="number" value={newPromptData.valueQuantityAllowedDecimals} onChange={e => setNewPromptData({ ...newPromptData, valueQuantityAllowedDecimals: parseInt(e.target.value) || 0 })} /></div>
                  <div><Label>Mínimo</Label><Input type="number" value={newPromptData.valueQuantityMin} onChange={e => setNewPromptData({ ...newPromptData, valueQuantityMin: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label>Máximo</Label><Input type="number" value={newPromptData.valueQuantityMax} onChange={e => setNewPromptData({ ...newPromptData, valueQuantityMax: parseFloat(e.target.value) || 9999 })} /></div>
                </div>
              );
            })()}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsNewPromptDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createNewPrompt} disabled={!newPromptData.promptSheet}>Crear valor de entrada</Button>
          </div>
          {!newPromptData.promptSheet && <p className="text-sm text-destructive mt-2">⚠️ Debes seleccionar una hoja del Excel</p>}
        </DialogContent>
      </Dialog>

      {/* New Output Dialog */}
      <Dialog open={isNewOutputDialogOpen} onOpenChange={setIsNewOutputDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Añadir nuevo dato de salida</DialogTitle>
            <DialogDescription>Configura los datos del nuevo output</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Hoja</Label>
                <Select value={newOutputData.sheet || ""} onValueChange={value => setNewOutputData(prev => ({ ...prev, sheet: value }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar hoja" /></SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {excelSheets.map(sheet => <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Rótulo</Label><Input value={newOutputData.prompt} onChange={e => setNewOutputData({ ...newOutputData, prompt: e.target.value })} /></div>
              <div><Label>Valor por defecto</Label><Input value={newOutputData.defaultValue} onChange={e => setNewOutputData({ ...newOutputData, defaultValue: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={newOutputData.outputTypeId.toString()} onValueChange={value => setNewOutputData({ ...newOutputData, outputTypeId: parseInt(value) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {outputTypes.map((type: OutputType) => <SelectItem key={type.id} value={type.id.toString()}>{type.outputType}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsNewOutputDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createNewOutput} disabled={!newOutputData.sheet}>Crear Output</Button>
          </div>
          {!newOutputData.sheet && <p className="text-sm text-destructive mt-2">⚠️ Debes seleccionar una hoja del Excel</p>}
        </DialogContent>
      </Dialog>

      {/* Bulk Dialogs */}
      <BulkPromptsDialog open={isBulkPromptsDialogOpen} onOpenChange={setIsBulkPromptsDialogOpen} onSave={handleBulkSavePrompts} promptTypes={promptTypes} isSaving={createPromptMutation.isPending} existingPrompts={productPrompts} availableSheets={excelSheets} isComposite={isComposite} enabledComponents={enabledComponents} />
      <BulkOutputsDialog open={isBulkOutputsDialogOpen} onOpenChange={setIsBulkOutputsDialogOpen} onSave={handleBulkSaveOutputs} outputTypes={outputTypes} isSaving={createOutputMutation.isPending} existingOutputs={productOutputs} availableSheets={excelSheets} isComposite={isComposite} enabledComponents={enabledComponents} />

      {/* Delete Product Dialog */}
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
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
