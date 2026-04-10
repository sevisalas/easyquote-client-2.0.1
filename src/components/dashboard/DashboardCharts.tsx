import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart, Legend,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS_BACK = 6;

const useQuotesByMonth = () =>
  useQuery({
    queryKey: ["dashboard-quotes-by-month"],
    queryFn: async () => {
      const since = subMonths(startOfMonth(new Date()), MONTHS_BACK - 1).toISOString();
      const { data, error } = await supabase
        .from("quotes")
        .select("created_at, status")
        .gte("created_at", since);
      if (error) throw error;

      const buckets: Record<string, { created: number; approved: number }> = {};
      for (let i = MONTHS_BACK - 1; i >= 0; i--) {
        const key = format(subMonths(new Date(), i), "yyyy-MM");
        buckets[key] = { created: 0, approved: 0 };
      }

      data?.forEach((q) => {
        const key = format(new Date(q.created_at), "yyyy-MM");
        if (buckets[key]) {
          buckets[key].created++;
          if (q.status === "approved") buckets[key].approved++;
        }
      });

      return Object.entries(buckets).map(([month, v]) => ({
        month: format(new Date(month + "-01"), "MMM yy", { locale: es }),
        Creados: v.created,
        Aprobados: v.approved,
        "% Conversión": v.created > 0 ? Math.round((v.approved / v.created) * 100) : 0,
      }));
    },
  });

const useRevenueByMonth = () =>
  useQuery({
    queryKey: ["dashboard-revenue-by-month"],
    queryFn: async () => {
      const since = subMonths(startOfMonth(new Date()), MONTHS_BACK - 1).toISOString();
      const { data, error } = await supabase
        .from("quotes")
        .select("created_at, final_price, status")
        .eq("status", "approved")
        .gte("created_at", since);
      if (error) throw error;

      const buckets: Record<string, number> = {};
      for (let i = MONTHS_BACK - 1; i >= 0; i--) {
        buckets[format(subMonths(new Date(), i), "yyyy-MM")] = 0;
      }

      data?.forEach((q) => {
        const key = format(new Date(q.created_at), "yyyy-MM");
        if (buckets[key] !== undefined) {
          buckets[key] += Number(q.final_price) || 0;
        }
      });

      return Object.entries(buckets).map(([month, total]) => ({
        month: format(new Date(month + "-01"), "MMM yy", { locale: es }),
        Facturación: Math.round(total * 100) / 100,
      }));
    },
  });

const useActivityByUser = () =>
  useQuery({
    queryKey: ["dashboard-activity-by-user"],
    queryFn: async () => {
      const since = subMonths(startOfMonth(new Date()), MONTHS_BACK - 1).toISOString();
      const { data: quotes, error: qErr } = await supabase
        .from("quotes")
        .select("user_id")
        .gte("created_at", since);
      if (qErr) throw qErr;

      const counts: Record<string, number> = {};
      quotes?.forEach((q) => {
        counts[q.user_id] = (counts[q.user_id] || 0) + 1;
      });

      const userIds = Object.keys(counts);
      if (userIds.length === 0) return [];

      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const nameMap: Record<string, string> = {};
      members?.forEach((m) => {
        if (m.display_name) nameMap[m.user_id] = m.display_name;
      });

      return Object.entries(counts)
        .map(([uid, count]) => ({
          name: nameMap[uid] || uid.slice(0, 8),
          Presupuestos: count,
        }))
        .sort((a, b) => b.Presupuestos - a.Presupuestos)
        .slice(0, 10);
    },
  });

const ChartSkeleton = () => (
  <Card>
    <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
    <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
  </Card>
);

const PRIMARY = "hsl(332, 61%, 49%)";
const SECONDARY = "hsl(266, 93%, 17%)";
const SUCCESS = "hsl(187, 75%, 45%)";

export function DashboardCharts() {
  const { data: monthlyData, isLoading: l1 } = useQuotesByMonth();
  const { data: revenueData, isLoading: l2 } = useRevenueByMonth();
  const { data: activityData, isLoading: l3 } = useActivityByUser();

  return (
    <div className="mt-8">
      <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">Métricas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Presupuestos por mes + conversión */}
        {l1 ? <ChartSkeleton /> : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Presupuestos por mes y conversión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis yAxisId="left" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} unit="%" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Creados" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Aprobados" fill={SUCCESS} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="% Conversión" stroke={SECONDARY} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Facturación */}
        {l2 ? <ChartSkeleton /> : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Facturación aprobada por mes (€)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString("es-ES")} €`} />
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="Facturación" stroke={PRIMARY} fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Actividad por usuario */}
        {l3 ? <ChartSkeleton /> : activityData && activityData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actividad por comercial (últimos 6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, activityData.length * 40)}>
                <BarChart data={activityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="name" type="category" fontSize={12} width={120} />
                  <Tooltip />
                  <Bar dataKey="Presupuestos" fill={SECONDARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
