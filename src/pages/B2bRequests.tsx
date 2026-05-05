import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Inbox, ArrowRight } from "lucide-react";

interface RequestItem {
  id: string;
  customer_id: string;
  notes: string | null;
  items: Array<{ catalog_item_id?: string; name: string; quantity: number; notes?: string }>;
  status: string;
  created_at: string;
  converted_quote_id: string | null;
  customer?: { name: string; trade_name: string | null } | null;
}

const statusBadge = (s: string) => {
  if (s === "converted") return <Badge variant="default">Convertida</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rechazada</Badge>;
  return <Badge variant="secondary">Pendiente</Badge>;
};

const B2bRequests = () => {
  const { organization } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const orgId = organization?.id;

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("b2b_quote_requests")
      .select("*, customer:customers(name, trade_name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRequests((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const convertToDraft = async (req: RequestItem) => {
    if (!orgId) return;
    setBusyId(req.id);
    try {
      // 1. Create quote in draft (no number yet — backoffice asignará al guardar)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: numData, error: numErr } = await supabase.rpc("next_document_number", {
        p_organization_id: orgId,
        p_document_type: "quote",
      });
      if (numErr) throw numErr;
      const quoteNumber = (numData as any)?.[0]?.document_number || `B2B-${Date.now()}`;

      const descriptionLines = req.items
        .map((it) => `• ${it.name} × ${it.quantity}${it.notes ? ` — ${it.notes}` : ""}`)
        .join("\n");
      const fullDesc = [
        "Solicitud recibida desde Portal B2B.",
        descriptionLines,
        req.notes ? `\nNotas del cliente: ${req.notes}` : "",
      ].filter(Boolean).join("\n");

      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .insert({
          organization_id: orgId,
          customer_id: req.customer_id,
          quote_number: quoteNumber,
          status: "draft",
          description: fullDesc,
          user_id: user?.id,
        })
        .select("id")
        .single();
      if (qErr) throw qErr;

      // 2. Mark request as converted
      await supabase
        .from("b2b_quote_requests")
        .update({
          status: "converted",
          converted_quote_id: quote.id,
          converted_at: new Date().toISOString(),
          converted_by: user?.id,
        })
        .eq("id", req.id);

      toast({ title: "Solicitud convertida", description: `Borrador ${quoteNumber} creado.` });
      navigate(`/presupuestos/editar/${quote.id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    if (!confirm("¿Rechazar esta solicitud?")) return;
    await supabase.from("b2b_quote_requests").update({ status: "rejected" }).eq("id", id);
    load();
  };

  if (loading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Inbox className="w-7 h-7" /> Solicitudes Portal B2B
        </h1>
        <p className="text-muted-foreground">
          Peticiones de presupuesto enviadas por tus clientes desde el portal.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay solicitudes recibidas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {r.customer?.trade_name || r.customer?.name || "Cliente"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {statusBadge(r.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("es-ES")}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-sm space-y-1">
                  {r.items.map((it, idx) => (
                    <li key={idx}>
                      • <strong>{it.name}</strong> × {it.quantity}
                      {it.notes ? <span className="text-muted-foreground"> — {it.notes}</span> : null}
                    </li>
                  ))}
                </ul>
                {r.notes && (
                  <p className="text-sm text-muted-foreground italic">"{r.notes}"</p>
                )}
                {r.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => convertToDraft(r)} disabled={busyId === r.id}>
                      Convertir en presupuesto <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject(r.id)}>
                      Rechazar
                    </Button>
                  </div>
                )}
                {r.status === "converted" && r.converted_quote_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/presupuestos/${r.converted_quote_id}`)}
                  >
                    Ver presupuesto
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default B2bRequests;