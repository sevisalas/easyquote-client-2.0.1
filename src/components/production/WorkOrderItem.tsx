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
    imposition_data?: ImpositionData;
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

  const imp = item.imposition_data;

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

      {/* Imposición compacta con esquema + datos lado a lado */}
      {imp && imp.repetitionsH && imp.repetitionsV && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Imposición</p>
          <div className="flex gap-3 items-start border border-border rounded-sm p-2 bg-muted/10">
            <div className="flex-shrink-0">
              <ImpositionScheme data={imp} compact={true} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] self-center">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producto:</span>
                <span className="font-medium">{imp.productWidth}×{imp.productHeight} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pliego:</span>
                <span className="font-medium">{imp.sheetWidth}×{imp.sheetHeight} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sangrado:</span>
                <span className="font-medium">{imp.bleed} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calles:</span>
                <span className="font-medium">{imp.gutterH}×{imp.gutterV} mm</span>
              </div>
              <div className="flex justify-between col-span-2 mt-1 pt-1 border-t border-border/50">
                <span className="font-bold">Repeticiones:</span>
                <span className="font-bold">{imp.repetitionsH}×{imp.repetitionsV} = {imp.totalRepetitions} por pliego</span>
              </div>
              {imp.utilization !== undefined && (
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Aprovechamiento:</span>
                  <span className="font-medium">{imp.utilization.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
