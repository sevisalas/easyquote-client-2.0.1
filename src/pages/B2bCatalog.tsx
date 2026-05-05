import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, AlertTriangle } from "lucide-react";

interface CatalogItem {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
}

const B2bCatalog = () => {
  const { organization } = useSubscription();
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [b2bEnabled, setB2bEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ name: string; description: string; image_url: string }>({
    name: "",
    description: "",
    image_url: "",
  });

  const orgId = organization?.id;

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data: org } = await supabase
      .from("organizations")
      .select("b2b_portal_enabled")
      .eq("id", orgId)
      .maybeSingle();
    setB2bEnabled(!!(org as any)?.b2b_portal_enabled);

    const { data, error } = await supabase
      .from("b2b_catalog_items")
      .select("*")
      .eq("organization_id", orgId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setItems((data as CatalogItem[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const addItem = async () => {
    if (!orgId || !draft.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("b2b_catalog_items").insert({
      organization_id: orgId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      image_url: draft.image_url.trim() || null,
      display_order: items.length,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setDraft({ name: "", description: "", image_url: "" });
    load();
  };

  const updateItem = async (id: string, patch: Partial<CatalogItem>) => {
    const { error } = await supabase.from("b2b_catalog_items").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeItem = async (id: string) => {
    if (!confirm("¿Eliminar este producto del catálogo B2B?")) return;
    const { error } = await supabase.from("b2b_catalog_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (loading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  if (b2bEnabled === false) {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Portal B2B no disponible
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta funcionalidad es un add-on opcional. Contacta con tu gestor para activarlo en tu cuenta.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Catálogo Portal B2B</h1>
        <p className="text-muted-foreground">
          Productos visibles para tus clientes en el portal. Pueden solicitar presupuesto sobre ellos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Añadir producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej: Catálogo offset A4"
              />
            </div>
            <div>
              <Label>URL imagen (opcional)</Label>
              <Input
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
            />
          </div>
          <Button onClick={addItem} disabled={saving || !draft.name.trim()}>
            <Plus className="w-4 h-4 mr-2" /> Añadir al catálogo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Productos publicados</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos en el catálogo todavía.</p>
          ) : (
            <div className="divide-y">
              {items.map((it) => (
                <div key={it.id} className="py-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      value={it.name}
                      onChange={(e) => setItems((p) => p.map((x) => x.id === it.id ? { ...x, name: e.target.value } : x))}
                      onBlur={(e) => updateItem(it.id, { name: e.target.value })}
                    />
                    <Textarea
                      value={it.description ?? ""}
                      rows={1}
                      onChange={(e) => setItems((p) => p.map((x) => x.id === it.id ? { ...x, description: e.target.value } : x))}
                      onBlur={(e) => updateItem(it.id, { description: e.target.value || null })}
                      placeholder="Descripción"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={it.is_active}
                        onCheckedChange={(v) => updateItem(it.id, { is_active: v })}
                      />
                      <span className="text-xs text-muted-foreground">{it.is_active ? "Activo" : "Oculto"}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default B2bCatalog;