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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, Check, ChevronsUpDown, Pencil, Package, FolderTree, ChevronRight, Upload, Calculator, Tag, Image as ImageIcon, Type } from "lucide-react";
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
  category_id: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

type CalcKind = "producto" | "compuesto" | "componente" | "kit";

interface B2bCategory {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  display_order: number;
  is_active: boolean;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    image_url: string;
    product_id: string;
    category_id: string;
  }>({ name: "", description: "", image_url: "", product_id: "", category_id: "" });

  // Categorías B2B
  const [b2bCategories, setB2bCategories] = useState<B2bCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState<string>("__root__");

  // Clasificación de los productos de EasyQuote (producto, compuesto, componente, kit)
  // según product_component_settings (compartida por api_user_id).
  const [calcKindById, setCalcKindById] = useState<Record<string, CalcKind>>({});
  const [kindFilter, setKindFilter] = useState<"__all__" | CalcKind>("__all__");

  const kindLabel: Record<CalcKind, string> = {
    producto: "Producto",
    compuesto: "Compuesto",
    componente: "Componente",
    kit: "Subproducto",
  };
  const kindBadgeVariant: Record<CalcKind, "default" | "secondary" | "outline"> = {
    producto: "default",
    compuesto: "secondary",
    componente: "outline",
    kit: "outline",
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft({ name: "", description: "", image_url: "", product_id: "", category_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (it: CatalogItem) => {
    setEditingId(it.id);
    setDraft({
      name: it.name ?? "",
      description: it.description ?? "",
      image_url: it.image_url ?? "",
      product_id: it.product_id ?? "",
      category_id: it.category_id ?? "",
    });
    setDialogOpen(true);
  };

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

    const { data: cats, error: catsErr } = await (supabase as any)
      .from("b2b_categories")
      .select("*")
      .eq("organization_id", orgId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (!catsErr) setB2bCategories(((cats as any[]) || []) as B2bCategory[]);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Cargar la clasificación (producto / compuesto / componente / kit) para los
  // productos de la org actual usando product_component_settings (api_user_id).
  useEffect(() => {
    (async () => {
      if (!orgId) return;
      const { data: org } = await supabase
        .from("organizations")
        .select("api_user_id")
        .eq("id", orgId)
        .maybeSingle();
      const apiUserId = (org as any)?.api_user_id;
      if (!apiUserId) return;
      const { data, error } = await supabase
        .from("product_component_settings")
        .select("easyquote_product_id, is_component, product_type")
        .eq("api_user_id", apiUserId);
      if (error || !data) return;
      const map: Record<string, CalcKind> = {};
      (data as any[]).forEach((r) => {
        let kind: CalcKind = "producto";
        if (r.is_component) kind = "componente";
        else if (r.product_type === "kit") kind = "kit";
        else if (r.product_type === "compuesto") kind = "compuesto";
        map[String(r.easyquote_product_id)] = kind;
      });
      setCalcKindById(map);
    })();
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
      if (kindFilter !== "__all__") {
        const k = calcKindById[p.id] || "producto";
        if (k !== kindFilter) return false;
      }
      return true;
    });
  }, [products, categoryFilter, showInactive, productCategoryById, kindFilter, calcKindById]);

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
    let error: any = null;
    if (editingId) {
      const res = await supabase
        .from("b2b_catalog_items")
        .update({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          image_url: draft.image_url.trim() || null,
          product_id: draft.product_id,
          category_id: draft.category_id || null,
        } as any)
        .eq("id", editingId);
      error = res.error;
    } else {
      const res = await supabase.from("b2b_catalog_items").insert({
        organization_id: orgId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        image_url: draft.image_url.trim() || null,
        display_order: items.length,
        is_active: true,
        product_id: draft.product_id,
        category_id: draft.category_id || null,
        default_prompts: {},
        exposed_prompt_ids: [],
      } as any);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    setEditingId(null);
    setDraft({ name: "", description: "", image_url: "", product_id: "", category_id: "" });
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

  // ===== Categorías B2B: helpers + CRUD =====
  const rootCategories = useMemo(
    () => b2bCategories.filter((c) => !c.parent_id),
    [b2bCategories],
  );
  const subCategoriesByParent = useMemo(() => {
    const map: Record<string, B2bCategory[]> = {};
    b2bCategories.forEach((c) => {
      if (c.parent_id) {
        (map[c.parent_id] ||= []).push(c);
      }
    });
    return map;
  }, [b2bCategories]);
  const categoryById = useMemo(
    () => Object.fromEntries(b2bCategories.map((c) => [c.id, c])),
    [b2bCategories],
  );
  const categoryFullName = (id: string | null): string => {
    if (!id) return "Sin categoría";
    const c = categoryById[id];
    if (!c) return "Sin categoría";
    if (c.parent_id && categoryById[c.parent_id]) {
      return `${categoryById[c.parent_id].name} › ${c.name}`;
    }
    return c.name;
  };

  const addB2bCategory = async () => {
    if (!orgId || !newCatName.trim()) return;
    const parentId = newCatParent === "__root__" ? null : newCatParent;
    const { error } = await (supabase as any).from("b2b_categories").insert({
      organization_id: orgId,
      parent_id: parentId,
      name: newCatName.trim(),
      display_order: b2bCategories.filter((c) => c.parent_id === parentId).length,
      is_active: true,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNewCatName("");
    setNewCatParent("__root__");
    load();
  };

  const renameB2bCategory = async (id: string, name: string) => {
    if (!name.trim()) return;
    const { error } = await (supabase as any)
      .from("b2b_categories")
      .update({ name: name.trim() })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setB2bCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)));
  };

  const removeB2bCategory = async (id: string) => {
    const subs = subCategoriesByParent[id]?.length || 0;
    const used = items.filter((i) => i.category_id === id).length;
    const msg =
      subs > 0
        ? `Esta categoría tiene ${subs} subcategoría(s). Se eliminarán también. ¿Continuar?`
        : used > 0
        ? `${used} producto(s) quedarán sin categoría. ¿Continuar?`
        : "¿Eliminar esta categoría?";
    if (!confirm(msg)) return;
    const { error } = await (supabase as any).from("b2b_categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  // Agrupación de items por categoría (para la lista)
  const itemsGrouped = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; items: CatalogItem[] }>();
    items.forEach((it) => {
      const key = it.category_id || "__none__";
      const label = it.category_id ? categoryFullName(it.category_id) : "Sin categoría";
      if (!groups.has(key)) groups.set(key, { key, label, items: [] });
      groups.get(key)!.items.push(it);
    });
    // Sort: with-category alphabetically, "Sin categoría" last
    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.label.localeCompare(b.label);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, b2bCategories]);

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
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold">Catálogo Portal B2B</h1>
        <p className="text-muted-foreground">
          Publica aquí los <strong>artículos</strong> que tus clientes podrán configurar desde el portal.
          Cada artículo usa como calculador un producto, componente o subproducto del motor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modo de funcionamiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="font-medium">Autoservicio</div>
            <Switch checked={selfService} onCheckedChange={toggleSelfService} />
          </div>
          <p className="text-sm text-muted-foreground">
              Si está activo, el presupuesto se crea como <strong>"Enviado"</strong> listo para que el cliente lo apruebe.
              Si está desactivado, queda como <strong>borrador</strong> para revisión del comercial antes de enviarlo.
          </p>
        </CardContent>
      </Card>

      {/* Gestión de categorías del portal B2B */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="w-5 h-5" />
            Categorías del portal
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Organiza tus artículos en categorías principales y subcategorías (un solo nivel de subcategoría).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Label>Nombre de la categoría</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ej: Papelería"
              />
            </div>
            <div className="w-[240px]">
              <Label>Categoría padre (opcional)</Label>
              <Select value={newCatParent} onValueChange={setNewCatParent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— Categoría principal —</SelectItem>
                  {rootCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addB2bCategory} disabled={!newCatName.trim()}>
              <Plus className="w-4 h-4 mr-2" /> Crear
            </Button>
          </div>

          {b2bCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no has creado ninguna categoría.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {rootCategories.map((root) => (
                <div key={root.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      defaultValue={root.name}
                      onBlur={(e) =>
                        e.target.value !== root.name && renameB2bCategory(root.id, e.target.value)
                      }
                      className="font-medium"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeB2bCategory(root.id)} title="Eliminar">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  {(subCategoriesByParent[root.id] || []).length > 0 && (
                    <div className="mt-2 ml-4 space-y-2 border-l pl-3">
                      {subCategoriesByParent[root.id].map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2">
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <Input
                            defaultValue={sub.name}
                            onBlur={(e) =>
                              e.target.value !== sub.name && renameB2bCategory(sub.id, e.target.value)
                            }
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeB2bCategory(sub.id)} title="Eliminar">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        <div className="lg:col-span-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Artículos publicados</CardTitle>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "artículo" : "artículos"} en el catálogo
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Añadir artículo
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
              <Package className="w-10 h-10 opacity-40" />
              <p className="text-sm">Aún no hay artículos publicados en el portal B2B.</p>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Añadir tu primer artículo
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {itemsGrouped.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    <FolderTree className="w-3.5 h-3.5" />
                    {group.label}
                    <span className="text-muted-foreground/70 normal-case font-normal">
                      · {group.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {group.items.map((it) => (
                      <div key={it.id} className="border rounded-md p-2.5 flex flex-col gap-2">
                        <div className="aspect-square w-full rounded-md bg-muted overflow-hidden flex items-center justify-center">
                          {it.image_url ? (
                            <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate" title={it.name}>{it.name}</div>
                          {it.product_id ? (
                            <div className="text-[10px] text-muted-foreground truncate" title={productNameById[it.product_id] || it.product_id}>
                              calc: {productNameById[it.product_id] || it.product_id}
                            </div>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] mt-0.5">Sin calculador</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={it.is_active}
                              onCheckedChange={(v) => updateItem(it.id, { is_active: v })}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {it.is_active ? "Activo" : "Oculto"}
                            </span>
                          </div>
                          <div className="flex items-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(it)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(it.id)} title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar artículo del catálogo" : "Añadir artículo al catálogo"}</DialogTitle>
            <DialogDescription>
              Define el artículo que verá el cliente y elige qué <strong>calculador</strong> (producto, componente o subproducto) usará para el precio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
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
                          const already =
                            usedProductIds.has(p.id) &&
                            p.id !== draft.product_id &&
                            !(editingId && items.find((i) => i.id === editingId)?.product_id === p.id);
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
              <Label>Categoría del portal</Label>
              <Select
                value={draft.category_id || "__none__"}
                onValueChange={(v) => setDraft({ ...draft, category_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  {rootCategories.flatMap((root) => [
                    <SelectItem key={root.id} value={root.id}>{root.name}</SelectItem>,
                    ...(subCategoriesByParent[root.id] || []).map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {"\u00A0\u00A0\u00A0\u00A0↳ "}{sub.name}
                      </SelectItem>
                    )),
                  ])}
                </SelectContent>
              </Select>
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
              <Label>Descripción</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={addItem} disabled={saving || !draft.name.trim() || !draft.product_id}>
              {editingId ? "Guardar cambios" : (<><Plus className="w-4 h-4 mr-2" /> Añadir al catálogo</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default B2bCatalog;
