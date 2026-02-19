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
    imposition_data?: any; // ImpositionData for simple, {componentKey: ImpositionData} for composite
    composite_data?: any;
  };
  orderNumber: string;
  customerName?: string;
  orderDate?: string;
  deliveryDate?: string;
  itemIndex: number;
}

const outputTypesForOT = [
  'Instructions',
  'Workflow', 
  'Width',
  'Height',
  'Depth',
  'ProductImage',
  'Quantity',
  'Generic',
  'Weight'
];

export const WorkOrderItem = ({ 
  item, 
  orderNumber, 
  customerName,
  orderDate,
  deliveryDate,
  itemIndex 
}: WorkOrderItemProps) => {
  const relevantOutputs = (item.outputs || []).filter(output => 
    outputTypesForOT.includes(output.type)
  );

  const sortedPrompts = [...(item.prompts || [])].sort((a, b) => 
    (a.order || 0) - (b.order || 0)
  );

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

      {/* Configuración en tabla compacta */}
      {sortedPrompts.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Configuración</p>
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 text-[11px]">
              {sortedPrompts.map((prompt, idx) => {
                const value = formatValue(prompt.value);
                const isImage = typeof prompt.value === 'string' && 
                  (prompt.value.startsWith('http://') || prompt.value.startsWith('https://'));
                
                return (
                  <div 
                    key={prompt.id} 
                    className={`flex gap-1 px-2 py-1 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-muted/40'} border-b border-border/50 last:border-b-0`}
                  >
                    <span className="font-semibold text-muted-foreground whitespace-nowrap">{prompt.label}:</span>
                    {isImage ? (
                      <img 
                        src={prompt.value} 
                        alt={prompt.label}
                        className="max-w-[60px] h-auto rounded"
                      />
                    ) : (
                      <span className="font-medium truncate">{value}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Datos técnicos en tabla compacta */}
      {relevantOutputs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Datos técnicos</p>
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 text-[11px]">
              {relevantOutputs.map((output, idx) => {
                const value = formatValue(output.value);
                const isImage = output.type === 'ProductImage';
                
                return (
                  <div 
                    key={idx} 
                    className={`flex gap-1 px-2 py-1 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-muted/40'} border-b border-border/50 last:border-b-0`}
                  >
                    <span className="font-semibold text-muted-foreground whitespace-nowrap">{output.name}:</span>
                    {isImage && typeof output.value === 'string' && 
                     (output.value.startsWith('http://') || output.value.startsWith('https://')) ? (
                      <img 
                        src={output.value} 
                        alt={output.name}
                        className="max-w-[60px] h-auto rounded"
                      />
                    ) : (
                      <span className="font-medium truncate">{value}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Imposición - solo se renderiza en contexto de OT/PDF, no en vista interactiva */}
      {/* La vista interactiva usa ImpositionSection que integra esquema + botones */}

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
