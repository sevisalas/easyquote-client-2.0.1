import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { CustomerName } from "@/components/quotes/CustomerName";
import { ProductionBoardViewSwitcher } from "@/components/production/ProductionBoardViewSwitcher";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Package, LayoutGrid, ExternalLink } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useProductionBoardView } from "@/hooks/useProductionBoardView";

interface Job {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate: string | null;
  customerId: string | null;
  orderStatus: string;
  itemId: string;
  productName: string;
  quantity: number;
  productionStatus: string;
}

const itemStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  completed: "Completado",
};

export default function ProductionBoard() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [excludeFinished, setExcludeFinished] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { view, updateView } = useProductionBoardView();

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const organizationId = sessionStorage.getItem("selected_organization_id");

      let query = supabase
        .from("sales_orders")
        .select("id, order_number, order_date, delivery_date, customer_id, status")
        .neq("status", "cancelled");

      if (organizationId) query = query.eq("organization_id", organizationId);

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      const orderIds = (ordersData || []).map((o) => o.id);
      if (orderIds.length === 0) {
        setJobs([]);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("sales_order_items")
        .select("id, sales_order_id, product_name, quantity, production_status, position")
        .in("sales_order_id", orderIds)
        .order("position");
      if (itemsError) throw itemsError;

      const ordersById = new Map((ordersData || []).map((o) => [o.id, o]));
      const flat: Job[] = (itemsData || []).map((it) => {
        const o = ordersById.get(it.sales_order_id)!;
        return {
          orderId: o.id,
          orderNumber: o.order_number,
          orderDate: o.order_date,
          deliveryDate: o.delivery_date,
          customerId: o.customer_id,
          orderStatus: o.status,
          itemId: it.id,
          productName: it.product_name,
          quantity: it.quantity,
          productionStatus: it.production_status || "pending",
        };
      });

      flat.sort((a, b) => {
        const ad = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
        const bd = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
        if (ad !== bd) return ad - bd;
        return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
      });

      setJobs(flat);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (excludeFinished && j.productionStatus === "completed") return false;
      if (statusFilter !== "all" && j.productionStatus !== statusFilter) return false;
      if (q) {
        const hay = `${j.orderNumber} ${j.productName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, excludeFinished, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-semibold text-muted-foreground">Cargando trabajos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="md:hidden flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Vista no disponible en móvil</h2>
        <p className="text-muted-foreground mb-6">
          Por favor, utiliza la vista Compacta o Tablero en dispositivos móviles
        </p>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => {
              updateView("compact");
              navigate("/panel-produccion-compacta");
            }}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Vista compacta
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              updateView("kanban");
              navigate("/panel-produccion-tablero");
            }}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Vista tablero
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-4">Panel de taller - Trabajos</h1>
          <ProductionBoardViewSwitcher view={view} onViewChange={updateView} />
        </div>

        <Card className="p-4 mb-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="search-jobs" className="text-xs">Buscar</Label>
            <Input
              id="search-jobs"
              placeholder="Nº pedido o artículo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En proceso</SelectItem>
                {!excludeFinished && <SelectItem value="completed">Completado</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="exclude-finished"
              checked={excludeFinished}
              onCheckedChange={(v) => {
                setExcludeFinished(v);
                if (v && statusFilter === "completed") setStatusFilter("all");
              }}
            />
            <Label htmlFor="exclude-finished" className="text-sm cursor-pointer">
              Excluir terminados
            </Label>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredJobs.length} trabajo{filteredJobs.length === 1 ? "" : "s"}
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-40">Nº pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Artículo</TableHead>
                <TableHead className="w-36">Estado</TableHead>
                <TableHead className="w-24 text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No hay trabajos pendientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((j) => (
                  <TableRow key={j.itemId}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(j.orderDate), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/pedidos/${j.orderId}`}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        {j.orderNumber}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CustomerName customerId={j.customerId} />
                    </TableCell>
                    <TableCell className="font-medium">{j.productName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          j.productionStatus === "completed"
                            ? "default"
                            : j.productionStatus === "in_progress"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {itemStatusLabels[j.productionStatus] || "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{j.quantity}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
