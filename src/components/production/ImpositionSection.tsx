import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImpositionData } from "@/utils/impositionCalculator";
import { ImpositionScheme } from "./ImpositionScheme";
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

/** Para un producto simple, imposition_data es un ImpositionData directamente.
 *  Para compuestos, imposition_data es un mapa { [componentKey]: ImpositionData }.
 *  Detectamos cuál es mirando si tiene "productWidth" (simple) o no (mapa). */
function isSimpleImposition(data: any): data is ImpositionData {
  return data && typeof data.productWidth === 'number';
}

function SingleImposition({ 
  data, 
  onEdit, 
  onDelete 
}: { 
  data: ImpositionData | null; 
  onEdit: () => void; 
  onDelete: () => void;
  label?: string;
}) {
  if (!data) {
    return (
      <Button size="sm" variant="outline" onClick={onEdit} className="w-fit">
        <Settings className="h-3 w-3 mr-1" />
        Activar imposición
      </Button>
    );
  }

  return (
    <div className="flex gap-3 items-center p-3 bg-muted/30 rounded-md">
      <div className="flex-shrink-0">
        <ImpositionScheme data={data} compact={true} />
      </div>
      <div className="flex-1 flex items-center gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          {data.repetitionsH}×{data.repetitionsV} = {data.totalRepetitions} por pliego
        </p>
        <p className="text-sm font-medium text-muted-foreground">
          Aprovechamiento: {data.utilization?.toFixed(1)}%
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="h-8">
          <Settings className="h-3 w-3 mr-1" />
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="h-8">
          Eliminar
        </Button>
      </div>
    </div>
  );
}

export function ImpositionSection({ item, onStatusUpdate }: ImpositionSectionProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null); // null or componentKey or '__simple__'

  const compositeData = item.composite_data;
  const isComposite = compositeData && compositeData.components && Object.keys(compositeData.components).length > 0;

  // Extraer componentes del composite_data
  const components: ComponentInfo[] = isComposite
    ? Object.entries(compositeData.components).map(([key, comp]: [string, any]) => ({
        key,
        alias: comp.alias || key,
      }))
    : [];

  // Para compuestos: imposition_data es un mapa {componentKey: ImpositionData}
  // Para simples: imposition_data es un ImpositionData directamente
  const getComponentImposition = (componentKey: string): ImpositionData | null => {
    if (!item.imposition_data) return null;
    if (isSimpleImposition(item.imposition_data)) return null; // Es formato simple, no aplica a componentes
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
        <SingleImposition
          data={simpleData}
          onEdit={() => setActiveModal('__simple__')}
          onDelete={async () => {
            await saveImposition(null);
          }}
        />
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

  // ─── Producto compuesto: una imposición por componente ───
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
    const hasAny = Object.keys(currentMap).length > 0;
    await saveImposition(hasAny ? currentMap : null);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Imposición por componente</p>
      {components.map(({ key, alias }) => {
        const compData = getComponentImposition(key);
        return (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium text-foreground">{alias}</p>
            <SingleImposition
              data={compData}
              onEdit={() => setActiveModal(key)}
              onDelete={() => handleDeleteComponent(key)}
            />
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
