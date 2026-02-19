import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImpositionData } from "@/utils/impositionCalculator";
import { ImpositionScheme } from "./ImpositionScheme";
import { ImpositionModal } from "./ImpositionModal";

interface ImpositionSectionProps {
  item: {
    id: string;
    imposition_data?: any;
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

export function ImpositionSection({ item, onStatusUpdate }: ImpositionSectionProps) {
  const [showImpositionModal, setShowImpositionModal] = useState(false);

  const handleSaveImposition = async (data: ImpositionData) => {
    try {
      const { error } = await supabase
        .from('sales_order_items')
        .update({ imposition_data: data as any })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Imposición guardada correctamente');
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error saving imposition:', error);
      toast.error('Error al guardar la imposición');
    }
  };

  const handleDeleteImposition = async () => {
    try {
      const { error } = await supabase
        .from('sales_order_items')
        .update({ imposition_data: null })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Imposición eliminada');
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error deleting imposition:', error);
      toast.error('Error al eliminar la imposición');
    }
  };

  return (
    <>
      {item.imposition_data ? (
        <div className="flex gap-3 items-center p-3 bg-muted/30 rounded-md">
          <div className="flex-shrink-0">
            <ImpositionScheme data={item.imposition_data} compact={true} />
          </div>
          <div className="flex-1 flex items-center gap-4">
            <p className="text-sm font-medium text-muted-foreground">
              {item.imposition_data.repetitionsH}×{item.imposition_data.repetitionsV} = {item.imposition_data.totalRepetitions} por pliego
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              Aprovechamiento: {item.imposition_data.utilization?.toFixed(1)}%
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImpositionModal(true)} className="h-8">
              <Settings className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDeleteImposition} className="h-8">
              Eliminar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowImpositionModal(true)} className="w-fit">
          <Settings className="h-3 w-3 mr-1" />
          Activar imposición
        </Button>
      )}

      <ImpositionModal
        open={showImpositionModal}
        onOpenChange={setShowImpositionModal}
        initialData={item.imposition_data || defaultImpositionData}
        onSave={handleSaveImposition}
      />
    </>
  );
}
