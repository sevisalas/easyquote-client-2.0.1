import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { STATUS_COLORS } from "@/lib/statusColors";
import { Badge } from "@/components/ui/badge";
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
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useProductionBoardView } from "@/hooks/useProductionBoardView";
import { useProductionPhases } from "@/hooks/useProductionPhases";
import { useStatusSettings } from "@/hooks/useStatusSettings";
import { TaskEditDialog, type EditableTask } from "@/components/production/TaskEditDialog";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getActiveOrganizationId } from "@/lib/activeOrganization";

interface Job {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate: string | null;
  customerId: string | null;
  customerName: string | null;
  orderStatus: string;
  itemId: string;
  productName: string;
  quantity: number;
  productionStatus: string;
  phaseTasks: Record<string, Array<{ id: string; taskName: string; status: "pending" | "in_progress" | "paused" | "completed"; resourceName?: string | null; resourceId?: string | null; phaseId: string }>>;
}

const itemStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

function PhaseIndicator({
  tasks,
  onEdit,
}: {
  tasks: Array<{ id: string; taskName: string; status: "pending" | "in_progress" | "paused" | "completed"; resourceName?: string | null; resourceId?: string | null; phaseId: string }>;
  onEdit: (task: EditableTask) => void;
}) {
  if (tasks.length === 0) {
    return <div className="h-10 rounded-md border border-dashed border-border/40 bg-muted/10" />;
  }

  const labelMap: Record<"pending" | "in_progress" | "paused" | "completed", string> = {
    pending: "Pendiente",
    in_progress: "En curso",
    paused: "Pausada",
    completed: "Terminada",
  };

  const statusStyles = {
    pending: { ...STATUS_COLORS.pending, label: STATUS_COLORS.pending.text },
    in_progress: { ...STATUS_COLORS.in_progress, label: STATUS_COLORS.in_progress.text },
    paused: { ...STATUS_COLORS.paused, label: STATUS_COLORS.paused.text },
    completed: { ...STATUS_COLORS.completed, label: STATUS_COLORS.completed.text },
  };

  return (
    <div className="flex flex-col gap-1">
      {tasks.map((task, index) => {
        const s = statusStyles[task.status];
        return (
          <button
            type="button"
            key={`${task.taskName}-${index}`}
            className="rounded-md border px-2 py-1 text-left leading-tight w-full hover:opacity-80 transition-opacity"
            title="Editar tarea"
            onClick={() =>
              onEdit({
                id: task.id,
                taskName: task.taskName,
                status: task.status,
                phaseId: task.phaseId,
                resourceId: task.resourceId ?? null,
              })
            }
            style={{
              backgroundColor: s.bg,
              borderColor: s.border,
              color: s.text,
            }}
          >
            {task.resourceName && (
              <div className="truncate text-[10px] font-semibold" title={task.resourceName}>
                {task.resourceName}
              </div>
            )}
            <div
              className="text-[9px] font-semibold"
              style={{ color: s.label }}
            >
              {labelMap[task.status]}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function ProductionBoard() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [excludeFinished, setExcludeFinished] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { membership, organization, loading: subscriptionLoading } = useSubscription();
  const { view, updateView } = useProductionBoardView();
  const { phases } = useProductionPhases();
  const { resolve: resolveStatus } = useStatusSettings();
  const activeOrganizationId = getActiveOrganizationId({
    sessionOrganizationId: sessionStorage.getItem("selected_organization_id"),
    membershipOrganizationId: membership?.organization_id,
    ownedOrganizationId: organization?.id,
  });

  useEffect(() => {
    if (subscriptionLoading || !activeOrganizationId) {
      setLoading(subscriptionLoading);
      return;
    }

    loadJobs(true);
    const interval = setInterval(() => loadJobs(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeOrganizationId, subscriptionLoading]);

  const loadJobs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const organizationId = activeOrganizationId;

      let query = supabase
        .from("sales_orders")
        .select("id, order_number, order_date, delivery_date, customer_id, status");

      if (organizationId) query = query.eq("organization_id", organizationId);
      // Only load orders that may have pending work — completed/cancelled excluded at DB level for speed.
      query = query.not("status", "in", "(completed,cancelled)");

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
      const tasksByItem = new Map<string, Array<{ id: string; phase_id: string; task_name: string; status: "pending" | "in_progress" | "paused" | "completed"; resource_id: string | null }>>();
      if (itemIds.length > 0) {
        const { data: tasksData } = await supabase
          .from("production_tasks")
          .select("id, sales_order_item_id, phase_id, task_name, status, resource_id")
          .in("sales_order_item_id", itemIds);
        for (const t of tasksData || []) {
          const arr = tasksByItem.get(t.sales_order_item_id) || [];
          const taskStatus = t.status as "pending" | "in_progress" | "paused" | "completed";
          arr.push({ id: (t as any).id, phase_id: t.phase_id, task_name: t.task_name, status: taskStatus, resource_id: (t as any).resource_id ?? null });
          tasksByItem.set(t.sales_order_item_id, arr);
        }
      }

      // Load resources to resolve resource_id -> name
      const resourcesById = new Map<string, string>();
      if (organizationId) {
        const { data: resourcesData } = await supabase
          .from("production_resources")
          .select("id, name")
          .eq("organization_id", organizationId);
        for (const r of resourcesData || []) resourcesById.set(r.id, r.name);
      }

      // Batch-fetch customer names (avoid N+1 from CustomerName component)
      const customerIds = Array.from(
        new Set((ordersData || []).map((o) => o.customer_id).filter(Boolean) as string[])
      );
      const customersById = new Map<string, string>();
      if (customerIds.length > 0) {
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds);
        for (const c of customersData || []) customersById.set(c.id, c.name || "");
      }

      const ordersById = new Map((ordersData || []).map((o) => [o.id, o]));
      const flat: Job[] = (itemsData || []).map((it) => {
        const o = ordersById.get(it.sales_order_id)!;
        const itemTasks = tasksByItem.get(it.id) || [];
        const phaseTasks: Job["phaseTasks"] = {};
        const byPhase: Map<string, Job["phaseTasks"][string]> = new Map();
        for (const t of itemTasks) {
          const arr = byPhase.get(t.phase_id) || [];
          arr.push({
            id: t.id,
            taskName: t.task_name,
            status: t.status,
            resourceName: t.resource_id ? resourcesById.get(t.resource_id) ?? null : null,
            resourceId: t.resource_id,
            phaseId: t.phase_id,
          });
          byPhase.set(t.phase_id, arr);
        }
        for (const [phaseId, tasks] of byPhase.entries()) {
          phaseTasks[phaseId] = tasks;
        }
        return {
          orderId: o.id,
          orderNumber: o.order_number,
          orderDate: o.order_date,
          deliveryDate: o.delivery_date,
          customerId: o.customer_id,
          customerName: o.customer_id ? customersById.get(o.customer_id) ?? null : null,
          orderStatus: o.status,
          itemId: it.id,
          productName: it.product_name,
          quantity: it.quantity,
          productionStatus:
            o.status === "cancelled" ? "cancelled" : it.production_status || "pending",
          phaseTasks,
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
      <div className="hidden md:hiddenx"></div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold mb-4">Panel de taller - Trabajos</h1>
        <ProductionBoardViewSwitcher view={view} onViewChange={updateView} />
      </div>

      <div className="md:hidden flex flex-col gap-3">
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="search-jobs-mobile" className="text-xs">Buscar</Label>
            <Input
              id="search-jobs-mobile"
              placeholder="Nº pedido o artículo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En curso</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="exclude-finished-mobile" className="text-sm cursor-pointer">
              Excluir terminados y cancelados
            </Label>
            <Switch
              id="exclude-finished-mobile"
              checked={excludeFinished}
              onCheckedChange={setExcludeFinished}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredJobs.length} trabajo{filteredJobs.length === 1 ? "" : "s"}
          </div>
        </Card>

        {filteredJobs.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No hay trabajos pendientes
          </Card>
        ) : (
          filteredJobs.map((j) => (
            <Card key={j.itemId} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/pedidos/${j.orderId}`}
                    className="inline-flex items-center gap-1 font-semibold text-sm hover:underline"
                  >
                    {j.orderNumber}
                    <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                  </Link>
                  <div className="text-[11px] text-muted-foreground truncate">{j.customerName || "—"}</div>
                  <div className="text-[11px] truncate">{j.productName}</div>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground flex-shrink-0">×{j.quantity}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground gap-3">
                <span>
                  Entrega: {j.deliveryDate ? format(new Date(j.deliveryDate), "dd/MM/yyyy", { locale: es }) : "—"}
                </span>
                <span>
                  Pedido: {format(new Date(j.orderDate), "dd/MM/yy", { locale: es })}
                </span>
              </div>

              <div>
                {(() => {
                  const mapped = resolveStatus(j.productionStatus);
                  return (
                    <Badge
                      className="border"
                      style={{ backgroundColor: mapped.style.bg, borderColor: mapped.style.border, color: mapped.style.text }}
                    >
                      {mapped.label}
                    </Badge>
                  );
                })()}
              </div>

              <div className="space-y-3">
                {phases.map((p) => (
                  <div key={`${j.itemId}-${p.id}`} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">{p.display_name}</span>
                    </div>
                    <PhaseIndicator tasks={j.phaseTasks[p.id] || []} onEdit={(task) => {
                      setEditingTask(task);
                      setEditOpen(true);
                    }} />
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="hidden md:block">

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
                <SelectItem value="in_progress">En curso</SelectItem>
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
          <Table className="w-max min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px] py-2 sticky left-0 bg-card z-10">Fechas</TableHead>
                <TableHead className="w-[300px] py-2 sticky left-[110px] bg-card z-10">Trabajo</TableHead>
                <TableHead className="w-[110px] py-2">Estado</TableHead>
                {phases.map((p) => (
                  <TableHead key={p.id} className="py-2 text-center px-1 min-w-[140px]" title={p.display_name}>
                    <div className="space-y-1">
                      <span className="block h-1.5 w-full rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground truncate">
                        {p.display_name}
                      </span>
                    </div>
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
                    <TableCell className="py-2 sticky left-[110px] bg-card z-10 align-top w-[300px] max-w-[300px]">
                      <div className="flex flex-col leading-tight min-w-0 w-[284px] max-w-[284px]">
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
                          {j.customerName || "—"}
                        </span>
                        <span className="text-[11px] truncate" title={j.productName}>
                          {j.productName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 align-top">
                      {(() => {
                        const r = resolveStatus(j.productionStatus);
                        return (
                          <Badge
                            className="border"
                            style={{ backgroundColor: r.style.bg, borderColor: r.style.border, color: r.style.text }}
                          >
                            {r.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    {phases.map((p) => {
                      const tasks = j.phaseTasks[p.id] || [];
                      return (
                        <TableCell key={p.id} className="py-1.5 px-1 align-middle">
                          <PhaseIndicator
                            tasks={tasks}
                            onEdit={(t) => {
                              setEditingTask(t);
                              setEditOpen(true);
                            }}
                          />
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
      <TaskEditDialog
        task={editingTask}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => loadJobs(false)}
      />
    </div>
  );
}
