import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImpositionData } from "@/utils/impositionCalculator";
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
  };
  onStatusUpdate?: () => void;
}

const defaultImpositionData: ImpositionData = {
  productWidth: 210,
  productHeight: 297,
  bleed: 3,
  sheetWidth: 700,
  sheetHeight: 500,
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
    <div className="flex gap-3 items-center border border-border rounded-sm p-2 bg-muted/10">
      <div className="flex-shrink-0">
        <ImpositionScheme data={imp} compact={true} />
      </div>
      <div className="flex-1 text-[11px]">
        {label && <span className="font-bold text-xs block mb-0.5">{label}</span>}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span><span className="text-muted-foreground">Producto:</span> <span className="font-medium">{imp.productWidth}×{imp.productHeight}</span></span>
          <span><span className="text-muted-foreground">Pliego:</span> <span className="font-medium">{imp.sheetWidth}×{imp.sheetHeight}</span></span>
          <span><span className="text-muted-foreground">Sangrado:</span> <span className="font-medium">{imp.bleed}</span></span>
          <span><span className="text-muted-foreground">Calles:</span> <span className="font-medium">{imp.gutterH}×{imp.gutterV}</span></span>
          <span className="font-bold">Rep: {imp.repetitionsH}×{imp.repetitionsV} = {imp.totalRepetitions}/pliego</span>
          {imp.utilization !== undefined && (
            <span><span className="text-muted-foreground">Aprov:</span> <span className="font-medium">{imp.utilization.toFixed(1)}%</span></span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex gap-1">
        <Button size="sm" variant="outline" onClick={onEdit} className="h-7 w-7 p-0">
          <Settings className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function ImpositionSection({ item, onStatusUpdate }: ImpositionSectionProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

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

  const saveImposition = async (newData: any) => {
    try {
      const { error } = await supabase
        .from('sales_order_items')
        .update({ imposition_data: newData })
        .eq('id', item.id);
      if (error) throw error;
      toast.success('Imposición guardada correctamente');
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error saving imposition:', error);
      toast.error('Error al guardar la imposición');
    }
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Imposición</p>
            <ImpositionBlock
              imp={simpleData}
              onEdit={() => setActiveModal('__simple__')}
              onDelete={() => saveImposition(null)}
            />
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setActiveModal('__simple__')} className="w-fit">
            <Settings className="h-3 w-3 mr-1" />
            Activar imposición
          </Button>
        )}
        {activeModal === '__simple__' && (
          <ImpositionModal
            open={true}
            onOpenChange={(open) => { if (!open) setActiveModal(null); }}
            initialData={simpleData || defaultImpositionData}
            onSave={async (data) => {
              await saveImposition(data);
              setActiveModal(null);
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
  };

  const handleDeleteComponent = async (componentKey: string) => {
    const currentMap = item.imposition_data && !isSimpleImposition(item.imposition_data)
      ? { ...item.imposition_data }
      : {};
    delete currentMap[componentKey];
    await saveImposition(Object.keys(currentMap).length > 0 ? currentMap : null);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Imposición por componente</p>
      {components.map(({ key, alias }) => {
        const compData = getComponentImposition(key);
        return (
          <div key={key}>
            {compData ? (
              <ImpositionBlock
                imp={compData}
                label={alias}
                onEdit={() => setActiveModal(key)}
                onDelete={() => handleDeleteComponent(key)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground min-w-[80px]">{alias}:</span>
                <Button size="sm" variant="outline" onClick={() => setActiveModal(key)} className="h-7 text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Activar
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {activeModal && activeModal !== '__simple__' && (
        <ImpositionModal
          open={true}
          onOpenChange={(open) => { if (!open) setActiveModal(null); }}
          initialData={getComponentImposition(activeModal) || defaultImpositionData}
          onSave={(data) => handleSaveComponent(activeModal, data)}
        />
      )}
    </div>
  );
}
