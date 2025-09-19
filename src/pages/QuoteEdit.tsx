import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function QuoteEdit() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Editar Presupuesto</span>
            <Button onClick={() => navigate(-1)} size="sm">Volver</Button>
          </CardTitle>
          <CardDescription className="text-sm">
            Página en construcción. La edición de presupuestos estará disponible próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="text-muted-foreground text-sm">
            Esta funcionalidad está siendo desarrollada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}