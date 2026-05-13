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
  default_prompts?: Record<string, any> | null;
}

interface ProductOption {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

type CalcKind = "producto" | "componente" | "subproducto";

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
    default_prompts: Record<string, any>;
  }>({ name: "", description: "", image_url: "", product_id: "", category_id: "", default_prompts: {} });

  // Selector de subproducto (para productos con has_subproducts=true)
  const [apiUserId, setApiUserId] = useState<string | null>(null);
  const [subSelector, setSubSelector] = useState<{
    promptId: string;
    label: string;
    options: { value: string; displayText: string }[];
  } | null>(null);
  const [loadingSubSelector, setLoadingSubSelector] = useState(false);

  // Categorías B2B
  const [b2bCategories, setB2bCategories] = useState<B2bCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState<string>("__root__");
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);

  // Clasificación de los artículos de EasyQuote para el portal (producto, componente, subproducto)
  // según product_component_settings (compartida por api_user_id).
  const [calcKindById, setCalcKindById] = useState<Record<string, CalcKind>>({});
  const [kindFilter, setKindFilter] = useState<"__all__" | CalcKind>("__all__");

  const kindLabel: Record<CalcKind, string> = {
    producto: "Producto",
    componente: "Componente",
    subproducto: "Subproducto",
  };
  const kindBadgeVariant: Record<CalcKind, "default" | "secondary" | "outline"> = {
    producto: "default",
    componente: "secondary",
    subproducto: "outline",
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft({ name: "", description: "", image_url: "", product_id: "", category_id: "", default_prompts: {} });
    setSubSelector(null);
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
      default_prompts: (it.default_prompts as any) || {},
    });
    setSubSelector(null);
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

  // Cargar la clasificación (producto / componente / subproducto) para los
  // productos de la org actual usando product_component_settings (api_user_id).
  useEffect(() => {
    (async () => {
      if (!orgId) return;
      const { data: org } = await supabase
        .from("organizations")
        .select("api_user_id")
        .eq("id", orgId)
        .maybeSingle();
      const aui = (org as any)?.api_user_id;
      if (!aui) return;
      setApiUserId(aui);
      const { data, error } = await supabase
        .from("product_component_settings")
        .select("easyquote_product_id, is_component, has_subproducts")
        .eq("api_user_id", aui);
      if (error || !data) return;
      const map: Record<string, CalcKind> = {};
      (data as any[]).forEach((r) => {
        let kind: CalcKind = "producto";
        if (r.is_component) kind = "componente";
        else if (r.has_subproducts) kind = "subproducto";
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
    // Si el calculador es un subproducto, exigir resolución del selector
    if (subSelector && subSelector.options.length > 0) {
      const v = (draft.default_prompts || {})[subSelector.promptId]?.value;
      if (!v) {
        toast({ title: "Falta el subproducto", description: `Resuelve el campo "${subSelector.label}" para que quede asignado automáticamente al cliente.`, variant: "destructive" });
        return;
      }
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
          default_prompts: draft.default_prompts || {},
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
        default_prompts: draft.default_prompts || {},
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
    setDraft({ name: "", description: "", image_url: "", product_id: "", category_id: "", default_prompts: {} });
    setSubSelector(null);
    load();
  };

  // Cargar el selector de subproducto cuando se elige un producto con has_subproducts.
  // Se obtiene el prompt marcado is_subproduct_selector y sus opciones desde easyquote-pricing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pid = draft.product_id;
      if (!pid || !apiUserId) { setSubSelector(null); return; }
      const kind = calcKindById[pid];
      if (kind !== "subproducto") { setSubSelector(null); return; }
      setLoadingSubSelector(true);
      try {
        // 1) Encontrar qué prompt es el selector (por celda/nombre/label)
        const { data: settings } = await supabase
          .from("product_prompt_settings")
          .select("prompt_name, label, is_subproduct_selector")
          .eq("api_user_id", apiUserId)
          .eq("easyquote_product_id", pid)
          .eq("is_subproduct_selector", true);
        const keys = new Set<string>();
        (settings as any[] || []).forEach((s) => {
          if (s.prompt_name) keys.add(String(s.prompt_name).trim().toUpperCase());
          if (s.label) keys.add(String(s.label).trim().toUpperCase());
        });
        if (keys.size === 0) {
          if (!cancelled) setSubSelector(null);
          return;
        }
        // 2) Obtener prompts + valueOptions del motor
        const token = await getEasyQuoteToken();
        if (!token) { if (!cancelled) setSubSelector(null); return; }
        const { data } = await invokeEasyQuoteFunction<any>("easyquote-pricing", { token, productId: pid });
        const prompts: any[] = Array.isArray(data?.prompts) ? data.prompts : [];
        const norm = (v: any) => String(v ?? "").trim().toUpperCase();
        const selector = prompts.find((p) => {
          const id = norm(p?.id);
          const label = norm(p?.label ?? p?.promptText ?? p?.name);
          const cell = norm(p?.promptCell ?? p?.cell);
          return keys.has(id) || keys.has(label) || keys.has(cell);
        });
        if (!selector) { if (!cancelled) setSubSelector(null); return; }
        const rawOpts = selector.valueOptions ?? selector.options ?? selector.choices ?? selector.values ?? selector.items ?? selector.optionsList ?? [];
        const options = (Array.isArray(rawOpts) ? rawOpts : []).map((o: any) => {
          if (typeof o === "string" || typeof o === "number") {
            return { value: String(o), displayText: String(o) };
          }
          const value = String(o?.value ?? o?.id ?? o?.key ?? o?.displayText ?? o?.label ?? "");
          const displayText = String(o?.displayText ?? o?.label ?? o?.text ?? o?.name ?? o?.value ?? "");
          return { value, displayText };
        }).filter((o: any) => o.value);
        if (!cancelled) {
          setSubSelector({
            promptId: String(selector.id),
            label: String(selector.promptText ?? selector.label ?? selector.name ?? "Subproducto"),
            options,
          });
        }
      } catch (e) {
        if (!cancelled) setSubSelector(null);
      } finally {
        if (!cancelled) setLoadingSubSelector(false);
      }
    })();
    return () => { cancelled = true; };
  }, [draft.product_id, apiUserId, calcKindById]);

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

  const uploadDraftImage = async (file: File) => {
    if (!orgId || !file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo no válido", description: "Sube una imagen (PNG, JPG, WebP…)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagen demasiado grande", description: "Máximo 5 MB", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${orgId}/b2b/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      setUploadingImage(false);
      toast({ title: "Error al subir", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: signed } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    const url = signed?.signedUrl || "";
    setUploadingImage(false);
    if (url) {
      setDraft((d) => ({ ...d, image_url: url }));
      toast({ title: "Imagen subida" });
    }
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
          {/* Árbol de categorías primero */}
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

          {/* Botón Añadir nuevo que despliega el formulario */}
          <div className="pt-2 border-t">
            {!showAddCategoryForm ? (
              <Button variant="outline" onClick={() => setShowAddCategoryForm(true)} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Añadir nueva categoría
              </Button>
            ) : (
              <div className="space-y-3">
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
                <Button variant="ghost" size="sm" onClick={() => { setShowAddCategoryForm(false); setNewCatName(""); setNewCatParent("__root__"); }}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
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
                            <div className="flex items-center gap-1 mt-0.5 min-w-0">
                              <Badge
                                variant={kindBadgeVariant[calcKindById[it.product_id] || "producto"]}
                                className="text-[9px] px-1 py-0 shrink-0"
                              >
                                {kindLabel[calcKindById[it.product_id] || "producto"]}
                              </Badge>
                              <span
                                className="text-[10px] text-muted-foreground truncate"
                                title={productNameById[it.product_id] || it.product_id}
                              >
                                {productNameById[it.product_id] || it.product_id}
                              </span>
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
              Un artículo del portal se compone de 4 cosas: un <strong>nombre</strong>, una <strong>categoría del portal</strong>, un <strong>calculador asignado</strong> (producto, componente o subproducto del motor) y una <strong>imagen</strong> que lo represente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* 1. Nombre */}
            <section className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Type className="w-4 h-4" /> 1. Nombre del artículo
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej: Tarjetas de visita"
              />
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                placeholder="Descripción corta visible al cliente (opcional)"
              />
            </section>

            {/* 2. Categoría del portal */}
            <section className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <FolderTree className="w-4 h-4" /> 2. Categoría del artículo en el portal
              </Label>
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
              {b2bCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aún no has creado categorías del portal. Puedes crearlas en el panel de la izquierda.
                </p>
              )}
            </section>

            {/* 3. Calculador asignado */}
            <section className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Calculator className="w-4 h-4" /> 3. Calculador asignado
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Elige qué elemento del motor calculará el precio: un <strong>producto</strong>, un <strong>componente</strong> o un <strong>subproducto</strong>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos los tipos</SelectItem>
                    <SelectItem value="producto">Producto</SelectItem>
                    <SelectItem value="componente">Componente</SelectItem>
                    <SelectItem value="subproducto">Subproducto</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Categoría motor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las categorías</SelectItem>
                    <SelectItem value="__uncat__">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate flex items-center gap-2">
                      {draft.product_id ? (
                        <>
                          <Badge variant={kindBadgeVariant[calcKindById[draft.product_id] || "producto"]} className="text-[10px]">
                            {kindLabel[calcKindById[draft.product_id] || "producto"]}
                          </Badge>
                          <span className="truncate">{productNameById[draft.product_id] || draft.product_id}</span>
                        </>
                      ) : products.length === 0 ? (
                        "Cargando elementos del motor…"
                      ) : (
                        "Selecciona el calculador"
                      )}
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
                    <CommandInput placeholder="Buscar por nombre, categoría o tipo…" />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.map((p) => {
                          const already =
                            usedProductIds.has(p.id) &&
                            p.id !== draft.product_id &&
                            !(editingId && items.find((i) => i.id === editingId)?.product_id === p.id);
                          const kind = calcKindById[p.id] || "producto";
                          return (
                            <CommandItem
                              key={p.id}
                              value={`${p.id}|${p.name}|${p.category}|${kindLabel[kind]}`.toLowerCase()}
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
                                <div className="truncate font-medium flex items-center gap-2">
                                  <Badge variant={kindBadgeVariant[kind]} className="text-[10px] shrink-0">
                                    {kindLabel[kind]}
                                  </Badge>
                                  <span className="truncate">{p.name}</span>
                                </div>
                                {(p.category || already || !p.isActive) && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
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

              {/* Resolución del subproducto: si el calculador es un subproducto, hay que dejar el selector previo
                  ya elegido por el admin para que el cliente final no tenga que tocarlo. */}
              {draft.product_id && calcKindById[draft.product_id] === "subproducto" && (
                <div className="mt-3 rounded-md border border-dashed bg-muted/40 p-3 space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-2">
                    <ChevronRight className="w-3 h-3" />
                    Subproducto a aplicar — {subSelector?.label || "selector"}
                    <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    El cliente verá este artículo con esta opción ya resuelta. No podrá cambiarla.
                  </p>
                  {loadingSubSelector ? (
                    <p className="text-xs text-muted-foreground">Cargando opciones…</p>
                  ) : !subSelector ? (
                    <p className="text-xs text-destructive">
                      No se encontró el campo selector de subproducto. Configúralo en Gestión de productos.
                    </p>
                  ) : subSelector.options.length === 0 ? (
                    <p className="text-xs text-destructive">El selector no tiene opciones disponibles.</p>
                  ) : (
                    <Select
                      value={(draft.default_prompts?.[subSelector.promptId]?.value as string) || ""}
                      onValueChange={(v) => {
                        const opt = subSelector.options.find((o) => o.value === v);
                        setDraft({
                          ...draft,
                          default_prompts: {
                            ...(draft.default_prompts || {}),
                            [subSelector.promptId]: {
                              label: subSelector.label,
                              value: v,
                              displayText: opt?.displayText || v,
                              order: 0,
                            },
                          },
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elige el subproducto" />
                      </SelectTrigger>
                      <SelectContent>
                        {subSelector.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.displayText}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </section>

            {/* 4. Imagen */}
            <section className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <ImageIcon className="w-4 h-4" /> 4. Imagen que lo representa
              </Label>
              <div className="flex items-start gap-3">
                <div className="w-24 h-24 rounded-md border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {draft.image_url ? (
                    <img src={draft.image_url} alt="Vista previa" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadDraftImage(f);
                          e.target.value = "";
                        }}
                      />
                      <Button asChild variant="outline" size="sm" disabled={uploadingImage}>
                        <span className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingImage ? "Subiendo…" : "Subir imagen"}
                        </span>
                      </Button>
                    </label>
                    {draft.image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDraft({ ...draft, image_url: "" })}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                  <Input
                    value={draft.image_url}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    placeholder="…o pega una URL https://…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si no se define, se usará la imagen que devuelva el calculador (si existe).
                  </p>
                </div>
              </div>
            </section>
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
