import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || "";
      try {
        const [{ count: total }, { count: pending }, { count: approved }] = await Promise.all([
          supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', uid),
          supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'pendiente'),
          supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'aprobado'),
        ]);
        setTotalQuotes(total ?? 0);
        setPendingCount(pending ?? 0);
        setApprovedCount(approved ?? 0);
      } catch (_e) {
        setTotalQuotes(0);
        setPendingCount(0);
        setApprovedCount(0);
      }
    };
    load();
  }, []);


  return (
    <div className="w-full space-y-8"> 
      <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard EasyQuote</h1>
          <p className="text-muted-foreground">Gestiona tus clientes y presupuestos</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Presupuestos
              </CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalQuotes}</div>
              <p className="text-xs text-muted-foreground">
                {pendingCount} pendientes, {approvedCount} aprobados
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Gestión de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Administra tu base de datos de clientes
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => navigate('/clientes')} 
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  Ver Clientes
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/clientes/nuevo')}
                  className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Cliente
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Presupuestos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Crea y gestiona presupuestos con EasyQuote API
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => navigate('/presupuestos')}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  Ver Presupuestos
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/presupuestos/nuevo')}
                  className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Presupuesto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};

export default Dashboard;