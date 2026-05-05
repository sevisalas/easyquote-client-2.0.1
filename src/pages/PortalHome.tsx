import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, FileText, ExternalLink, ShoppingBag, Settings2, CheckCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { portalSupabase } from "./PortalLogin";

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  final_price: number | null;
  created_at: string;
}

interface CustomerRow {
  id: string;
  name: string;
  trade_name: string | null;
  organization_id: string;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_id: string | null;
  exposed_prompt_ids: string[];
  default_prompts: Record<string, any>;
}

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  grouped: "Agrupado",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "approved") return "default";
  if (s === "rejected" || s === "cancelled") return "destructive";
  if (s === "sent") return "secondary";
  return "outline";
};

const PortalHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orgName, setOrgName] = useState("");
  const [primary, setPrimary] = useState<string>("#1B1B3A");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [b2bEnabled, setB2bEnabled] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  // Configurator state
  const [configItem, setConfigItem] = useState<CatalogItem | null>(null);
  const [configOverrides, setConfigOverrides] = useState<Record<string, any>>({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  // Prompt defs we discover via the first pricing call (so we can render proper inputs for exposed ones)
  const [exposedDefs, setExposedDefs] = useState<Array<{ id: string; label: string; options: { value: any; label: string }[] | null }>>([]);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await portalSupabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/portal/login", { replace: true });
        return;
      }

      // Read own customer row (RLS limits to portal_user_id = auth.uid())
      const { data: cust, error: cErr } = await portalSupabase
        .from("customers")
        .select("id, name, trade_name, organization_id")
        .maybeSingle();
      if (cErr || !cust) {
        await portalSupabase.auth.signOut();
        navigate("/portal/login", { replace: true });
        return;
      }
      setCustomer(cust);

      // Mark last login (best-effort; RLS allows update on own row? we keep it server-side later)
      // For now only read.

      // Org info (public-ish: name + theme)
      const { data: org } = await portalSupabase
        .from("organizations")
        .select("name, b2b_portal_enabled")
        .eq("id", cust.organization_id)
        .maybeSingle();
      if (org) setOrgName(org.name || "");
      const isB2b = !!(org as any)?.b2b_portal_enabled;
      setB2bEnabled(isB2b);

      const { data: theme } = await portalSupabase
        .from("organization_themes")
        .select("primary_color")
        .eq("organization_id", cust.organization_id)
        .eq("is_active", true)
        .maybeSingle();
      if (theme?.primary_color) setPrimary(theme.primary_color);

      const { data: qs } = await portalSupabase
        .from("quotes")
        .select("id, quote_number, status, final_price, created_at")
        .eq("customer_id", cust.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      setQuotes((qs as Quote[]) || []);

      if (isB2b) {
        const { data: cat } = await portalSupabase
          .from("b2b_catalog_items")
          .select("id, name, description, image_url, product_id, exposed_prompt_ids, default_prompts")
          .eq("organization_id", cust.organization_id)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        setCatalog(((cat as any[]) || []).map((c: any) => ({
          ...c,
          exposed_prompt_ids: c.exposed_prompt_ids || [],
          default_prompts: c.default_prompts || {},
        })));
      }

      setLoading(false);
    };
    load();
  }, [navigate]);

  const logout = async () => {
    await portalSupabase.auth.signOut();
    navigate("/portal/login", { replace: true });
  };

  const openQuote = async (quoteId: string) => {
    try {
      setOpeningId(quoteId);
      const { data: sess } = await portalSupabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) {
        navigate("/portal/login", { replace: true });
        return;
      }
      const { data, error } = await portalSupabase.functions.invoke("portal-issue-token", {
        body: { quote_id: quoteId },
      });
      if (error || !data?.token) {
        console.error("portal-issue-token failed", error);
        return;
      }
      window.open(`/portal/${data.token}`, "_blank", "noopener");
    } finally {
      setOpeningId(null);
    }
  };

  const openConfig = async (item: CatalogItem) => {
    setConfigItem(item);
    setConfigOverrides({});
    setLivePrice(null);
    setPricingError(null);
    setExposedDefs([]);
    await fetchPrice(item, {});
  };

  const fetchPrice = async (item: CatalogItem, overrides: Record<string, any>) => {
    setPricingLoading(true);
    setPricingError(null);
    try {
      const { data, error } = await portalSupabase.functions.invoke("b2b-pricing", {
        body: { catalog_item_id: item.id, overrides },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) {
        setPricingError(d.error);
        setLivePrice(null);
      } else {
        setLivePrice(typeof d.final_price === "number" ? d.final_price : null);
        // Hydrate exposed defs from API prompts
        const apiPrompts: any[] = d?.prompts || [];
        const exposedSet = new Set(item.exposed_prompt_ids || []);
        const defs = apiPrompts
          .filter((p) => exposedSet.has(String(p.id)))
          .map((p: any) => {
            const opts = p.valueOptions || p.options || p.values;
            const optionList = Array.isArray(opts) && opts.length > 0
              ? opts.map((o: any) => ({
                  value: o?.value ?? o?.id ?? o?.name ?? o,
                  label: String(o?.label ?? o?.name ?? o?.value ?? o),
                }))
              : null;
            return {
              id: String(p.id),
              label: p.promptText || p.label || p.id,
              options: optionList,
            };
          });
        setExposedDefs(defs);
        // Initialize override defaults from API current value if not yet set
        setConfigOverrides((prev) => {
          const next = { ...prev };
          apiPrompts.forEach((p: any) => {
            const id = String(p.id);
            if (exposedSet.has(id) && next[id] === undefined) {
              next[id] = p.currentValue ?? "";
            }
          });
          return next;
        });
      }
    } catch (e: any) {
      setPricingError(e?.message || "Error de cálculo");
      setLivePrice(null);
    } finally {
      setPricingLoading(false);
    }
  };

  // Debounce pricing recalc when overrides change
  useEffect(() => {
    if (!configItem) return;
    const t = setTimeout(() => {
      fetchPrice(configItem, configOverrides);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configOverrides]);

  const submitQuote = async () => {
    if (!configItem) return;
    setSubmittingQuote(true);
    try {
      const { data, error } = await portalSupabase.functions.invoke("b2b-create-quote", {
        body: {
          items: [{ catalog_item_id: configItem.id, overrides: configOverrides }],
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast({
        title: "✅ Presupuesto generado",
        description: `${d.quote_number} — ${Number(d.final_price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`,
      });
      setConfigItem(null);
      // Refresh quotes list
      if (customer) {
        const { data: qs } = await portalSupabase
          .from("quotes")
          .select("id, quote_number, status, final_price, created_at")
          .eq("customer_id", customer.id)
          .neq("status", "draft")
          .order("created_at", { ascending: false });
        setQuotes((qs as Quote[]) || []);
      }
    } catch (e: any) {
      toast({
        title: "No se pudo generar",
        description: e?.message || "Error",
        variant: "destructive",
      });
    } finally {
      setSubmittingQuote(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const QuotesPanel = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" /> Mis presupuestos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes presupuestos.</p>
        ) : (
          <div className="divide-y">
            {quotes.map((q) => (
              <div key={q.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{q.quote_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(q.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(q.status)}>{statusLabel[q.status] || q.status}</Badge>
                  <div className="text-sm font-semibold tabular-nums w-28 text-right">
                    {q.final_price != null
                      ? Number(q.final_price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })
                      : "—"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openQuote(q.id)}
                    disabled={openingId === q.id}
                  >
                    {openingId === q.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-1" /> Abrir
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: primary }}>{orgName || "Portal"}</h1>
            <p className="text-sm text-muted-foreground">
              {customer?.trade_name || customer?.name}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Salir
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {b2bEnabled ? (
          <Tabs defaultValue="quotes" className="space-y-4">
            <TabsList>
              <TabsTrigger value="quotes">
                <FileText className="w-4 h-4 mr-2" /> Mis presupuestos
              </TabsTrigger>
              <TabsTrigger value="catalog">
                <ShoppingBag className="w-4 h-4 mr-2" /> Catálogo
              </TabsTrigger>
            </TabsList>
            <TabsContent value="quotes">{QuotesPanel}</TabsContent>
            <TabsContent value="catalog">
              <Card>
                <CardHeader>
                  <CardTitle>Catálogo — pide tu presupuesto al instante</CardTitle>
                </CardHeader>
                <CardContent>
                  {catalog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay productos publicados.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {catalog.map((it) => (
                        <div key={it.id} className="border rounded-lg p-4 flex flex-col">
                          {it.image_url && (
                            <img
                              src={it.image_url}
                              alt={it.name}
                              className="w-full h-32 object-cover rounded mb-3"
                              loading="lazy"
                            />
                          )}
                          <div className="font-medium">{it.name}</div>
                          {it.description && (
                            <p className="text-xs text-muted-foreground mt-1 flex-1">{it.description}</p>
                          )}
                          <Button
                            size="sm"
                            className="mt-3"
                            style={{ backgroundColor: primary }}
                            onClick={() => openConfig(it)}
                            disabled={!it.product_id}
                          >
                            <Settings2 className="w-4 h-4 mr-1" /> Configurar y ver precio
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          QuotesPanel
        )}
      </main>

      <Dialog open={!!configItem} onOpenChange={(o) => !o && setConfigItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{configItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {configItem?.description && (
              <p className="text-sm text-muted-foreground">{configItem.description}</p>
            )}
            {exposedDefs.length === 0 && !pricingLoading && !pricingError && (
              <p className="text-sm text-muted-foreground">
                Producto preconfigurado por el comercial. Revisa el precio y solicita.
              </p>
            )}
            {exposedDefs.map((p) => (
              <div key={p.id}>
                <Label>{p.label}</Label>
                {p.options ? (
                  <Select
                    value={String(configOverrides[p.id] ?? "")}
                    onValueChange={(v) =>
                      setConfigOverrides((prev) => ({ ...prev, [p.id]: v }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {p.options.map((o, i) => (
                        <SelectItem key={i} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={configOverrides[p.id] ?? ""}
                    onChange={(e) =>
                      setConfigOverrides((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}

            <div className="border rounded-lg p-4 bg-muted/40 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Precio total</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: primary }}>
                  {pricingLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  ) : livePrice != null ? (
                    livePrice.toLocaleString("es-ES", { style: "currency", currency: "EUR" })
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              {pricingError && (
                <div className="text-xs text-destructive max-w-[200px] text-right">
                  {pricingError}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigItem(null)}>Cancelar</Button>
            <Button
              onClick={submitQuote}
              disabled={submittingQuote || pricingLoading || livePrice == null}
              style={{ backgroundColor: primary }}
            >
              {submittingQuote ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Pedir este presupuesto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalHome;