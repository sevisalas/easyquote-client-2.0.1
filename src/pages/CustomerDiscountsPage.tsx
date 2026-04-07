import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, ChevronRight, Percent, ExternalLink } from "lucide-react";
import CustomerDiscountsSection from "@/components/clientes/CustomerDiscountsSection";

interface CustomerWithDiscountCount {
  id: string;
  name: string;
  email: string | null;
  discount_count: number;
}

export default function CustomerDiscountsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { organization } = useSubscription();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const orgId = organization?.id;

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers_with_discounts", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      // Fetch customers
      const { data: custs, error: custErr } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("organization_id", orgId)
        .order("name");
      if (custErr) throw custErr;

      // Fetch discount counts
      const { data: discounts, error: discErr } = await supabase
        .from("customer_discounts" as any)
        .select("customer_id")
        .eq("organization_id", orgId)
        .eq("is_active", true);
      if (discErr) {
        console.log("[CustomerDiscountsPage] No discount access");
        return (custs || []).map((c: any) => ({ ...c, discount_count: 0 }));
      }

      const countMap: Record<string, number> = {};
      (discounts || []).forEach((d: any) => {
        countMap[d.customer_id] = (countMap[d.customer_id] || 0) + 1;
      });

      return (custs || []).map((c: any) => ({
        ...c,
        discount_count: countMap[c.id] || 0,
      })) as CustomerWithDiscountCount[];
    },
    enabled: !!orgId,
  });

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "p-3" : "p-6"}`}>
      <div className="max-w-3xl mx-auto">
        <header className={isMobile ? "mb-4" : "mb-6"}>
          <h1 className={`font-bold text-foreground mb-1 ${isMobile ? "text-2xl" : "text-3xl"}`}>
            Tarifas de cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona descuentos y recargos por cliente. Solo visible para administradores.
          </p>
        </header>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Cargando clientes...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center italic">
            {search ? "Sin resultados" : "No hay clientes"}
          </p>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Clientes ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filtered.map((c) => (
                  <Collapsible
                    key={c.id}
                    open={expandedId === c.id}
                    onOpenChange={(open) => setExpandedId(open ? c.id : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                              expandedId === c.id ? "rotate-90" : ""
                            }`}
                          />
                          <span className="text-sm font-medium truncate">{c.name}</span>
                          {c.discount_count > 0 && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {c.discount_count} tarifa{c.discount_count !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clientes/${c.id}/editar`);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-1">
                        {orgId && (
                          <CustomerDiscountsSection customerId={c.id} organizationId={orgId} />
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
