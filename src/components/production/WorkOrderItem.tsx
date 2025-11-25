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
    <div className="work-order-item page-break bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Orden de Trabajo #{orderNumber}-{itemIndex + 1}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Pedido: {orderNumber}
                </p>
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                Artículo {itemIndex + 1}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Order Info */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              {customerName && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cliente:</label>
                  <p className="text-sm font-medium mt-1">{customerName}</p>
                </div>
              )}
              {orderDate && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Fecha Pedido:</label>
                  <p className="text-sm font-medium mt-1">{orderDate}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Producto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">{item.product_name}</p>
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Product Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuración del Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {sortedPrompts.map((prompt) => {
                const value = formatValue(prompt.value);
                const isImage = typeof prompt.value === 'string' && 
                  (prompt.value.startsWith('http://') || prompt.value.startsWith('https://'));
                
                return (
                  <div key={prompt.id}>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      {prompt.label}
                    </label>
                    {isImage ? (
                      <img 
                        src={prompt.value} 
                        alt={prompt.label}
                        className="mt-1 max-w-[200px] max-h-[200px] object-contain border rounded"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{value}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Technical Specifications */}
        {relevantOutputs.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Especificaciones Técnicas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {relevantOutputs.map((output, idx) => {
                  const value = formatValue(output.value);
                  const isImage = output.type === 'ProductImage';
                  
                  return (
                    <div key={idx}>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        {output.name}
                      </label>
                      {isImage && typeof output.value === 'string' && 
                       (output.value.startsWith('http://') || output.value.startsWith('https://')) ? (
                        <img 
                          src={output.value} 
                          alt={output.name}
                          className="mt-1 max-w-[200px] max-h-[200px] object-contain border rounded"
                        />
                      ) : (
                        <p className="text-sm font-medium mt-1">{value}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Operator Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notas del Operador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-4 min-h-[100px] bg-muted/5">
              <p className="text-xs text-muted-foreground italic">
                Espacio para anotaciones del operador durante la producción...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
