import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Fragment } from "react";
import { CheckCircle, XCircle, Loader2, FileText, Clock, AlertTriangle } from "lucide-react";
import { buildAutoDescriptionFromPrompts, syncPromptsWithQuantity, type QuantityPromptResolver } from "@/utils/approvedMultiQuantity";

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
    organization_id: string;
    validity_days: number | null;
    quantity_prompt_settings?: Record<string, QuantityPromptResolver>;
    items: Array<{
      id: string;
      product_id?: string | null;
      product_name: string;
      name?: string | null;
      description: string | null;
      description_manual?: boolean | null;
      quantity: number;
      price: number;
      prompts: any;
      outputs: any;
      multi?: any;
      item_additionals?: any;
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

const normalizePortalNumericString = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  return raw
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/(?!^)-/g, "");
};

const parsePortalQuantity = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const raw = normalizePortalNumericString(value);
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePortalNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = normalizePortalNumericString(value);
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPortalCurrency = (value: unknown): string => {
  const parsed = parsePortalNumber(value);
  return parsed.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
};

const formatPortalQuantity = (value: unknown): string => {
  const parsed = parsePortalQuantity(value);
  if (parsed === null) return String(value ?? "").trim();

  return parsed.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

const PortalQuote = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [approvalMode, setApprovalMode] = useState(false);

  const primaryColor = useMemo(() => {
    if (!data?.organization?.primary_color) return "#c83077";
    return `hsl(${data.organization.primary_color})`;
  }, [data?.organization?.primary_color]);

  useEffect(() => {
    if (!token) return;
    fetchQuoteData();
  }, [token]);

  // Initialize selection state once data loads
  useEffect(() => {
    if (!data?.quote?.items) return;
    const sel: Record<string, boolean> = {};
    const qty: Record<string, number> = {};
    for (const it of data.quote.items) {
      sel[it.id] = true;
      const rows = (it.multi as any)?.rows;
      if (Array.isArray(rows) && rows.length > 0) {
        const firstQty = parsePortalQuantity(rows[0]?.qty ?? rows[0]?.quantity ?? it.quantity ?? 1);
        if (firstQty !== null) {
          qty[it.id] = firstQty;
        }
      }
    }
    setSelectedItems(sel);
    setItemQuantities(qty);
  }, [data?.quote?.items]);

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

    if (action === "approved") {
      const approvedIds = Object.entries(selectedItems).filter(([, v]) => v).map(([k]) => k);
      if (approvedIds.length === 0) {
        setError("Selecciona al menos un artículo para aprobar");
        return;
      }
      // Check that every multi-qty selected item has a chosen quantity
      for (const it of data?.quote.items || []) {
        if (!selectedItems[it.id]) continue;
        const rows = (it.multi as any)?.rows;
        if (Array.isArray(rows) && rows.length > 1 && !itemQuantities[it.id]) {
          setError(`Selecciona una cantidad para "${it.product_name}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const approvedIds = Object.entries(selectedItems).filter(([, v]) => v).map(([k]) => k);
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/portal-quote?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({
            action,
            comment: comment || undefined,
            selectedItemIds: action === "approved" ? approvedIds : undefined,
            itemQuantities: action === "approved" ? itemQuantities : undefined,
          }),
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
  const canRespond = !actionDone && (quote.status === "sent" || quote.status === "draft");
  const isPending = canRespond && approvalMode;
  const getItemPriceForSelection = (item: any) => {
    const rows = item.multi?.rows;
    if (Array.isArray(rows) && rows.length > 0) {
      const sel = itemQuantities[item.id];
      const row = rows.find((r: any) => parsePortalQuantity(r.qty ?? r.quantity) === sel) || rows[0];
      const priceRaw =
        row?.outs?.find((o: any) => o.type === "Price")?.value ??
        row?.price ??
        item.price ??
        0;
      const base = parsePortalNumber(priceRaw);
      const qty = parsePortalQuantity(row?.qty ?? row?.quantity ?? item.quantity ?? 1) ?? 1;
      if (!Number.isFinite(base)) return { qty, price: parsePortalNumber(item.price) };
      return { qty, price: base };
    }
    return { qty: parsePortalQuantity(item.quantity) ?? 1, price: parsePortalNumber(item.price) };
  };

  const getItemDescriptionForSelection = (item: any, selectedQty: number | null) => {
    const description = (item.description || "").trim();
    const productName = (item.name || item.product_name || "").trim();
    const quantityResolver = item.product_id ? data?.quote?.quantity_prompt_settings?.[String(item.product_id)] : undefined;
    const baseAutoDescription = buildAutoDescriptionFromPrompts(item.prompts)?.trim();
    const selectedPrompts = selectedQty ? syncPromptsWithQuantity(item.prompts, selectedQty, quantityResolver) : item.prompts;
    const selectedAutoDescription = buildAutoDescriptionFromPrompts(selectedPrompts)?.trim();

    if (item.description_manual === true) {
      return description || null;
    }

    const descriptionLines = description
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const isComponentHeader = (line: string) => /^─+\s*.+\s*─+$/.test(line);
    const looksAutoGenerated =
      descriptionLines.length > 0 &&
      descriptionLines.every((line) => line.includes(":") || isComponentHeader(line));

    if (selectedAutoDescription && (!description || description === productName || description === baseAutoDescription || looksAutoGenerated)) {
      return selectedAutoDescription;
    }

    if (description && description !== productName) {
      return description;
    }

    return selectedAutoDescription || null;
  };

  const visibleSubtotal = quote.items.reduce((sum, item) => {
    if (isPending && !selectedItems[item.id]) return sum;
    const { price } = getItemPriceForSelection(item);
    return sum + price;
  }, 0);

  const visibleAdditionals = (quote.additionals || []).reduce((sum, add) => {
    const value = Math.abs(parsePortalNumber(add.value));
    return sum + (add.is_discount ? -value : value);
  }, 0);

  const displayedTotal = visibleSubtotal + visibleAdditionals;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with org branding */}
      <div className="w-full py-6 px-4" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          {organization.logo_url ? (
            <img
              src={organization.logo_url}
              alt={organization.name}
              className="h-12 w-auto rounded bg-white/90 p-1.5"
            />
          ) : (
            <h1 className="text-white text-xl font-bold">{organization.name}</h1>
          )}
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
                {quote.status === "approved" ? "Aprobado" : quote.status === "rejected" ? "Rechazado" : quote.status === "sent" ? "Preparado" : quote.status}
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
                    <th className="text-right py-2 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, itemIndex) => {
                    const rows = (item.multi as any)?.rows;
                    const hasMulti = Array.isArray(rows) && rows.length > 1;
                    const { qty, price } = getItemPriceForSelection(item);
                     const checked = selectedItems[item.id] ?? true;
                    const dimmed = isPending && !checked;
                     const selectedDescription = getItemDescriptionForSelection(item, qty);
                    return (
                      <Fragment key={item.id}>
                      <tr className={`border-b last:border-0 ${dimmed ? "opacity-40" : ""} ${hasMulti ? "border-b-0" : ""}`}>
                        <td className="py-3 pr-2">
                          <div className="flex items-start gap-2">
                            {isPending && (
                              <Checkbox
                                className="mt-1"
                                checked={checked}
                                onCheckedChange={(v) =>
                                  setSelectedItems((prev) => ({ ...prev, [item.id]: v === true }))
                                }
                              />
                            )}
                             <div className="min-w-0">
                               <div className="font-medium">{item.name || item.product_name}</div>
                               {(() => {
                                 const desc = (selectedDescription || "").trim();
                                  const name = (item.name || item.product_name || "").trim();
                                 if (desc && desc !== name) {
                                   return (
                                     <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed break-words">
                                       {desc}
                                     </div>
                                   );
                                 }
                                 const prompts = Array.isArray(item.prompts) ? item.prompts : [];
                                 const specs = prompts
                                   .filter((p: any) => p && p.label && p.value !== undefined && p.value !== null && String(p.value).trim() !== "")
                                   .map((p: any) => {
                                     let v = String(p.value);
                                     if (/^https?:\/\//i.test(v)) {
                                       const fn = v.split("/").pop() || v;
                                       v = fn.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]/g, " ");
                                     }
                                     return `${p.label}: ${v}`;
                                   });
                                 if (specs.length === 0) return null;
                                 return (
                                   <div className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                                     {specs.map((s, i) => <div key={i}>{s}</div>)}
                                   </div>
                                 );
                               })()}
                             </div>
                          </div>
                        </td>
                        <td className="text-right py-3 pl-2 align-top">
                          {hasMulti ? (
                            <div className="font-medium">{formatPortalCurrency(price)}</div>
                          ) : (
                            <div className="font-medium align-top">{formatPortalCurrency(price)}</div>
                          )}
                        </td>
                      </tr>
                      {hasMulti && rows.map((r: any, i: number) => {
                        const rowQty = parsePortalQuantity(r.qty ?? r.quantity);
                        if (rowQty === null) return null;
                        const rowPrice = parsePortalNumber(
                          r?.outs?.find((o: any) => o.type === "Price")?.value ?? r?.price ?? 0
                        );
                        const isSelected = Number(itemQuantities[item.id]) === rowQty;
                        const rowDimmed = isPending && (!checked || (checked && !isSelected));
                        return (
                          <tr
                            key={`${item.id}-r${i}`}
                            className={`border-b last:border-0 ${rowDimmed ? "opacity-50" : ""} ${isPending && checked && isSelected ? "bg-muted/40" : ""}`}
                          >
                            <td className="py-2 pl-8 pr-2">
                              {isPending && checked ? (
                                <Label className="flex items-center gap-2 cursor-pointer text-sm font-normal">
                                  <input
                                    type="radio"
                                    name={`qty-${item.id}`}
                                    className="accent-current"
                                    style={{ accentColor: primaryColor }}
                                    checked={isSelected}
                                    onChange={() =>
                                      setItemQuantities((prev) => ({ ...prev, [item.id]: rowQty }))
                                    }
                                  />
                                  <span>Opción {i + 1} · {formatPortalQuantity(rowQty)} ud</span>
                                </Label>
                              ) : (
                                <span className="text-xs text-muted-foreground pl-1">Opción {i + 1} · {formatPortalQuantity(rowQty)} ud</span>
                              )}
                            </td>
                            <td className="text-right py-2 pl-2 text-sm font-medium">
                              {formatPortalCurrency(rowPrice)}
                            </td>
                          </tr>
                        );
                      })}
                       {itemIndex < quote.items.length - 1 && (
                         <tr aria-hidden="true">
                           <td colSpan={2} className="py-0">
                             <div className="my-2 h-[2px] w-full bg-border/80" />
                           </td>
                         </tr>
                       )}
                      </Fragment>
                    );
                  })}
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
                        {add.is_discount ? "-" : "+"}{formatPortalCurrency(Math.abs(parsePortalNumber(add.value)))}
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
                {formatPortalCurrency(displayedTotal)}
              </span>
            </div>
            {isPending && (
              <p className="text-xs text-muted-foreground text-right">
                Total estimado según artículos, cantidades y ajustes seleccionados.
              </p>
            )}

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
        ) : !approvalMode ? (
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
                  onClick={() => { setError(null); setApprovalMode(true); }}
                  disabled={submitting}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
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
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Selecciona los artículos y cantidades a aprobar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Marca los artículos que quieres aprobar. Para los que tengan varias opciones de cantidad, elige una.
              </p>
              <Textarea
                placeholder="Añadir un comentario (opcional)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setApprovalMode(false); setError(null); }}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => handleAction("approved")}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Confirmar aprobación
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
