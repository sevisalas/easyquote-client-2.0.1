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
  
  const [themeName, setThemeName] = useState("Tema corporativo");
  const [primaryColor, setPrimaryColor] = useState("332 61% 49%");
  const [primaryForeground, setPrimaryForeground] = useState("0 0% 100%");
  const [secondaryColor, setSecondaryColor] = useState("266 93% 17%");
  const [secondaryForeground, setSecondaryForeground] = useState("0 0% 98%");
  const [accentColor, setAccentColor] = useState("210 40% 96%");
  const [accentForeground, setAccentForeground] = useState("222 47% 11%");
  const [mutedColor, setMutedColor] = useState("210 40% 96%");
  const [mutedForeground, setMutedForeground] = useState("215 16% 47%");

  useEffect(() => {
    document.title = "Tema Corporativo - EasyQuote";
  }, []);

  useEffect(() => {
    if (organizationTheme) {
      setThemeName(organizationTheme.name);
      setPrimaryColor(organizationTheme.primary_color);
      setPrimaryForeground(organizationTheme.primary_foreground || "0 0% 100%");
      setSecondaryColor(organizationTheme.secondary_color);
      setSecondaryForeground(organizationTheme.secondary_foreground || "0 0% 98%");
      setAccentColor(organizationTheme.accent_color);
      setAccentForeground(organizationTheme.accent_foreground || "222 47% 11%");
      if (organizationTheme.muted_color) setMutedColor(organizationTheme.muted_color);
      if (organizationTheme.muted_foreground) setMutedForeground(organizationTheme.muted_foreground);
    }
  }, [organizationTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrganizationTheme({
        name: themeName,
        primary_color: primaryColor,
        primary_foreground: primaryForeground,
        secondary_color: secondaryColor,
        secondary_foreground: secondaryForeground,
        accent_color: accentColor,
        accent_foreground: accentForeground,
        muted_color: mutedColor,
        muted_foreground: mutedForeground
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
      setThemeName("Tema corporativo");
      setPrimaryColor("332 61% 49%");
      setPrimaryForeground("0 0% 100%");
      setSecondaryColor("266 93% 17%");
      setSecondaryForeground("0 0% 98%");
      setAccentColor("210 40% 96%");
      setAccentForeground("222 47% 11%");
      setMutedColor("210 40% 96%");
      setMutedForeground("215 16% 47%");
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
    const parts = hsl.replace(/%/g, '').split(' ');
    if (parts.length < 3) return "#000000";
    const h = parseInt(parts[0]) || 0;
    const s = (parseInt(parts[1]) || 0) / 100;
    const l = (parseInt(parts[2]) || 0) / 100;

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

  const ColorInput = ({ 
    label, 
    description, 
    value, 
    onChange 
  }: { 
    label: string; 
    description: string; 
    value: string; 
    onChange: (v: string) => void 
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="color"
        value={hslToHex(value)}
        onChange={(e) => onChange(hexToHSL(e.target.value))}
        className="w-full h-12 cursor-pointer p-1 rounded-md"
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );

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
            Define los colores principales de tu marca. Los valores se guardan en formato HSL (Hue Saturation% Lightness%).
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

          {/* Primary Colors */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Color Primario</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorInput
                label="Fondo Primario"
                description="Botones principales, enlaces destacados"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorInput
                label="Texto sobre Primario"
                description="Color del texto en botones primarios"
                value={primaryForeground}
                onChange={setPrimaryForeground}
              />
            </div>
          </div>

          {/* Secondary Colors */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Color Secundario</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorInput
                label="Fondo Secundario"
                description="Fondos alternativos, badges"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
              <ColorInput
                label="Texto sobre Secundario"
                description="Color del texto sobre fondos secundarios"
                value={secondaryForeground}
                onChange={setSecondaryForeground}
              />
            </div>
          </div>

          {/* Accent Colors */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Color de Acento</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorInput
                label="Fondo de Acento"
                description="Elementos destacados, hovers"
                value={accentColor}
                onChange={setAccentColor}
              />
              <ColorInput
                label="Texto sobre Acento"
                description="Color del texto sobre fondos de acento"
                value={accentForeground}
                onChange={setAccentForeground}
              />
            </div>
          </div>

          {/* Muted Colors */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Colores Atenuados</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorInput
                label="Fondo Atenuado"
                description="Fondos sutiles, inputs deshabilitados"
                value={mutedColor}
                onChange={setMutedColor}
              />
              <ColorInput
                label="Texto Atenuado"
                description="Texto secundario, placeholders"
                value={mutedForeground}
                onChange={setMutedForeground}
              />
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row gap-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Tema
            </Button>
            
            {organizationTheme && (
              <Button onClick={handleReset} variant="outline" disabled={resetting}>
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
              <Button style={{ background: `hsl(${primaryColor})`, color: `hsl(${primaryForeground})` }}>
                Botón Primario
              </Button>
              <Button variant="secondary" style={{ background: `hsl(${secondaryColor})`, color: `hsl(${secondaryForeground})` }}>
                Botón Secundario
              </Button>
              <Button variant="outline" style={{ borderColor: `hsl(${accentColor})`, color: `hsl(${accentColor})` }}>
                Botón Outline
              </Button>
            </div>
            
            <div className="p-4 rounded-lg border" style={{ background: `hsl(${mutedColor})` }}>
              <p className="text-sm" style={{ color: `hsl(${mutedForeground})` }}>
                Texto atenuado sobre fondo atenuado
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: `hsl(${accentColor})` }}>
              <p className="text-sm" style={{ color: `hsl(${accentForeground})` }}>
                Texto sobre fondo de acento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}