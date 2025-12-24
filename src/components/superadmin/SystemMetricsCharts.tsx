import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Cpu, HardDrive, Activity, Wifi } from "lucide-react";

// Datos simulados de métricas del sistema
const generateTimeSeriesData = () => {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      cpu: Math.floor(Math.random() * 40 + 30),
      ram: Math.floor(Math.random() * 30 + 50),
      network: Math.floor(Math.random() * 100 + 50),
      requests: Math.floor(Math.random() * 200 + 100),
    });
  }
  return data;
};

const generateDailyData = () => {
  const data = [];
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  days.forEach((day) => {
    data.push({
      day,
      quotes: Math.floor(Math.random() * 50 + 20),
      orders: Math.floor(Math.random() * 30 + 10),
      users: Math.floor(Math.random() * 10 + 5),
    });
  });
  return data;
};

const SystemMetricsCharts = () => {
  const timeSeriesData = generateTimeSeriesData();
  const dailyData = generateDailyData();

  // Calcular valores actuales (último punto)
  const currentMetrics = timeSeriesData[timeSeriesData.length - 1];

  return (
    <div className="space-y-6">
      {/* Métricas en tiempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Cpu className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CPU</p>
                <p className="text-xl font-bold text-foreground">{currentMetrics.cpu}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <HardDrive className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RAM</p>
                <p className="text-xl font-bold text-foreground">{currentMetrics.ram}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Wifi className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Red</p>
                <p className="text-xl font-bold text-foreground">{currentMetrics.network} KB/s</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Requests/h</p>
                <p className="text-xl font-bold text-foreground">{currentMetrics.requests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU & RAM */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              CPU & RAM (24h)
            </CardTitle>
            <CardDescription>Uso de recursos del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#colorCpu)"
                    name="CPU"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ram" 
                    stroke="hsl(142, 76%, 36%)" 
                    fill="url(#colorRam)"
                    name="RAM"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Network Activity */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Actividad de Red (24h)
            </CardTitle>
            <CardDescription>Tráfico y peticiones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="network" 
                    stroke="hsl(271, 91%, 65%)" 
                    strokeWidth={2}
                    dot={false}
                    name="Red (KB/s)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(25, 95%, 53%)" 
                    strokeWidth={2}
                    dot={false}
                    name="Requests/h"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actividad semanal */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Actividad Semanal</CardTitle>
          <CardDescription>Presupuestos, pedidos y usuarios activos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="day" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="quotes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Presupuestos" />
                <Bar dataKey="orders" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Pedidos" />
                <Bar dataKey="users" fill="hsl(271, 91%, 65%)" radius={[4, 4, 0, 0]} name="Usuarios" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemMetricsCharts;
