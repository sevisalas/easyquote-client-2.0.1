import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntegrationAccess } from "@/hooks/useIntegrationAccess";

export default function Integrations() {
  const { hasIntegrationAccess, loading } = useIntegrationAccess();

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has access to integrations
  if (!hasIntegrationAccess) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Acceso restringido</h2>
            <p className="text-muted-foreground">
              No tienes acceso al módulo de integraciones. Contacta a tu administrador para obtener acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Integraciones</CardTitle>
          <CardDescription>
            Página en construcción. Las integraciones estarán disponibles próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta funcionalidad está siendo desarrollada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}