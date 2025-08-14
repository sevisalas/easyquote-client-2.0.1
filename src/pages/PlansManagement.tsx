import { useState } from "react";
import { Settings, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface PlanInfo {
  id: string;
  name: string;
  description: string;
  excel_limit: number;
  client_user_limit: number;
  features: string[];
  price?: string;
}

const planes: PlanInfo[] = [
  {
    id: 'api_base',
    name: 'API Base',
    description: 'Plan básico para integración API',
    excel_limit: 100,
    client_user_limit: 1,
    features: ['API REST completa', 'Documentación técnica', 'Soporte por email'],
    price: '€29/mes'
  },
  {
    id: 'api_pro',
    name: 'API Pro',
    description: 'Plan avanzado para integración API',
    excel_limit: 500,
    client_user_limit: 1,
    features: ['API REST completa', 'Webhooks', 'Documentación técnica', 'Soporte prioritario', 'Analíticas avanzadas'],
    price: '€99/mes'
  },
  {
    id: 'client_base',
    name: 'Cliente Base',
    description: 'Plan básico con interfaz web',
    excel_limit: 100,
    client_user_limit: 2,
    features: ['Interfaz web completa', 'Gestión de presupuestos', 'PDF personalizables', 'Soporte por email'],
    price: '€49/mes'
  },
  {
    id: 'client_pro',
    name: 'Cliente Pro',
    description: 'Plan avanzado con interfaz web',
    excel_limit: 500,
    client_user_limit: 5,
    features: ['Interfaz web completa', 'Gestión multiusuario', 'API incluida', 'PDF personalizables', 'Soporte prioritario', 'Analíticas avanzadas'],
    price: '€149/mes'
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Plan adaptado a necesidades específicas',
    excel_limit: 1000,
    client_user_limit: 10,
    features: ['Todo incluido', 'Límites personalizados', 'Soporte dedicado', 'Integraciones específicas', 'SLA garantizado'],
    price: 'Consultar'
  }
];

const GestionPlanes = () => {
  const { isSuperAdmin } = useSubscription();

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso denegado</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a la gestión de planes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de planes</h1>
          <p className="text-muted-foreground">
            Configuración y detalles de los planes de suscripción
          </p>
        </div>
      </div>

      {/* Vista general de planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {planes.map((plan) => (
          <Card key={plan.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {plan.name}
                </CardTitle>
                <Badge variant="outline">{plan.price}</Badge>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Excel por mes:</span>
                  <span className="font-medium">{plan.excel_limit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Usuarios máximo:</span>
                  <span className="font-medium">{plan.client_user_limit}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  Características
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-primary rounded-full flex-shrink-0"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla comparativa */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativa de planes</CardTitle>
          <CardDescription>
            Tabla detallada con las características de cada plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Excel/mes</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>API</TableHead>
                <TableHead>Interfaz web</TableHead>
                <TableHead>Soporte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{plan.price}</Badge>
                  </TableCell>
                  <TableCell>{plan.excel_limit}</TableCell>
                  <TableCell>{plan.client_user_limit}</TableCell>
                  <TableCell>
                    {plan.id.includes('api') || plan.id === 'client_pro' || plan.id === 'custom' ? (
                      <Badge variant="default">Incluida</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.id.includes('client') || plan.id === 'custom' ? (
                      <Badge variant="default">Incluida</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.id.includes('pro') || plan.id === 'custom' ? (
                      <Badge variant="default">Prioritario</Badge>
                    ) : (
                      <Badge variant="secondary">Email</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionPlanes;