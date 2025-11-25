import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkOrderItemProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    prompts?: Array<{ id: string; label: string; value: any; order: number }>;
    outputs?: Array<{ name: string; type: string; value: any }>;
    description?: string;
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
  // Filter outputs relevant for production
  const relevantOutputs = (item.outputs || []).filter(output => 
    outputTypesForOT.includes(output.type)
  );

  // Sort prompts by order
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

  return (
    <div className="work-order-item bg-background">
      <div className="p-6 space-y-6 print:p-8">
        {/* Print-only Header */}
        <div className="hidden print:block mb-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold">
                Orden de Trabajo #{orderNumber}-{itemIndex + 1}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Pedido: {orderNumber}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            {customerName && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <p className="text-sm font-semibold mt-1">{customerName}</p>
              </div>
            )}
            {orderDate && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha Pedido</label>
                <p className="text-sm font-semibold mt-1">{orderDate}</p>
              </div>
            )}
            {deliveryDate && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fecha Entrega</label>
                <p className="text-sm font-semibold mt-1">{deliveryDate}</p>
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">Producto</h3>
          <p className="text-base font-semibold">{item.product_name}</p>
          {item.description && (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          )}
          <p className="text-sm">
            <span className="font-medium">Cantidad:</span> {item.quantity}
          </p>
        </div>

        {/* Product Configuration */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Configuración del Producto</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {sortedPrompts.map((prompt) => {
              const value = formatValue(prompt.value);
              const isImage = typeof prompt.value === 'string' && 
                (prompt.value.startsWith('http://') || prompt.value.startsWith('https://'));
              
              return (
                <div key={prompt.id} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    {prompt.label}
                  </label>
                  {isImage ? (
                    <img 
                      src={prompt.value} 
                      alt={prompt.label}
                      className="max-w-[200px] max-h-[200px] object-contain border rounded"
                    />
                  ) : (
                    <p className="text-sm">{value}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical Specifications */}
        {relevantOutputs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Especificaciones Técnicas</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {relevantOutputs.map((output, idx) => {
                const value = formatValue(output.value);
                const isImage = output.type === 'ProductImage';
                
                return (
                  <div key={idx} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      {output.name}
                    </label>
                    {isImage && typeof output.value === 'string' && 
                     (output.value.startsWith('http://') || output.value.startsWith('https://')) ? (
                      <img 
                        src={output.value} 
                        alt={output.name}
                        className="max-w-[200px] max-h-[200px] object-contain border rounded"
                      />
                    ) : (
                      <p className="text-sm">{value}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Operator Notes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Notas del Operador</h3>
          <div className="border rounded-md p-4 min-h-[100px] bg-muted/10">
            <p className="text-xs text-muted-foreground italic">
              Espacio para anotaciones del operador durante la producción...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
