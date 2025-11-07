import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SalesOrderItem } from "@/hooks/useSalesOrders";

interface EditOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SalesOrderItem | null;
  onSave: (itemId: string, updates: { quantity: number; price: number; description?: string }) => Promise<void>;
  saving: boolean;
}

export const EditOrderItemDialog = ({ open, onOpenChange, item, onSave, saving }: EditOrderItemDialogProps) => {
  const [quantity, setQuantity] = useState(item?.quantity?.toString() || "1");
  const [price, setPrice] = useState(item?.price?.toString() || "0");
  const [description, setDescription] = useState(item?.description || "");

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setQuantity(item.quantity?.toString() || "1");
      setPrice(item.price?.toString() || "0");
      setDescription(item.description || "");
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    
    const qty = parseFloat(quantity);
    const prc = parseFloat(price);
    
    if (isNaN(qty) || qty <= 0) {
      alert("La cantidad debe ser un número mayor que 0");
      return;
    }
    
    if (isNaN(prc) || prc < 0) {
      alert("El precio debe ser un número mayor o igual a 0");
      return;
    }
    
    await onSave(item.id, {
      quantity: qty,
      price: prc,
      description: description || undefined
    });
    
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar artículo</DialogTitle>
          <DialogDescription>
            Modifica la cantidad, precio o descripción del artículo del pedido.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Producto</Label>
            <p className="text-base font-medium">{item.product_name}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              min="0.01"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="price">Precio (€)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={saving}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
