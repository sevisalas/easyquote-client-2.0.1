import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function QuoteDetail() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Detalle de Presupuesto</span>
            <Button onClick={() => navigate(-1)}>Volver</Button>
          </CardTitle>
          <CardDescription>
            Página en construcción. Los detalles de presupuestos estarán disponibles próximamente.
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