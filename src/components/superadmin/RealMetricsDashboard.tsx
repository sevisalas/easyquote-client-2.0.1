import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import { Activity, Clock, AlertTriangle, TrendingUp, Building2, FileText, ShoppingCart, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

interface ApiMetric {
  function_name: string;
  date: string;
  total_calls: number;
  avg_response_time: number;
  max_response_time: number;
  p95_response_time: number;
  error_count: number;
}

interface OrgStats {
  organization_id: string;
  organization_name: string;
  quotes_count: number;
  orders_count: number;
}

interface DailyActivity {
  date: string;
  quotes: number;
  orders: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function RealMetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [apiMetrics, setApiMetrics] = useState<ApiMetric[]>([]);
  const [orgStats, setOrgStats] = useState<OrgStats[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [totals, setTotals] = useState({
    totalQuotes: 0,
    totalOrders: 0,
    avgResponseTime: 0,
    totalApiCalls: 0,
    errorRate: 0
  });

  useEffect(() => {
    loadAllMetrics();
  }, []);

  const loadAllMetrics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadApiPerformanceMetrics(),
        loadOrganizationStats(),
        loadDailyActivity()
      ]);
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadApiPerformanceMetrics = async () => {
    // Obtener métricas de rendimiento de los últimos 30 días
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    
    const { data, error } = await supabase
      .from('api_performance_metrics')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading API metrics:", error);
      return;
    }

    // Agrupar por función y día
    const grouped = (data || []).reduce((acc: Record<string, ApiMetric>, item) => {
      const date = format(new Date(item.created_at), 'yyyy-MM-dd');
      const key = `${item.function_name}-${date}`;
      
      if (!acc[key]) {
        acc[key] = {
          function_name: item.function_name,
          date,
          total_calls: 0,
          avg_response_time: 0,
          max_response_time: 0,
          p95_response_time: 0,
          error_count: 0
        };
      }
      
      acc[key].total_calls++;
      acc[key].avg_response_time = Math.round(
        (acc[key].avg_response_time * (acc[key].total_calls - 1) + item.response_time_ms) / acc[key].total_calls
      );
      acc[key].max_response_time = Math.max(acc[key].max_response_time, item.response_time_ms);
      if (item.status_code && item.status_code >= 400) {
        acc[key].error_count++;
      }
      
      return acc;
    }, {});

    const metrics = Object.values(grouped);
    setApiMetrics(metrics);

    // Calcular totales
    const totalCalls = data?.length || 0;
    const avgTime = totalCalls > 0 
      ? Math.round(data!.reduce((sum, m) => sum + m.response_time_ms, 0) / totalCalls)
      : 0;
    const errors = data?.filter(m => m.status_code && m.status_code >= 400).length || 0;
    
    setTotals(prev => ({
      ...prev,
      totalApiCalls: totalCalls,
      avgResponseTime: avgTime,
      errorRate: totalCalls > 0 ? Math.round((errors / totalCalls) * 100 * 100) / 100 : 0
    }));
  };

  const loadOrganizationStats = async () => {
    // Obtener estadísticas por organización
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgsError) {
      console.error("Error loading organizations:", orgsError);
      return;
    }

    const stats: OrgStats[] = [];
    let totalQuotes = 0;
    let totalOrders = 0;

    for (const org of orgs || []) {
      const [quotesResult, ordersResult] = await Promise.all([
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
        supabase.from('sales_orders').select('id', { count: 'exact', head: true }).eq('organization_id', org.id)
      ]);

      const quotesCount = quotesResult.count || 0;
      const ordersCount = ordersResult.count || 0;
      
      totalQuotes += quotesCount;
      totalOrders += ordersCount;

      if (quotesCount > 0 || ordersCount > 0) {
        stats.push({
          organization_id: org.id,
          organization_name: org.name,
          quotes_count: quotesCount,
          orders_count: ordersCount
        });
      }
    }

    setOrgStats(stats.sort((a, b) => (b.quotes_count + b.orders_count) - (a.quotes_count + a.orders_count)));
    setTotals(prev => ({ ...prev, totalQuotes, totalOrders }));
  };

  const loadDailyActivity = async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    
    const [quotesResult, ordersResult] = await Promise.all([
      supabase.from('quotes').select('created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('sales_orders').select('created_at').gte('created_at', thirtyDaysAgo)
    ]);

    // Agrupar por día
    const dailyData: Record<string, DailyActivity> = {};
    
    // Inicializar últimos 30 días
    for (let i = 0; i < 30; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyData[date] = { date, quotes: 0, orders: 0 };
    }

    (quotesResult.data || []).forEach(q => {
      const date = format(new Date(q.created_at), 'yyyy-MM-dd');
      if (dailyData[date]) dailyData[date].quotes++;
    });

    (ordersResult.data || []).forEach(o => {
      const date = format(new Date(o.created_at), 'yyyy-MM-dd');
      if (dailyData[date]) dailyData[date].orders++;
    });

    const sortedDaily = Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        date: format(new Date(d.date), 'dd MMM', { locale: es })
      }));

    setDailyActivity(sortedDaily);
  };

  // Preparar datos para gráfica de rendimiento por función
  const functionPerformanceData = apiMetrics.reduce((acc: Record<string, { name: string; avg: number; max: number; calls: number }>, m) => {
    if (!acc[m.function_name]) {
      acc[m.function_name] = { name: m.function_name.replace('easyquote-', ''), avg: 0, max: 0, calls: 0 };
    }
    acc[m.function_name].avg = Math.round((acc[m.function_name].avg * acc[m.function_name].calls + m.avg_response_time) / (acc[m.function_name].calls + 1));
    acc[m.function_name].max = Math.max(acc[m.function_name].max, m.max_response_time);
    acc[m.function_name].calls += m.total_calls;
    return acc;
  }, {});

  const performanceChartData = Object.values(functionPerformanceData).sort((a, b) => b.avg - a.avg);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando métricas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Llamadas API (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalApiCalls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tiempo Medio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgResponseTime}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Tasa de Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.errorRate > 5 ? 'text-destructive' : 'text-green-600'}`}>
              {totals.errorRate}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividad diaria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Actividad Diaria (30 días)
            </CardTitle>
            <CardDescription>Presupuestos y pedidos creados por día</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="quotes" 
                    name="Presupuestos" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    name="Pedidos" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rendimiento por función */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Rendimiento API por Función
            </CardTitle>
            <CardDescription>Tiempo de respuesta medio y máximo (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {performanceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value}ms`,
                        name === 'avg' ? 'Promedio' : 'Máximo'
                      ]}
                    />
                    <Legend formatter={(value) => value === 'avg' ? 'Promedio' : 'Máximo'} />
                    <Bar dataKey="avg" fill="hsl(var(--primary))" name="avg" />
                    <Bar dataKey="max" fill="hsl(var(--chart-3))" name="max" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No hay datos de rendimiento API aún. Las métricas se registrarán automáticamente.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uso por organización */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Uso por Organización
            </CardTitle>
            <CardDescription>Presupuestos y pedidos totales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {orgStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orgStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="organization_name" 
                      tick={{ fontSize: 10 }} 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="quotes_count" name="Presupuestos" fill="hsl(var(--primary))" />
                    <Bar dataKey="orders_count" name="Pedidos" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos de organizaciones
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribución de documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Distribución por Organización
            </CardTitle>
            <CardDescription>Top 5 organizaciones por actividad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {orgStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orgStats.slice(0, 5).map(o => ({
                        name: o.organization_name,
                        value: o.quotes_count + o.orders_count
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name.substring(0, 15)}... (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {orgStats.slice(0, 5).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos de distribución
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
