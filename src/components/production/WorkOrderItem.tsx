import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
    <div className="work-order-item min-h-screen bg-background p-8 page-break">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-start justify-between mb-4">
            <div>
              <CardTitle className="text-2xl mb-2">
                Orden de Trabajo #{orderNumber}-{itemIndex + 1}
              </CardTitle>
              <p className="text-muted-foreground">
                Pedido: {orderNumber}
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              Artículo {itemIndex + 1}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            {customerName && (
              <div>
                <span className="text-muted-foreground">Cliente:</span>
                <p className="font-medium">{customerName}</p>
              </div>
            )}
            {orderDate && (
              <div>
                <span className="text-muted-foreground">Fecha Pedido:</span>
                <p className="font-medium">{orderDate}</p>
              </div>
            )}
            {deliveryDate && (
              <div>
                <span className="text-muted-foreground">Fecha Entrega:</span>
                <p className="font-medium">{deliveryDate}</p>
              </div>
            )}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-6">
          {/* Product Info */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Producto</h3>
            <p className="text-xl">{item.product_name}</p>
            {item.description && (
              <p className="text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>

          <Separator />

          {/* Product Configuration (Prompts) */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Configuración del Producto
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {sortedPrompts.map((prompt) => {
                const value = formatValue(prompt.value);
                const isImage = typeof prompt.value === 'string' && 
                  (prompt.value.startsWith('http://') || prompt.value.startsWith('https://'));
                
                return (
                  <div key={prompt.id} className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {prompt.label}
                    </p>
                    {isImage ? (
                      <img 
                        src={prompt.value} 
                        alt={prompt.label}
                        className="max-w-[200px] max-h-[200px] object-contain border rounded"
                      />
                    ) : (
                      <p className="font-medium">{value}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technical Specifications (Relevant Outputs) */}
          {relevantOutputs.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Especificaciones Técnicas
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {relevantOutputs.map((output, idx) => {
                    const value = formatValue(output.value);
                    const isImage = output.type === 'ProductImage';
                    
                    return (
                      <div key={idx} className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {output.name}
                        </p>
                        {isImage && typeof output.value === 'string' && 
                         (output.value.startsWith('http://') || output.value.startsWith('https://')) ? (
                          <img 
                            src={output.value} 
                            alt={output.name}
                            className="max-w-[200px] max-h-[200px] object-contain border rounded"
                          />
                        ) : (
                          <p className="font-medium">{value}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Operator Notes */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Notas del Operador
            </h3>
            <div className="border rounded-md p-4 min-h-[120px] bg-muted/10">
              <p className="text-sm text-muted-foreground italic">
                Espacio para anotaciones del operador durante la producción...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
