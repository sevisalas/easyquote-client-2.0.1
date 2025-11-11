import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSalesOrders, SalesOrder } from "@/hooks/useSalesOrders";

const statusColors = {
  pending: "default",
  in_production: "secondary",
  completed: "default",
  cancelled: "destructive",
} as const;

const statusLabels = {
  pending: "Pendiente",
  in_production: "En Producción",
  completed: "Completado",
  cancelled: "Cancelado",
};

const SalesOrdersList = () => {
  const navigate = useNavigate();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrders } = useSalesOrders();
  const [orders, setOrders] = useState<SalesOrder[]>([]);

  useEffect(() => {
    if (!canAccessProduccion()) {
      navigate("/");
      return;
    }
    loadOrders();
  }, [canAccessProduccion, navigate]);

  const loadOrders = async () => {
    const data = await fetchSalesOrders();
    setOrders(data);
  };

  if (!canAccessProduccion()) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Pedidos
          </h1>
          <p className="text-muted-foreground">Gestionar pedidos generados desde presupuestos</p>
        </div>
        <Button onClick={() => navigate("/pedidos/nuevo")}>
          Crear nuevo pedido
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} registrado{orders.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando pedidos...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay pedidos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                      </TableCell>
                      <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>{order.final_price.toFixed(2)} €</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/pedidos/${order.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesOrdersList;
