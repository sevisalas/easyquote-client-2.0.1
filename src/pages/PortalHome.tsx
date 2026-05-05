import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, FileText, ExternalLink, ShoppingBag, Send, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
}

interface CartLine {
  catalog_item_id?: string;
  name: string;
  quantity: number;
  notes?: string;
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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [requestNotes, setRequestNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

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
          .select("id, name, description, image_url")
          .eq("organization_id", cust.organization_id)
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        setCatalog((cat as CatalogItem[]) || []);
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

  const addToCart = (item: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.catalog_item_id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.catalog_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { catalog_item_id: item.id, name: item.name, quantity: 1 }];
    });
  };

  const submitRequest = async () => {
    if (!customer || cart.length === 0) return;
    setSubmittingRequest(true);
    const { error } = await portalSupabase.from("b2b_quote_requests").insert({
      organization_id: customer.organization_id,
      customer_id: customer.id,
      items: cart,
      notes: requestNotes.trim() || null,
      status: "pending",
    });
    setSubmittingRequest(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Solicitud enviada",
      description: "Tu petición ha sido recibida. Te contactaremos en breve.",
    });
    setCart([]);
    setRequestNotes("");
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
              <TabsTrigger value="request">
                <Send className="w-4 h-4 mr-2" /> Solicitar presupuesto
                {cart.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{cart.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="quotes">{QuotesPanel}</TabsContent>
            <TabsContent value="catalog">
              <Card>
                <CardHeader>
                  <CardTitle>Catálogo</CardTitle>
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
                          <Button size="sm" className="mt-3" onClick={() => addToCart(it)}>
                            <Plus className="w-4 h-4 mr-1" /> Solicitar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="request">
              <Card>
                <CardHeader>
                  <CardTitle>Tu solicitud</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aún no has añadido productos. Ve al catálogo y pulsa "Solicitar".
                    </p>
                  ) : (
                    <>
                      <div className="divide-y">
                        {cart.map((line, idx) => (
                          <div key={idx} className="py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{line.name}</div>
                              <Input
                                placeholder="Detalles (acabados, color, urgencia…)"
                                value={line.notes ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCart((p) => p.map((l, i) => i === idx ? { ...l, notes: v } : l));
                                }}
                                className="mt-1 text-xs"
                              />
                            </div>
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) => {
                                const v = Math.max(1, parseInt(e.target.value) || 1);
                                setCart((p) => p.map((l, i) => i === idx ? { ...l, quantity: v } : l));
                              }}
                              className="w-20"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Notas adicionales</label>
                        <Textarea
                          rows={3}
                          value={requestNotes}
                          onChange={(e) => setRequestNotes(e.target.value)}
                          placeholder="Plazo deseado, dirección de entrega, etc."
                        />
                      </div>
                      <Button
                        onClick={submitRequest}
                        disabled={submittingRequest}
                        style={{ backgroundColor: primary }}
                      >
                        {submittingRequest ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar solicitud
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          QuotesPanel
        )}
      </main>
    </div>
  );
};

export default PortalHome;