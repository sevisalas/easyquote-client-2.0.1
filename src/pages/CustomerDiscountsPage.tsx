import { useState } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTariffs, Tariff } from "@/hooks/useTariffs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Percent, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CustomerDiscountsPage() {
  const isMobile = useIsMobile();
  const { organization } = useSubscription();
  const orgId = organization?.id;
  const { tariffs, isLoading, createTariff, updateTariff, deleteTariff } = useTariffs(orgId);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newIsDiscount, setNewIsDiscount] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [editIsDiscount, setEditIsDiscount] = useState(true);

  const handleCreate = async () => {
    const pct = parseFloat(newPercentage);
    if (!newName.trim() || isNaN(pct) || pct <= 0) {
      toast({ title: "Error", description: "Nombre y porcentaje válido son obligatorios", variant: "destructive" });
      return;
    }
    try {
      await createTariff.mutateAsync({ name: newName.trim(), percentage: pct, is_discount: newIsDiscount });
      setNewName(""); setNewPercentage(""); setNewIsDiscount(true); setShowForm(false);
      toast({ title: "Éxito", description: "Tarifa creada correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudo crear la tarifa", variant: "destructive" });
    }
  };

  const startEdit = (t: Tariff) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditPercentage(String(t.percentage));
    setEditIsDiscount(t.is_discount);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const pct = parseFloat(editPercentage);
    if (!editName.trim() || isNaN(pct) || pct <= 0) {
      toast({ title: "Error", description: "Datos inválidos", variant: "destructive" });
      return;
    }
    try {
      await updateTariff.mutateAsync({ id: editingId, name: editName.trim(), percentage: pct, is_discount: editIsDiscount });
      setEditingId(null);
      toast({ title: "Actualizado", description: "Tarifa actualizada" });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateTariff.mutateAsync({ id, is_active: !current });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTariff.mutateAsync(id);
      toast({ title: "Eliminada", description: "Tarifa eliminada" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "p-3" : "p-6"}`}>
      <div className="max-w-2xl mx-auto">
        <header className={isMobile ? "mb-4" : "mb-6"}>
          <h1 className={`font-bold text-foreground mb-1 ${isMobile ? "text-2xl" : "text-3xl"}`}>
            Tarifas
          </h1>
          <p className="text-sm text-muted-foreground">
            Define tarifas (descuentos o recargos) que luego puedes asignar a cada cliente. Solo visible para administradores.
          </p>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Tarifas de la organización
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nueva tarifa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showForm && (
              <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tarifa mayorista" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Porcentaje (%)</Label>
                    <Input type="number" min="0" step="0.5" value={newPercentage} onChange={(e) => setNewPercentage(e.target.value)} placeholder="10" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newIsDiscount} onCheckedChange={setNewIsDiscount} />
                  <span className="text-xs text-muted-foreground">
                    {newIsDiscount ? "Descuento (resta)" : "Recargo (suma)"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={createTariff.isPending}>Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Cargando tarifas...</p>
            ) : tariffs.length === 0 && !showForm ? (
              <p className="text-sm text-muted-foreground py-4 text-center italic">
                No hay tarifas definidas. Crea una para poder asignarla a clientes.
              </p>
            ) : (
              tariffs.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between border rounded-md px-3 py-2 ${
                    t.is_active ? "border-border bg-background" : "border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  {editingId === t.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                        <Input type="number" min="0" step="0.5" value={editPercentage} onChange={(e) => setEditPercentage(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch checked={editIsDiscount} onCheckedChange={setEditIsDiscount} className="scale-75" />
                          <span className="text-xs text-muted-foreground">
                            {editIsDiscount ? "Descuento" : "Recargo"}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUpdate}>
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={t.is_discount ? "destructive" : "default"} className="text-[10px] shrink-0">
                          {t.is_discount ? `-${t.percentage}%` : `+${t.percentage}%`}
                        </Badge>
                        <span className="text-sm truncate">{t.name}</span>
                        {!t.is_active && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t.id, t.is_active)} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
