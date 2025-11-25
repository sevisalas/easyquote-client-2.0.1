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
    <div className="space-y-3">
      {/* Compact Product Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Producto</p>
          <p className="font-medium">{item.product_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cantidad</p>
          <p className="font-medium">{item.quantity}</p>
        </div>
        {orderDate && (
          <div>
            <p className="text-muted-foreground">F. Pedido</p>
            <p className="font-medium">{orderDate}</p>
          </div>
        )}
        {deliveryDate && (
          <div>
            <p className="text-muted-foreground">F. Entrega</p>
            <p className="font-medium">{deliveryDate}</p>
          </div>
        )}
      </div>

      {/* Compact Prompts */}
      {sortedPrompts.length > 0 && (
        <div className="p-2 bg-muted/30 rounded border">
          <p className="text-xs font-semibold mb-2">Configuración</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {sortedPrompts.map((prompt) => {
              const value = formatValue(prompt.value);
              const isImage = typeof prompt.value === 'string' && 
                (prompt.value.startsWith('http://') || prompt.value.startsWith('https://'));
              
              return (
                <div key={prompt.id}>
                  <p className="text-muted-foreground">{prompt.label}</p>
                  <div>
                    {isImage ? (
                      <img 
                        src={prompt.value} 
                        alt={prompt.label}
                        className="max-w-[100px] h-auto rounded"
                      />
                    ) : (
                      <p className="font-medium truncate">{value}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Technical Specs */}
      {relevantOutputs.length > 0 && (
        <div className="p-2 bg-muted/30 rounded border">
          <p className="text-xs font-semibold mb-2">Especificaciones Técnicas</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {relevantOutputs.map((output, idx) => {
              const value = formatValue(output.value);
              const isImage = output.type === 'ProductImage';
              
              return (
                <div key={idx}>
                  <p className="text-muted-foreground">{output.name}</p>
                  <div>
                    {isImage && typeof output.value === 'string' && 
                     (output.value.startsWith('http://') || output.value.startsWith('https://')) ? (
                      <img 
                        src={output.value} 
                        alt={output.name}
                        className="max-w-[100px] h-auto rounded"
                      />
                    ) : (
                      <p className="font-medium truncate">{value}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Highlighted Observations */}
      <div className="p-3 bg-primary/5 border-l-4 border-primary rounded">
        <p className="text-xs font-semibold text-primary mb-2">OBSERVACIONES</p>
        <div className="bg-background/50 p-3 rounded min-h-[60px]">
          <p className="text-xs text-muted-foreground italic">
            Espacio para notas y observaciones durante la producción...
          </p>
        </div>
      </div>
    </div>
  );
};
