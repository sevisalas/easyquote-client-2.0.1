import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus } from "lucide-react";
import { ProductionTaskForm } from "./ProductionTaskForm";
import { ProductionTaskList } from "./ProductionTaskList";
import { useProductionTasks } from "@/hooks/useProductionTasks";

interface ItemProductionCardProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    description?: string | null;
  };
}

export function ItemProductionCard({ item }: ItemProductionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const { refetch } = useProductionTasks(item.id);

  const handleTaskCreated = () => {
    setShowTaskForm(false);
    refetch();
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70">
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
              <CardTitle className="text-base">
                {item.product_name}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Cantidad: {item.quantity})
                </span>
              </CardTitle>
            </CollapsibleTrigger>
            {isOpen && !showTaskForm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTaskForm(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nueva Tarea
              </Button>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}

            {showTaskForm && (
              <ProductionTaskForm
                itemId={item.id}
                onTaskCreated={handleTaskCreated}
                onCancel={() => setShowTaskForm(false)}
              />
            )}

            <ProductionTaskList itemId={item.id} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
