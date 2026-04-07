import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Percent } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCustomerDiscounts } from "@/hooks/useCustomerDiscounts";

interface Props {
  customerId: string;
  organizationId: string;
}

export default function CustomerDiscountsSection({ customerId, organizationId }: Props) {
  const {
    discounts,
    isLoading,
    createDiscount,
    updateDiscount,
    deleteDiscount,
  } = useCustomerDiscounts(customerId, organizationId);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newIsDiscount, setNewIsDiscount] = useState(true);

  const handleCreate = async () => {
    const pct = parseFloat(newPercentage);
    if (!newName.trim() || isNaN(pct) || pct <= 0) {
      toast({ title: "Error", description: "Nombre y porcentaje válido son obligatorios", variant: "destructive" });
      return;
    }

    try {
      await createDiscount.mutateAsync({
        name: newName.trim(),
        percentage: pct,
        is_discount: newIsDiscount,
        is_active: true,
      });
      setNewName("");
      setNewPercentage("");
      setNewIsDiscount(true);
      setShowForm(false);
      toast({ title: "Éxito", description: "Descuento creado correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudo crear el descuento", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateDiscount.mutateAsync({ id, is_active: !currentActive });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDiscount.mutateAsync(id);
      toast({ title: "Eliminado", description: "Descuento eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando descuentos...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Percent className="w-4 h-4" />
          Descuentos / Tarifas
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Añadir
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Los descuentos se aplican automáticamente al crear presupuestos para este cliente. No son visibles en PDFs ni para otros roles.
      </p>

      {showForm && (
        <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Descuento mayorista"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Porcentaje (%)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={newPercentage}
                onChange={(e) => setNewPercentage(e.target.value)}
                placeholder="10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={newIsDiscount} onCheckedChange={setNewIsDiscount} />
            <span className="text-xs text-muted-foreground">
              {newIsDiscount ? "Descuento (resta)" : "Recargo (suma)"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={createDiscount.isPending}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {discounts.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">Sin descuentos configurados</p>
      )}

      {discounts.map((d) => (
        <div
          key={d.id}
          className={`flex items-center justify-between border rounded-md px-3 py-2 ${
            d.is_active ? "border-border bg-background" : "border-border/50 bg-muted/30 opacity-60"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant={d.is_discount ? "destructive" : "default"} className="text-[10px] shrink-0">
              {d.is_discount ? `-${d.percentage}%` : `+${d.percentage}%`}
            </Badge>
            <span className="text-sm truncate">{d.name}</span>
            {!d.is_active && (
              <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Switch
              checked={d.is_active}
              onCheckedChange={() => handleToggleActive(d.id, d.is_active)}
              className="scale-75"
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(d.id)}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
