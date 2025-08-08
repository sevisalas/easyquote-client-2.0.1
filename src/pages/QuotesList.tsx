import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QuotesList = () => {
  useEffect(() => {
    document.title = "Presupuestos | Listado";
  }, []);

  return (
    <main className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Listado de presupuestos</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos`} />
        <meta name="description" content="Listado de presupuestos en la aplicación." />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Listado de presupuestos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">En construcción. Aquí verás tus presupuestos.</p>
        </CardContent>
      </Card>
    </main>
  );
};

export default QuotesList;
