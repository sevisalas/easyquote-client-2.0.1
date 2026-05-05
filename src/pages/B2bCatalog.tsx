import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { invokeEasyQuoteFunction, getEasyQuoteToken } from "@/lib/easyquoteApi";
import { useProductCategoryMappings } from "@/hooks/useProductCategoryMappings";

interface CatalogItem {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  product_id: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

const B2bCatalog = () => {
  const { organization } = useSubscription();
  const { toast } = useToast();
  const { mappings: categoryMappings } = useProductCategoryMappings();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [b2bEnabled, setB2bEnabled] = useState<boolean | null>(null);
  const [selfService, setSelfService] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    image_url: string;
    product_id: string;
  }>({ name: "", description: "", image_url: "", product_id: "" });

  const orgId = organization?.id;

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data: org } = await supabase
      .from("organizations")
      .select("b2b_portal_enabled, b2b_self_service_enabled")
      .eq("id", orgId)
      .maybeSingle();
    setB2bEnabled(!!(org as any)?.b2b_portal_enabled);
    setSelfService((org as any)?.b2b_self_service_enabled !== false);

    const { data, error } = await supabase
      .from("b2b_catalog_items")
      .select("*")
      .eq("organization_id", orgId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setItems(((data as any[]) || []) as CatalogItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    (async () => {
      const token = await getEasyQuoteToken();
      if (!token) return;
      const { data, error } = await invokeEasyQuoteFunction("easyquote-products", { token });
      if (error || !data) return;
      const list = Array.isArray(data) ? data : ((data as any)?.items || (data as any)?.data || []);
      const opts: ProductOption[] = (list as any[])
        .map((p: any) => ({
          id: String(p.id ?? p.productId ?? p.product_id ?? ""),
          name: p.productName ?? p.name ?? p.title ?? p.displayName ?? `Producto ${p.id ?? ""}`.trim(),
          category: p.category ?? p.categoryName ?? "",
          isActive: p.isActive !== false,
        }))
        .filter((p) => p.id);
      setProducts(opts);
    })();
  }, []);

  const productNameById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.name])),
    [products],
  );

  const productCategoryById = useMemo(() => {
    const map: Record<string, string> = {};
    const localByProductId = new Map(
      categoryMappings.map((m) => [m.easyquote_product_id, m.product_categories?.name || ""]),
    );
    products.forEach((p) => {
      map[p.id] = localByProductId.get(p.id) || p.category || "";
    });
    return map;
  }, [products, categoryMappings]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    Object.values(productCategoryById).forEach((c) => { if (c) set.add(c); });
    return Array.from(set).sort();
  }, [productCategoryById]);

  const usedProductIds = useMemo(
    () => new Set(items.map((it) => it.product_id).filter(Boolean) as string[]),
    [items],
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!showInactive && !p.isActive) return false;
      if (categoryFilter === "__uncat__") {
        if (productCategoryById[p.id]) return false;
      } else if (categoryFilter !== "__all__") {
        if (productCategoryById[p.id] !== categoryFilter) return false;
      }
      return true;
    });
  }, [products, categoryFilter, showInactive, productCategoryById]);

  const toggleSelfService = async (v: boolean) => {
    if (!orgId) return;
    setSelfService(v);
    const { error } = await supabase
      .from("organizations")
      .update({ b2b_self_service_enabled: v } as any)
      .eq("id", orgId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSelfService(!v);
    }
  };

  const addItem = async () => {
    if (!orgId || !draft.name.trim() || !draft.product_id) {
      toast({ title: "Faltan datos", description: "Selecciona un producto y un nombre" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("b2b_catalog_items").insert({
      organization_id: orgId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      image_url: draft.image_url.trim() || null,
      display_order: items.length,
      is_active: true,
      product_id: draft.product_id,
      default_prompts: {},
      exposed_prompt_ids: [],
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setDraft({ name: "", description: "", image_url: "", product_id: "" });
    load();
  };

  const updateItem = async (id: string, patch: Partial<CatalogItem>) => {
    const { error } = await supabase.from("b2b_catalog_items").update(patch as any).eq("id", id);
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
          Publica aquí los productos que tus clientes podrán configurar desde el portal.
          La configuración del producto (prompts, visibilidad, etc.) se gestiona en{" "}
          <strong>Productos</strong>; el portal usa exactamente esa misma configuración.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modo de funcionamiento</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Autoservicio</div>
            <p className="text-sm text-muted-foreground">
              Si está activo, el presupuesto se crea como <strong>"Enviado"</strong> listo para que el cliente lo apruebe.
              Si está desactivado, queda como <strong>borrador</strong> para revisión del comercial antes de enviarlo.
            </p>
          </div>
          <Switch checked={selfService} onCheckedChange={toggleSelfService} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Añadir producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-2">
              <Label>Producto</Label>
              <div className="flex flex-wrap gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las categorías</SelectItem>
                    <SelectItem value="__uncat__">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                  Mostrar inactivos
                </label>
              </div>
              <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {draft.product_id
                        ? productNameById[draft.product_id] || draft.product_id
                        : products.length === 0
                          ? "Cargando productos…"
                          : "Selecciona el producto a publicar"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Buscar por nombre o categoría…" />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.map((p) => {
                          const already = usedProductIds.has(p.id) && p.id !== draft.product_id;
                          return (
                            <CommandItem
                              key={p.id}
                              value={`${p.id}|${p.name}|${p.category}`.toLowerCase()}
                              onSelect={() => {
                                setDraft({
                                  ...draft,
                                  product_id: p.id,
                                  name: draft.name || p.name,
                                });
                                setProductPickerOpen(false);
                              }}
                              disabled={already}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${draft.product_id === p.id ? "opacity-100" : "opacity-0"}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="truncate font-medium">{p.name}</div>
                                {(p.category || already || !p.isActive) && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {p.category && <span className="truncate">{p.category}</span>}
                                    {!p.isActive && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
                                    {already && <Badge variant="secondary" className="text-[10px]">Ya añadido</Badge>}
                                  </div>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Nombre visible al cliente</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej: Tarjetas de visita"
              />
            </div>
            <div>
              <Label>URL imagen de respaldo (opcional)</Label>
              <Input
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Solo se usa si el producto no devuelve una imagen propia desde el motor de cálculo.
              </p>
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
          <Button onClick={addItem} disabled={saving || !draft.name.trim() || !draft.product_id}>
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Producto:</span>
                      {it.product_id ? (
                        <Badge variant="outline">{productNameById[it.product_id] || it.product_id}</Badge>
                      ) : (
                        <Badge variant="destructive">Sin producto asignado</Badge>
                      )}
                    </div>
                    <Textarea
                      value={it.description ?? ""}
                      rows={1}
                      onChange={(e) => setItems((p) => p.map((x) => x.id === it.id ? { ...x, description: e.target.value } : x))}
                      onBlur={(e) => updateItem(it.id, { description: e.target.value || null })}
                      placeholder="Descripción"
                    />
                    <Input
                      value={it.image_url ?? ""}
                      onChange={(e) => setItems((p) => p.map((x) => x.id === it.id ? { ...x, image_url: e.target.value } : x))}
                      onBlur={(e) => updateItem(it.id, { image_url: e.target.value.trim() || null })}
                      placeholder="URL imagen de respaldo (https://…)"
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
