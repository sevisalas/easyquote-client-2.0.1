import { ImpositionScheme } from "./ImpositionScheme";
import { ImpositionData } from "@/utils/impositionCalculator";

interface WorkOrderItemProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    prompts?: Array<{ id: string; label: string; value: any; order: number }>;
    outputs?: Array<{ name: string; type: string; value: any }>;
    description?: string;
    imposition_data?: any;
    composite_data?: any;
  };
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderDate?: string;
  deliveryDate?: string;
  itemIndex: number;
  children?: React.ReactNode;
}

// Output type filtering is now done by the parent using useOutputTypeVisibility

export const WorkOrderItem = ({ 
  item, 
  orderNumber, 
  customerName,
  orderDate,
  deliveryDate,
  itemIndex,
  children,
}: WorkOrderItemProps) => {
  const relevantOutputs = [...(item.outputs || [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const sortedPrompts = [...(item.prompts || [])]
    .filter(p => {
      const val = formatValue(p.value);
      return val !== 'No' && val !== 'no';
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return 'Ver imagen';
    }
    return String(value);
  };

  // Detectar si es simple o compuesto
  const isSimpleImposition = (data: any): boolean => data && typeof data.productWidth === 'number';
  const compositeData = item.composite_data;
  const isComposite = compositeData?.components && Object.keys(compositeData.components).length > 0;

  // Para simple: imp es el dato directo; para compuesto: extraer por componente
  const simpleImp = item.imposition_data && isSimpleImposition(item.imposition_data) ? item.imposition_data : null;

  return (
    <div className="space-y-2">
      {/* Header compacto estilo OT */}
      <div className="flex items-center justify-between border-b border-foreground/20 pb-1">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-sm">{item.product_name}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {orderDate && <span>F. Pedido: <span className="font-medium text-foreground">{orderDate}</span></span>}
          {deliveryDate && <span>F. Entrega: <span className="font-medium text-foreground">{deliveryDate}</span></span>}
        </div>
      </div>

      {/* Prompts + Outputs unified grid (no section labels) */}
      {(sortedPrompts.length > 0 || relevantOutputs.length > 0) && (
        <div>
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 text-[11px]">
              {[
                ...sortedPrompts.map((prompt) => ({
                  key: `p-${prompt.id}`,
                  label: prompt.label,
                  value: prompt.value,
                  isImage: typeof prompt.value === 'string' && 
                    (prompt.value.startsWith('http://') || prompt.value.startsWith('https://')),
                })),
                ...relevantOutputs.map((output, idx) => ({
                  key: `o-${idx}`,
                  label: output.name,
                  value: output.value,
                  isImage: output.type === 'ProductImage' && typeof output.value === 'string' &&
                    (output.value.startsWith('http://') || output.value.startsWith('https://')),
                })),
              ].map((item, idx) => (
                <div 
                  key={item.key} 
                  className={`flex gap-1 px-2 py-1 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-muted/40'} border-b border-border/50 last:border-b-0`}
                >
                  <span className="font-semibold text-muted-foreground whitespace-nowrap">{item.label}:</span>
                  {item.isImage ? (
                    <img 
                      src={item.value} 
                      alt={item.label}
                      className="max-w-[60px] h-auto rounded"
                    />
                  ) : (
                    <span className="font-medium truncate">{formatValue(item.value)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Slot para imposición interactiva */}
      {children}

      {/* Observaciones compactas */}
      <div className="border border-border rounded-sm">
        <div className="px-2 py-1 bg-muted/30 border-b border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observaciones</p>
        </div>
        <div className="px-2 py-2 min-h-[40px]">
          <p className="text-[11px] text-muted-foreground italic">
            Espacio para notas durante la producción...
          </p>
        </div>
      </div>
    </div>
  );
};
