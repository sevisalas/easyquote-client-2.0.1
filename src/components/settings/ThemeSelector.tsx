import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Theme, useTheme } from "@/hooks/useTheme";

const themes: { name: Theme; label: string; description: string; colors: string[] }[] = [
  {
    name: null,
    label: "Original",
    description: "Diseño predeterminado",
    colors: ["hsl(221.2, 83.2%, 53.3%)", "hsl(210, 40%, 96.1%)", "hsl(222.2, 84%, 4.9%)"],
  },
  {
    name: "ocean",
    label: "Océano",
    description: "Tonos azules y turquesa",
    colors: ["hsl(199, 89%, 48%)", "hsl(172, 66%, 50%)", "hsl(199, 20%, 90%)"],
  },
  {
    name: "forest",
    label: "Bosque",
    description: "Tonos verdes naturales",
    colors: ["hsl(142, 71%, 45%)", "hsl(158, 58%, 50%)", "hsl(142, 20%, 88%)"],
  },
  {
    name: "sunset",
    label: "Atardecer",
    description: "Tonos naranjas y rosados",
    colors: ["hsl(24, 95%, 53%)", "hsl(340, 82%, 52%)", "hsl(24, 25%, 88%)"],
  },
  {
    name: "midnight",
    label: "Medianoche",
    description: "Oscuro con púrpura",
    colors: ["hsl(263, 70%, 50%)", "hsl(280, 70%, 55%)", "hsl(240, 10%, 7%)"],
  },
];

export function ThemeSelector() {
  const { theme, updateTheme, isLoading } = useTheme();

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Cargando temas...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Selecciona un tema</h3>
        <p className="text-sm text-muted-foreground">
          Personaliza la apariencia de la aplicación
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((themeOption) => (
          <Card
            key={themeOption.name}
            className={`cursor-pointer transition-all hover:border-primary ${
              theme === themeOption.name ? "border-primary ring-2 ring-primary ring-offset-2" : ""
            }`}
            onClick={() => updateTheme(themeOption.name)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{themeOption.label}</h4>
                  {theme === themeOption.name && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">{themeOption.description}</p>
                
                <div className="flex gap-2">
                  {themeOption.colors.map((color, index) => (
                    <div
                      key={index}
                      className="h-8 w-8 rounded-md border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
