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
import { useProductionPhases } from "@/hooks/useProductionPhases";

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
  phaseStatuses: Record<string, "pending" | "in_progress" | "paused" | "completed" | "none">;
}

const itemStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  completed: "Completado",
  cancelled: "Cancelado",
};

function PhaseIndicator({
  color,
  phaseName,
  status,
}: {
  color: string;
  phaseName: string;
  status: "pending" | "in_progress" | "paused" | "completed" | "none";
}) {
  if (status === "none") {
    return (
      <div className="flex flex-col items-center justify-center h-12 rounded-md border border-dashed border-border/50 bg-muted/20 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground/50 truncate max-w-full">
          {phaseName}
        </span>
        <span className="text-[9px] text-muted-foreground/40">N/A</span>
      </div>
    );
  }
  const labelMap = {
    pending: "Pendiente",
    in_progress: "En curso",
    paused: "Pausada",
    completed: "Hecha",
  } as const;

  const base = "flex flex-col items-center justify-center h-12 rounded-md px-1 leading-tight";

  if (status === "pending") {
    return (
      <div
        className={base}
        style={{ backgroundColor: `${color}14`, boxShadow: `inset 0 0 0 1.5px ${color}` }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-tight truncate max-w-full"
          style={{ color }}
        >
          {phaseName}
        </span>
        <span className="text-[9px] font-medium" style={{ color }}>
          {labelMap.pending}
        </span>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div
        className={`${base} animate-pulse text-white`}
        style={{ backgroundColor: color }}
      >
        <span className="text-[10px] font-bold uppercase tracking-tight truncate max-w-full">
          {phaseName}
        </span>
        <span className="text-[9px] font-semibold">{labelMap.in_progress}</span>
      </div>
    );
  }

  if (status === "paused") {
    return (
      <div
        className={`${base} text-white`}
        style={{ backgroundColor: color, opacity: 0.65 }}
      >
        <span className="text-[10px] font-bold uppercase tracking-tight truncate max-w-full">
          {phaseName}
        </span>
        <span className="text-[9px] font-semibold">{labelMap.paused}</span>
      </div>
    );
  }

  // completed
  return (
    <div className={`${base} text-white`} style={{ backgroundColor: color }}>
      <span className="text-[10px] font-bold uppercase tracking-tight truncate max-w-full">
        {phaseName}
      </span>
      <span className="text-[9px] font-semibold inline-flex items-center gap-0.5">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5,6.5 5,9 9.5,3.5" />
        </svg>
        {labelMap.completed}
      </span>
    </div>
  );
}

export default function ProductionBoard() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [excludeFinished, setExcludeFinished] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { view, updateView } = useProductionBoardView();
  const { phases } = useProductionPhases();

  useEffect(() => {
    loadJobs(true);
    const interval = setInterval(() => loadJobs(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const organizationId = sessionStorage.getItem("selected_organization_id");

      let query = supabase
        .from("sales_orders")
        .select("id, order_number, order_date, delivery_date, customer_id, status");

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

      const itemIds = (itemsData || []).map((it) => it.id);
      const tasksByItem = new Map<string, Array<{ phase_id: string; status: string }>>();
      if (itemIds.length > 0) {
        const { data: tasksData } = await supabase
          .from("production_tasks")
          .select("sales_order_item_id, phase_id, status")
          .in("sales_order_item_id", itemIds);
        for (const t of tasksData || []) {
          const arr = tasksByItem.get(t.sales_order_item_id) || [];
          arr.push({ phase_id: t.phase_id, status: t.status });
          tasksByItem.set(t.sales_order_item_id, arr);
        }
      }

      const ordersById = new Map((ordersData || []).map((o) => [o.id, o]));
      const flat: Job[] = (itemsData || []).map((it) => {
        const o = ordersById.get(it.sales_order_id)!;
        const itemTasks = tasksByItem.get(it.id) || [];
        const phaseStatuses: Job["phaseStatuses"] = {};
        // Group by phase, aggregate: in_progress > paused > pending > completed (all)
        const byPhase = new Map<string, string[]>();
        for (const t of itemTasks) {
          const arr = byPhase.get(t.phase_id) || [];
          arr.push(t.status);
          byPhase.set(t.phase_id, arr);
        }
        for (const [phaseId, statuses] of byPhase.entries()) {
          if (statuses.includes("in_progress")) phaseStatuses[phaseId] = "in_progress";
          else if (statuses.includes("paused")) phaseStatuses[phaseId] = "paused";
          else if (statuses.every((s) => s === "completed")) phaseStatuses[phaseId] = "completed";
          else phaseStatuses[phaseId] = "pending";
        }
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
          productionStatus:
            o.status === "cancelled" ? "cancelled" : it.production_status || "pending",
          phaseStatuses,
        };
      });

      flat.sort((a, b) => {
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
      if (statusFilter !== "all") {
        if (j.productionStatus !== statusFilter) return false;
      } else if (excludeFinished) {
        if (j.productionStatus === "completed" || j.productionStatus === "cancelled") return false;
      }
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
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="exclude-finished"
              checked={excludeFinished}
              onCheckedChange={setExcludeFinished}
            />
            <Label htmlFor="exclude-finished" className="text-sm cursor-pointer">
              Excluir terminados y cancelados
            </Label>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredJobs.length} trabajo{filteredJobs.length === 1 ? "" : "s"}
          </div>
        </Card>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px] py-2 sticky left-0 bg-card z-10">Fechas</TableHead>
                <TableHead className="w-[300px] py-2 sticky left-[110px] bg-card z-10">Trabajo</TableHead>
                <TableHead className="w-[110px] py-2">Estado</TableHead>
                {phases.map((p) => (
                  <TableHead
                    key={p.id}
                    className="py-2 text-center px-1 min-w-[104px]"
                    title={p.display_name}
                  >
                    <span
                      className="block h-1.5 w-full rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + phases.length} className="text-center text-muted-foreground py-12">
                    No hay trabajos pendientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((j) => (
                  <TableRow key={j.itemId} className="hover:bg-muted/30">
                    <TableCell className="py-2 sticky left-0 bg-card z-10 align-top">
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm font-medium whitespace-nowrap">
                          {j.deliveryDate
                            ? format(new Date(j.deliveryDate), "dd/MM/yyyy", { locale: es })
                            : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          ped. {format(new Date(j.orderDate), "dd/MM/yy", { locale: es })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 sticky left-[110px] bg-card z-10 align-top">
                      <div className="flex flex-col leading-tight min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/pedidos/${j.orderId}`}
                            className="inline-flex items-center gap-1 font-semibold text-sm hover:underline truncate"
                          >
                            {j.orderNumber}
                            <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                          </Link>
                          <span className="text-[11px] tabular-nums text-muted-foreground flex-shrink-0">
                            ×{j.quantity}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">
                          <CustomerName customerId={j.customerId} />
                        </span>
                        <span className="text-[11px] truncate" title={j.productName}>
                          {j.productName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 align-top">
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
                    {phases.map((p) => {
                      const st = j.phaseStatuses[p.id] || "none";
                      return (
                        <TableCell key={p.id} className="py-1.5 px-1 align-middle">
                          <PhaseIndicator color={p.color} phaseName={p.display_name} status={st} />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
