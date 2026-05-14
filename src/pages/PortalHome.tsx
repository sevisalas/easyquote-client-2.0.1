import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, FileText, ExternalLink, ShoppingBag, Settings2, CheckCircle2, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { portalSupabase } from "./PortalLogin";
import PromptsFormLite from "@/components/portal/PromptsFormLite";
import { generatePortalQuotePDF } from "@/utils/portalPdfGenerator";

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
  default_prompts?: Record<string, any> | null;
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
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [b2bEnabled, setB2bEnabled] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [apiImages, setApiImages] = useState<Record<string, string>>({});

  // Configurator state
  const [configItem, setConfigItem] = useState<CatalogItem | null>(null);
  const [configOverrides, setConfigOverrides] = useState<Record<string, any>>({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  // Raw prompts (already filtered server-side by visibility) — passed as-is to PromptsFormLite.
  const [rawPrompts, setRawPrompts] = useState<any[]>([]);
  // Monotonic counter to ignore stale pricing responses (no debounce: every change
  // fires a request, but only the latest result wins).
  const pricingReqIdRef = useRef(0);

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

      // Org logo from PDF configuration
      const { data: pdfCfg } = await portalSupabase
        .from("pdf_configurations")
        .select("logo_url")
        .eq("organization_id", cust.organization_id)
        .maybeSingle();
      if (pdfCfg?.logo_url) setLogoUrl(pdfCfg.logo_url);

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
          .select("id, name, description, image_url, product_id, default_prompts")
          .eq("organization_id", cust.organization_id)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        const items = ((cat as any[]) || []) as CatalogItem[];
        setCatalog(items);
        // Fetch image outputs from API in parallel for each item
        items.forEach(async (it: CatalogItem) => {
          try {
            const { data } = await portalSupabase.functions.invoke("b2b-pricing", {
              body: { catalog_item_id: it.id, overrides: {} },
            });
            const outputs: any[] = (data as any)?.outputs || [];
            const imgOut = outputs.find((o) => {
              const t = String(o?.type || o?.outputType || "").toLowerCase();
              return t === "image";
            });
            const url = imgOut?.value || imgOut?.url || imgOut?.imageUrl;
            if (url && typeof url === "string") {
              setApiImages((prev) => ({ ...prev, [it.id]: url }));
            }
          } catch {
            // ignore
          }
        });
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
    // Open the tab synchronously to avoid popup blockers
    const win = window.open("about:blank", "_blank", "noopener");
    try {
      setOpeningId(quoteId);
      const { data: sess } = await portalSupabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) {
        if (win) win.close();
        navigate("/portal/login", { replace: true });
        return;
      }
      const { data, error } = await portalSupabase.functions.invoke("portal-issue-token", {
        body: { quote_id: quoteId },
      });
      if (error || !data?.token) {
        console.error("portal-issue-token failed", error);
        if (win) win.close();
        toast({ title: "No se pudo abrir el presupuesto", variant: "destructive" });
        return;
      }
      const url = `/portal/${data.token}`;
      if (win) {
        win.location.href = url;
      } else {
        // popup blocked — fallback to same-tab navigation
        window.location.href = url;
      }
    } finally {
      setOpeningId(null);
    }
  };

  const downloadPdf = async (quoteId: string) => {
    try {
      setDownloadingId(quoteId);
      const { data, error } = await portalSupabase.functions.invoke("portal-issue-token", {
        body: { quote_id: quoteId },
      });
      if (error || !data?.token) {
        toast({ title: "No se pudo generar el enlace", variant: "destructive" });
        return;
      }
      const quote = quotes.find((q) => q.id === quoteId);
      const filename = `${quote?.quote_number || "presupuesto"}.pdf`;
      await generatePortalQuotePDF(data.token, filename);
    } catch (e: any) {
      toast({
        title: "No se pudo descargar el PDF",
        description: e?.message || "Error",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const openConfig = async (item: CatalogItem) => {
    setConfigItem(item);
    // Pre-aplicar los valores por defecto definidos por el admin (p.ej. selector de subproducto).
    // Estos prompts no se mostrarán al cliente y se enviarán siempre como override al motor.
    const seeded: Record<string, any> = {};
    Object.entries((item.default_prompts || {}) as Record<string, any>).forEach(([id, v]) => {
      seeded[id] = (v && typeof v === "object" && "value" in v) ? (v as any).value : v;
    });
    setLivePrice(null);
    setPricingError(null);
    setRawPrompts([]);
    // Bump the request counter so any in-flight response from a previously open
    // item is discarded and won't flash an error here.
    pricingReqIdRef.current++;
    setPricingLoading(true);
    // Setting overrides triggers the useEffect below, which fires the single
    // pricing call. We deliberately don't call fetchPrice here too — duplicate
    // calls caused the initial "Error de cálculo" flash.
    setConfigOverrides(seeded);
  };

  const fetchPrice = async (item: CatalogItem, overrides: Record<string, any>) => {
    const myReqId = ++pricingReqIdRef.current;
    setPricingLoading(true);
    setPricingError(null);
    // After the first response we already have currentValue for every prompt
    // seeded into overrides — tell the edge function to skip the resolve GET
    // and do a single PATCH (saves one EasyQuote roundtrip).
    const skipResolve = rawPrompts.length > 0;
    try {
      const { data, error } = await portalSupabase.functions.invoke("b2b-pricing", {
        body: { catalog_item_id: item.id, overrides, skip_resolve: skipResolve },
      });
      // Discard if a newer request was issued meanwhile.
      if (myReqId !== pricingReqIdRef.current) return;
      if (error) throw error;
      const d = data as any;
      if (d?.error) {
        setPricingError(d.error);
        setLivePrice(null);
      } else {
        setLivePrice(typeof d.final_price === "number" ? d.final_price : null);
        // Raw prompts (filtered server-side by visibility) → PromptsFormLite respects type.
        const apiPrompts: any[] = d?.prompts || [];
        setRawPrompts(apiPrompts);
        // Seed override values from the API current value if the customer hasn't touched them
        setConfigOverrides((prev) => {
          let changed = false;
          const next = { ...prev };

          apiPrompts.forEach((p: any) => {
            const id = String(p.id);
            if (next[id] === undefined) {
              next[id] = p.currentValue ?? "";
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      }
    } catch (e: any) {
      if (myReqId !== pricingReqIdRef.current) return;
      setPricingError(e?.message || "Error de cálculo");
      setLivePrice(null);
    } finally {
      if (myReqId === pricingReqIdRef.current) setPricingLoading(false);
    }
  };

  // Recalc immediately on every override change. Stale responses are discarded
  // by the request-id check inside fetchPrice, so the latest one always wins.
  useEffect(() => {
    if (!configItem) return;
    fetchPrice(configItem, configOverrides);
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
                <div className="min-w-0 flex items-center gap-3 flex-wrap">
                  <span className="font-medium">{q.quote_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(q.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
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
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => downloadPdf(q.id)}
                    disabled={downloadingId === q.id}
                    title="Descargar PDF"
                    style={{ backgroundColor: primary, color: "#fff" }}
                  >
                    {downloadingId === q.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" /> PDF
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
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={orgName || "Logo"}
                className="h-10 w-auto max-w-[160px] object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <h1 className="text-xl font-bold truncate" style={{ color: primary }}>
                {orgName || "Portal"}
              </h1>
            )}
            <p className="text-sm text-muted-foreground truncate">
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
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Catálogo</h2>
                    <p className="text-sm text-muted-foreground">
                      Configura tu producto y obtén el precio al instante.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {catalog.length} {catalog.length === 1 ? "producto" : "productos"}
                  </Badge>
                </div>

                {catalog.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No hay productos publicados.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {catalog.map((it) => {
                      const src = apiImages[it.id] || it.image_url;
                      const disabled = !it.product_id;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => !disabled && openConfig(it)}
                          disabled={disabled}
                          className="group text-left bg-card border rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2"
                          style={{ ['--tw-ring-color' as any]: primary }}
                        >
                          <div className="relative aspect-square bg-muted overflow-hidden">
                            {src ? (
                              <img
                                src={src}
                                alt={it.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                Sin imagen
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                              <span
                                className="inline-flex items-center text-xs font-medium text-white px-3 py-1.5 rounded-full shadow-md"
                                style={{ backgroundColor: primary }}
                              >
                                <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Configurar
                              </span>
                            </div>
                          </div>
                          <div className="p-4 flex flex-col flex-1">
                            <div className="font-semibold leading-tight line-clamp-2">{it.name}</div>
                            {it.description && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 flex-1">
                                {it.description}
                              </p>
                            )}
                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                Precio a medida
                              </span>
                              <span
                                className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: primary }}
                              >
                                Ver precio →
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          QuotesPanel
        )}
      </main>

      <Dialog open={!!configItem} onOpenChange={(o) => !o && setConfigItem(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-2xl">{configItem?.name}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 pt-2">
            {/* Imagen izquierda */}
            <div className="space-y-4">
              <div className="aspect-square w-full bg-muted rounded-xl overflow-hidden border">
                {configItem && (apiImages[configItem.id] || configItem.image_url) ? (
                  <img
                    src={apiImages[configItem.id] || configItem.image_url || ""}
                    alt={configItem.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Sin imagen
                  </div>
                )}
              </div>
            </div>

            {/* Configurador derecha */}
            <div className="space-y-4">
              {rawPrompts.length === 0 && !pricingLoading && !pricingError && (
                <p className="text-sm text-muted-foreground">
                  Producto preconfigurado por el comercial. Revisa el precio y solicita.
                </p>
              )}
              <div className="max-h-[45vh] overflow-y-auto pr-1">
                <PromptsFormLite
                  prompts={rawPrompts.filter((p) => !((configItem?.default_prompts || {}) as any)[String(p.id)])}
                  values={configOverrides}
                  onChange={(id, value) =>
                    setConfigOverrides((prev) => ({ ...prev, [id]: value }))
                  }
                />
              </div>

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
          </div>

          {/* Descripción debajo, ancho completo */}
          {configItem?.description && (
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Descripción
              </h3>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {configItem.description}
              </p>
            </div>
          )}

          <DialogFooter className="px-6 py-4 mt-4 border-t bg-muted/30">
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