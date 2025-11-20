import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsTheme() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tema</h1>
        <p className="text-muted-foreground">
          Personaliza la apariencia visual de la aplicación
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selección de Tema</CardTitle>
          <CardDescription>
            Elige entre diferentes paletas de colores para personalizar tu experiencia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </div>
  );
}
