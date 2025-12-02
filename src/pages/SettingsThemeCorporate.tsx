import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

export default function SettingsThemeCorporate() {
  const { organizationTheme, updateOrganizationTheme, resetToOriginalTheme, loading } = useTheme();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [primaryColor, setPrimaryColor] = useState("217 91% 60%");
  const [secondaryColor, setSecondaryColor] = useState("210 40% 98%");
  const [accentColor, setAccentColor] = useState("217 91% 60%");
  const [themeName, setThemeName] = useState("Tema corporativo");

  useEffect(() => {
    document.title = "Tema Corporativo - EasyQuote";
  }, []);

  useEffect(() => {
    if (organizationTheme) {
      setPrimaryColor(organizationTheme.primary_color);
      setSecondaryColor(organizationTheme.secondary_color);
      setAccentColor(organizationTheme.accent_color);
      setThemeName(organizationTheme.name);
    }
  }, [organizationTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrganizationTheme({
        name: themeName,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor
      });
      toast.success("Tema corporativo guardado correctamente");
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error("Error al guardar el tema corporativo");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetToOriginalTheme();
      setPrimaryColor("217 91% 60%");
      setSecondaryColor("210 40% 98%");
      setAccentColor("217 91% 60%");
      setThemeName("Tema corporativo");
      toast.success("Tema restaurado al original de EasyQuote");
    } catch (error) {
      console.error('Error resetting theme:', error);
      toast.error("Error al restaurar el tema");
    } finally {
      setResetting(false);
    }
  };

  const hexToHSL = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0 0% 0%";
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
  };

  const hslToHex = (hsl: string): string => {
    const parts = hsl.split(' ');
    const h = parseInt(parts[0]);
    const s = parseInt(parts[1]) / 100;
    const l = parseInt(parts[2]) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tema Corporativo</h1>
        <p className="text-muted-foreground mt-2">
          Personaliza los colores de tu organización. Todos los usuarios verán estos colores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Colores</CardTitle>
          <CardDescription>
            Define los colores principales de tu marca. Los valores se guardan en formato HSL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme-name">Nombre del tema</Label>
              <Input
                id="theme-name"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="Tema corporativo"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Color Primario</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={hslToHex(primaryColor)}
                  onChange={(e) => setPrimaryColor(hexToHSL(e.target.value))}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="217 91% 60%"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Color principal de botones, enlaces y elementos destacados
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color">Color Secundario</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={hslToHex(secondaryColor)}
                  onChange={(e) => setSecondaryColor(hexToHSL(e.target.value))}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="210 40% 98%"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Color de fondos secundarios y elementos sutiles
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Color de Acento</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={hslToHex(accentColor)}
                  onChange={(e) => setAccentColor(hexToHSL(e.target.value))}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="217 91% 60%"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Color para resaltar elementos especiales
              </p>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-initial"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Tema
            </Button>
            
            {organizationTheme && (
              <Button
                onClick={handleReset}
                variant="outline"
                disabled={resetting}
                className="flex-1 sm:flex-initial"
              >
                {resetting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Restaurar Original
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista Previa</CardTitle>
          <CardDescription>
            Así se verán los colores en la interfaz
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button style={{ background: `hsl(${primaryColor})`, color: 'white' }}>
                Botón Primario
              </Button>
              <Button variant="secondary" style={{ background: `hsl(${secondaryColor})` }}>
                Botón Secundario
              </Button>
              <Button variant="outline" style={{ borderColor: `hsl(${accentColor})`, color: `hsl(${accentColor})` }}>
                Botón Acento
              </Button>
            </div>
            
            <div className="p-4 rounded-lg border" style={{ background: `hsl(${secondaryColor})` }}>
              <p className="text-sm" style={{ color: `hsl(${primaryColor})` }}>
                Texto con color primario sobre fondo secundario
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
