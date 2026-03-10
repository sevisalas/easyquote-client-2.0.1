import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImpositionData, updateCalculatedValues } from "@/utils/impositionCalculator";
import { ImpositionModal } from "./ImpositionModal";
import { ImpositionScheme } from "./ImpositionScheme";

interface ComponentInfo {
  key: string;
  alias: string;
}

interface ImpositionSectionProps {
  item: {
    id: string;
    imposition_data?: any;
    composite_data?: any;
    observations?: any[];
    product_id?: string;
    prompts?: any;
    outputs?: any;
    organization_id?: string;
  };
  onStatusUpdate?: () => void;
}

const defaultImpositionData: ImpositionData = {
  productWidth: 210,
  productHeight: 297,
  bleed: 3,
  validWidth: 680,
  validHeight: 480,
  gutterH: 2,
  gutterV: 2,
};

function isSimpleImposition(data: any): data is ImpositionData {
  return data && typeof data.productWidth === 'number';
}

function ImpositionBlock({ imp, label, onEdit, onDelete }: { imp: ImpositionData; label?: string; onEdit: () => void; onDelete: () => void }) {
  if (!imp.repetitionsH || !imp.repetitionsV) return null;
  return (
    <div className="border border-border rounded-sm p-1.5 bg-background">
      {label && <p className="text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>}
      <div className="flex gap-2 items-center">
        <div className="flex-shrink-0">
          <ImpositionScheme data={imp} compact={true} />
        </div>
        <div className="text-[10px] leading-tight space-y-0">
          <p>{imp.productWidth}×{imp.productHeight} · Válido: {imp.validWidth}×{imp.validHeight}</p>
          <p>Sangr: {imp.bleed} · Calles: {imp.gutterH}×{imp.gutterV}</p>
          <p className="font-bold">{imp.repetitionsH}×{imp.repetitionsV}={imp.totalRepetitions}/pliego</p>
          {imp.utilization !== undefined && <p>Aprov: {imp.utilization.toFixed(1)}%</p>}
          <div className="flex gap-1 pt-0.5">
            <Button size="sm" variant="outline" onClick={onEdit} className="h-5 w-5 p-0">
              <Settings className="h-2.5 w-2.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="h-5 w-5 p-0">
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Resolve imposition defaults from production variable mappings.
 * Returns calculated ImpositionData if mappings exist, otherwise null.
 */
async function resolveImpositionFromMappings(
  productId: string,
  organizationId: string,
  prompts: any[],
  outputs: any[]
): Promise<ImpositionData | null> {
  try {
    // Fetch mappings and label translations in parallel
    const [mappingsResult, labelsResult] = await Promise.all([
      supabase
        .from("product_variable_mappings")
        .select(`
          prompt_or_output_name,
          production_variable_id,
          production_variables (
            imposition_field,
            default_value
          )
        `)
        .eq("easyquote_product_id", productId)
        .eq("organization_id", organizationId),
      supabase
        .from("product_prompt_settings")
        .select("prompt_name, label")
        .eq("easyquote_product_id", productId)
        .eq("organization_id", organizationId),
    ]);

    const impMappings = mappingsResult.data;
    if (!impMappings || impMappings.length === 0) return null;

    const impFieldMappings = impMappings.filter((m: any) => m.production_variables?.imposition_field);
    if (impFieldMappings.length === 0) return null;

    // Build cell→displayName lookup from product_prompt_settings
    const cellToLabel: Record<string, string> = {};
    for (const row of labelsResult.data || []) {
      if (row.prompt_name && row.label) {
        cellToLabel[row.prompt_name] = row.label;
      }
    }

    // When resolving from mappings, default bleed/gutter to 0
    // (the valid area already represents the usable print area)
    const impositionData: Record<string, number> = {
      productWidth: 210,
      productHeight: 297,
      bleed: 0,
      validWidth: 680,
      validHeight: 480,
      gutterH: 0,
      gutterV: 0,
    };

    for (const mapping of impFieldMappings) {
      const variable = mapping.production_variables as any;
      const field = variable.imposition_field;
      const cellName = mapping.prompt_or_output_name;
      const displayName = cellToLabel[cellName] || cellName;

      // Match by cell name OR display name against prompts and outputs
      const promptMatch = prompts.find((p: any) => p.label === cellName || p.label === displayName);
      const outputMatch = outputs.find((o: any) => o.name === cellName || o.name === displayName);
      const rawValue = promptMatch?.value ?? outputMatch?.value ?? variable.default_value;

      if (rawValue !== undefined && rawValue !== null) {
        const numValue = parseFloat(String(rawValue));
        if (!isNaN(numValue) && numValue >= 0) {
          impositionData[field] = numValue;
        }
      } else {
        console.warn(`[Imposition] No value found for field "${field}" (cell: ${cellName}, label: ${displayName}). Available outputs:`, outputs.map((o: any) => o.name));
      }
    }

    return updateCalculatedValues(impositionData as any);
  } catch (error) {
    console.error("Error resolving imposition mappings:", error);
    return null;
  }
}

export function ImpositionSection({ item, onStatusUpdate }: ImpositionSectionProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [resolvedDefaults, setResolvedDefaults] = useState<ImpositionData | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const compositeData = item.composite_data;
  const isComposite = compositeData?.components && Object.keys(compositeData.components).length > 0;

  const components: ComponentInfo[] = isComposite
    ? Object.entries(compositeData.components).map(([key, comp]: [string, any]) => ({
        key,
        alias: comp.alias || key,
      }))
    : [];

  const getComponentImposition = (componentKey: string): ImpositionData | null => {
    if (!item.imposition_data || isSimpleImposition(item.imposition_data)) return null;
    return item.imposition_data[componentKey] || null;
  };
  const hasUserModification = (item.observations || []).some(
    (obs: any) => obs.type === "imposition_modified"
  );

  const saveImposition = async (newData: any, isUserModified = true) => {
    try {
      const updatePayload: any = { imposition_data: newData };
      
      if (isUserModified) {
        const currentObs = (item as any).observations || [];
        const newObs = [
          ...currentObs,
          {
            type: "imposition_modified",
            message: "Imposición modificada manualmente por el usuario",
            timestamp: new Date().toISOString(),
          }
        ];
        updatePayload.observations = newObs;
      }

      const { error } = await supabase
        .from('sales_order_items')
        .update(updatePayload)
        .eq('id', item.id);
      if (error) throw error;
      toast.success('Imposición guardada correctamente');
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error saving imposition:', error);
      toast.error('Error al guardar la imposición');
    }
  };

  /**
   * When "Activar imposición" is clicked, try to resolve values from
   * production variable mappings first, then ALWAYS open modal for user review.
   */
  const handleActivateImposition = async (modalKey: string) => {
    const organizationId = item.organization_id || sessionStorage.getItem('selected_organization_id');
    if (!organizationId) {
      setActiveModal(modalKey);
      return;
    }

    setIsResolving(true);

    // Determine the correct product_id and prompts/outputs
    let targetProductId = item.product_id;
    let targetPrompts: any[] = Array.isArray(item.prompts) ? item.prompts : [];
    let targetOutputs: any[] = Array.isArray(item.outputs) ? item.outputs : [];

    // For composite components, use the component's product_id and data
    if (modalKey !== '__simple__' && isComposite && compositeData?.components?.[modalKey]) {
      const compData = compositeData.components[modalKey];
      const activeComp = compositeData.activeComponents?.find((ac: any) => {
        const compKey = `${ac.id}:${ac.instance_index || 1}`;
        return compKey === modalKey;
      });
      if (activeComp?.component_product_id) {
        targetProductId = activeComp.component_product_id;
      }
      if (Array.isArray(compData.prompts)) {
        targetPrompts = compData.prompts.map((p: any) => ({
          label: p.promptText || p.label || '',
          value: p.currentValue ?? p.value,
        }));
      }
      if (Array.isArray(compData.outputs)) {
        targetOutputs = compData.outputs;
      }
    }

    if (targetProductId) {
      const resolved = await resolveImpositionFromMappings(
        targetProductId,
        organizationId,
        targetPrompts,
        targetOutputs
      );
      setResolvedDefaults(resolved);
    }

    setIsResolving(false);
    // Always open modal for user review
    setActiveModal(modalKey);
  };

  // ─── Producto simple ───
  if (!isComposite) {
    const simpleData = item.imposition_data && isSimpleImposition(item.imposition_data)
      ? item.imposition_data as ImpositionData
      : null;

    return (
      <>
        {simpleData ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Imposición
              {hasUserModification && (
                <span className="ml-1 text-[9px] font-normal text-accent-foreground">• modificada</span>
              )}
            </p>
            <ImpositionBlock
              imp={simpleData}
              onEdit={() => setActiveModal('__simple__')}
              onDelete={() => saveImposition(null)}
            />
          </div>
        ) : (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleActivateImposition('__simple__')} 
            className="w-fit"
            disabled={isResolving}
          >
            <Settings className="h-3 w-3 mr-1" />
            {isResolving ? 'Calculando...' : 'Activar imposición'}
          </Button>
        )}
        {activeModal === '__simple__' && (
          <ImpositionModal
            open={true}
            onOpenChange={(open) => { if (!open) { setActiveModal(null); setResolvedDefaults(null); } }}
            initialData={resolvedDefaults || simpleData || defaultImpositionData}
            onSave={async (data) => {
              await saveImposition(data);
              setActiveModal(null);
              setResolvedDefaults(null);
            }}
          />
        )}
      </>
    );
  }

  // ─── Producto compuesto: imposición por componente ───
  const handleSaveComponent = async (componentKey: string, data: ImpositionData) => {
    const currentMap = item.imposition_data && !isSimpleImposition(item.imposition_data)
      ? { ...item.imposition_data }
      : {};
    currentMap[componentKey] = data;
    await saveImposition(currentMap);
    setActiveModal(null);
    setResolvedDefaults(null);
  };

  const handleDeleteComponent = async (componentKey: string) => {
    const currentMap = item.imposition_data && !isSimpleImposition(item.imposition_data)
      ? { ...item.imposition_data }
      : {};
    delete currentMap[componentKey];
    await saveImposition(Object.keys(currentMap).length > 0 ? currentMap : null);
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Imposición por componente</p>
      <div className="flex flex-wrap gap-2">
        {components.map(({ key, alias }) => {
          const compData = getComponentImposition(key);
          return (
            <div key={key} className="flex-1 min-w-[200px]">
              {compData ? (
                <ImpositionBlock
                  imp={compData}
                  label={alias}
                  onEdit={() => setActiveModal(key)}
                  onDelete={() => handleDeleteComponent(key)}
                />
              ) : (
                <div className="border border-dashed border-border rounded-sm p-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-medium">{alias}:</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleActivateImposition(key)} 
                    className="h-5 text-[10px] px-1.5"
                    disabled={isResolving}
                  >
                    <Settings className="h-2.5 w-2.5 mr-0.5" />
                    {isResolving ? '...' : 'Activar'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeModal && activeModal !== '__simple__' && (
        <ImpositionModal
          open={true}
          onOpenChange={(open) => { if (!open) { setActiveModal(null); setResolvedDefaults(null); } }}
          initialData={resolvedDefaults || getComponentImposition(activeModal) || defaultImpositionData}
          onSave={(data) => handleSaveComponent(activeModal, data)}
        />
      )}
    </div>
  );
}
