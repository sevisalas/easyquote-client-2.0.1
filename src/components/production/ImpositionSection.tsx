import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImpositionData } from "@/utils/impositionCalculator";
import { ImpositionModal } from "./ImpositionModal";

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
          // Ya se muestra el esquema en WorkOrderItem, solo botones de acción
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setActiveModal('__simple__')} className="h-8">
              <Settings className="h-3 w-3 mr-1" />
              Editar imposición
            </Button>
            <Button size="sm" variant="ghost" onClick={() => saveImposition(null)} className="h-8">
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar
            </Button>
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

  // ─── Producto compuesto: botones por componente ───
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
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Imposición por componente</p>
      {components.map(({ key, alias }) => {
        const compData = getComponentImposition(key);
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground min-w-[80px]">{alias}:</span>
            {compData ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setActiveModal(key)} className="h-7 text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteComponent(key)} className="h-7 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Eliminar
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setActiveModal(key)} className="h-7 text-xs">
                <Settings className="h-3 w-3 mr-1" />
                Activar
              </Button>
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
