import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Loader2, FileText, Clock, AlertTriangle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface PortalQuoteData {
  quote: {
    id: string;
    quote_number: string;
    status: string;
    final_price: number | null;
    notes: string | null;
    created_at: string;
    validity_days: number | null;
    items: Array<{
      id: string;
      product_name: string;
      description: string | null;
      quantity: number;
      price: number;
      prompts: any;
      outputs: any;
    }>;
    additionals: Array<{
      id: string;
      name: string;
      value: number;
      is_discount: boolean;
    }>;
  };
  organization: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
  };
  customer_name: string;
  existing_action: { action: string; created_at: string; comment: string | null } | null;
}

const PortalQuote = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const primaryColor = useMemo(() => {
    if (!data?.organization?.primary_color) return "#c83077";
    return `hsl(${data.organization.primary_color})`;
  }, [data?.organization?.primary_color]);

  useEffect(() => {
    if (!token) return;
    fetchQuoteData();
  }, [token]);

  const fetchQuoteData = async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/portal-quote?token=${token}`,
        { headers: { apikey: SUPABASE_KEY } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al cargar");
      }
      const result = await res.json();
      setData(result);
      if (result.existing_action) {
        setActionDone(result.existing_action.action);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "approved" | "rejected") => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/portal-quote?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({ action, comment: comment || undefined }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al enviar");
      }
      setActionDone(action);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500">Cargando presupuesto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">No se pudo cargar el presupuesto</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { quote, organization, customer_name } = data;
  const subtotal = quote.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with org branding */}
      <div className="w-full py-6 px-4" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          {organization.logo_url && (
            <img src={organization.logo_url} alt={organization.name} className="h-10 w-auto rounded bg-white/90 p-1" />
          )}
          <h1 className="text-white text-xl font-bold">{organization.name}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6 -mt-4">
        {/* Quote summary card */}
        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6" style={{ color: primaryColor }} />
                <CardTitle className="text-2xl">Presupuesto {quote.quote_number}</CardTitle>
              </div>
              <Badge variant={quote.status === "approved" ? "default" : quote.status === "rejected" ? "destructive" : "secondary"}>
                {quote.status === "approved" ? "Aprobado" : quote.status === "rejected" ? "Rechazado" : quote.status === "sent" ? "Enviado" : quote.status}
              </Badge>
            </div>
            {customer_name && <p className="text-muted-foreground mt-1">Cliente: {customer_name}</p>}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Producto</th>
                    <th className="text-right py-2 px-2">Cant.</th>
                    <th className="text-right py-2 px-2">Precio</th>
                    <th className="text-right py-2 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-2">
                        <div className="font-medium">{item.product_name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                        )}
                      </td>
                      <td className="text-right py-3 px-2">{item.quantity}</td>
                      <td className="text-right py-3 px-2">{Number(item.price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</td>
                      <td className="text-right py-3 pl-2 font-medium">
                        {(item.quantity * item.price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Additionals */}
            {quote.additionals && quote.additionals.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  {quote.additionals.map((add) => (
                    <div key={add.id} className="flex justify-between text-sm">
                      <span className={add.is_discount ? "text-green-600" : ""}>{add.name}</span>
                      <span className={add.is_discount ? "text-green-600" : ""}>
                        {add.is_discount ? "-" : "+"}{Number(Math.abs(add.value)).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Total */}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                {Number(quote.final_price || subtotal).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </span>
            </div>

            {/* Validity info */}
            {quote.validity_days && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Válido durante {quote.validity_days} días desde su emisión</span>
              </div>
            )}

            {/* Notes */}
            {quote.notes && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">Notas:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action section */}
        {actionDone ? (
          <Card className="shadow-lg">
            <CardContent className="pt-6 text-center space-y-3">
              {actionDone === "approved" ? (
                <>
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                  <h2 className="text-xl font-semibold text-green-700">Presupuesto aprobado</h2>
                  <p className="text-muted-foreground">Gracias por su confirmación. Nos pondremos en contacto para los próximos pasos.</p>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-red-400 mx-auto" />
                  <h2 className="text-xl font-semibold text-red-600">Presupuesto rechazado</h2>
                  <p className="text-muted-foreground">Hemos registrado su respuesta. No dude en contactarnos si desea realizar cambios.</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">¿Qué desea hacer con este presupuesto?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Añadir un comentario (opcional)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => handleAction("approved")}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Aprobar presupuesto
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => handleAction("rejected")}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Rechazar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-8">
          Enviado desde {organization.name} · Powered by EasyQuote
        </p>
      </div>
    </div>
  );
};

export default PortalQuote;
