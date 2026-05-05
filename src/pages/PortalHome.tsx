import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, FileText } from "lucide-react";
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
        .select("name")
        .eq("id", cust.organization_id)
        .maybeSingle();
      if (org) setOrgName(org.name || "");

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
        .order("created_at", { ascending: false });
      setQuotes((qs as Quote[]) || []);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const logout = async () => {
    await portalSupabase.auth.signOut();
    navigate("/portal/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Para aprobar o rechazar un presupuesto, usa el enlace que te envió tu contacto por email.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PortalHome;