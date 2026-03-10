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

      {/* Componentes de producto compuesto */}
      {isComposite && compositeData?.components && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Componentes</p>
          {Object.entries(compositeData.components)
            .sort(([, a]: [string, any], [, b]: [string, any]) => 
              (a.alias || '').localeCompare(b.alias || '', 'es')
            )
            .map(([compKey, compData]: [string, any]) => {
              const compPrompts = Array.isArray(compData.prompts) 
                ? [...compData.prompts].sort((a: any, b: any) => (a.promptSequence || 0) - (b.promptSequence || 0))
                : [];
              const compOutputs = Array.isArray(compData.outputs)
                ? [...compData.outputs].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'es'))
                : [];

              return (
                <div key={compKey} className="border border-border rounded-sm overflow-hidden">
                  <div className="px-2 py-1 bg-muted/50 border-b border-border/50">
                    <p className="text-[11px] font-bold">{compData.alias || compKey}</p>
                  </div>
                  
                  {/* Prompts del componente */}
                  {compPrompts.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 text-[11px]">
                      {compPrompts.map((prompt: any, idx: number) => {
                        const label = prompt.promptText || prompt.label || '';
                        const val = formatValue(prompt.currentValue ?? prompt.value);
                        return (
                          <div 
                            key={prompt.id || idx} 
                            className={`flex gap-1 px-2 py-1 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-muted/40'} border-b border-border/50 last:border-b-0`}
                          >
                            <span className="font-semibold text-muted-foreground whitespace-nowrap">{label}:</span>
                            <span className="font-medium truncate">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Outputs del componente */}
                  {compOutputs.length > 0 && (
                    <>
                      <div className="px-2 py-0.5 bg-muted/30 border-t border-border/50">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Datos técnicos</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 text-[11px]">
                        {compOutputs.map((output: any, idx: number) => {
                          const val = formatValue(output.value);
                          const isImage = output.type === 'ProductImage';
                          return (
                            <div 
                              key={idx} 
                              className={`flex gap-1 px-2 py-1 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-muted/40'} border-b border-border/50 last:border-b-0`}
                            >
                              <span className="font-semibold text-muted-foreground whitespace-nowrap">{output.name}:</span>
                              {isImage && typeof output.value === 'string' && 
                               (output.value.startsWith('http://') || output.value.startsWith('https://')) ? (
                                <img src={output.value} alt={output.name} className="max-w-[60px] h-auto rounded" />
                              ) : (
                                <span className="font-medium truncate">{val}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
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
