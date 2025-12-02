import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

// Utility functions outside component to prevent recreation
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

// ColorColumn component outside main component
interface ColorColumnProps {
  title: string;
  bgValue: string;
  bgOnChange: (v: string) => void;
  fgValue: string;
  fgOnChange: (v: string) => void;
}

const ColorColumn = ({ title, bgValue, bgOnChange, fgValue, fgOnChange }: ColorColumnProps) => (
  <div className="space-y-3 text-center">
    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
    <div className="space-y-1">
      <Label className="text-xs">Fondo</Label>
      <input
        type="color"
        value={hslToHex(bgValue)}
        onChange={(e) => bgOnChange(hexToHSL(e.target.value))}
        className="w-28 h-28 cursor-pointer p-1 rounded-md mx-auto block border"
      />
    </div>
    <div className="space-y-1">
      <Label className="text-xs">Texto</Label>
      <input
        type="color"
        value={hslToHex(fgValue)}
        onChange={(e) => fgOnChange(hexToHSL(e.target.value))}
        className="w-28 h-10 cursor-pointer p-1 rounded-md mx-auto block border"
      />
    </div>
    {/* Preview */}
    <div 
      className="w-28 mx-auto p-3 rounded-md"
      style={{ background: `hsl(${bgValue})` }}
    >
      <span className="text-sm font-medium" style={{ color: `hsl(${fgValue})` }}>
        Muestra
      </span>
    </div>
  </div>
);

export default function SettingsThemeCorporate() {
  const { organizationTheme, updateOrganizationTheme, resetToOriginalTheme, loading } = useTheme();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [primaryColor, setPrimaryColor] = useState("332 61% 49%");
  const [primaryForeground, setPrimaryForeground] = useState("0 0% 100%");
  const [secondaryColor, setSecondaryColor] = useState("266 93% 17%");
  const [secondaryForeground, setSecondaryForeground] = useState("0 0% 98%");
  const [accentColor, setAccentColor] = useState("210 40% 96%");
  const [accentForeground, setAccentForeground] = useState("222 47% 11%");
  const [mutedColor, setMutedColor] = useState("210 40% 96%");
  const [mutedForeground, setMutedForeground] = useState("215 16% 47%");
  const [sidebarBackground, setSidebarBackground] = useState("0 0% 98%");
  const [sidebarForeground, setSidebarForeground] = useState("240 5% 26%");
  const [sidebarAccent, setSidebarAccent] = useState("240 5% 96%");
  const [sidebarAccentForeground, setSidebarAccentForeground] = useState("240 6% 10%");

  useEffect(() => {
    document.title = "Tema Corporativo - EasyQuote";
  }, []);

  useEffect(() => {
    if (organizationTheme) {
      setPrimaryColor(organizationTheme.primary_color);
      setPrimaryForeground(organizationTheme.primary_foreground || "0 0% 100%");
      setSecondaryColor(organizationTheme.secondary_color);
      setSecondaryForeground(organizationTheme.secondary_foreground || "0 0% 98%");
      setAccentColor(organizationTheme.accent_color);
      setAccentForeground(organizationTheme.accent_foreground || "222 47% 11%");
      if (organizationTheme.muted_color) setMutedColor(organizationTheme.muted_color);
      if (organizationTheme.muted_foreground) setMutedForeground(organizationTheme.muted_foreground);
      if (organizationTheme.sidebar_background) setSidebarBackground(organizationTheme.sidebar_background);
      if (organizationTheme.sidebar_foreground) setSidebarForeground(organizationTheme.sidebar_foreground);
      if (organizationTheme.sidebar_accent) setSidebarAccent(organizationTheme.sidebar_accent);
      if (organizationTheme.sidebar_accent_foreground) setSidebarAccentForeground(organizationTheme.sidebar_accent_foreground);
    }
  }, [organizationTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrganizationTheme({
        name: "Tema corporativo",
        primary_color: primaryColor,
        primary_foreground: primaryForeground,
        secondary_color: secondaryColor,
        secondary_foreground: secondaryForeground,
        accent_color: accentColor,
        accent_foreground: accentForeground,
        muted_color: mutedColor,
        muted_foreground: mutedForeground,
        sidebar_background: sidebarBackground,
        sidebar_foreground: sidebarForeground,
        sidebar_accent: sidebarAccent,
        sidebar_accent_foreground: sidebarAccentForeground
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
      setPrimaryColor("332 61% 49%");
      setPrimaryForeground("0 0% 100%");
      setSecondaryColor("266 93% 17%");
      setSecondaryForeground("0 0% 98%");
      setAccentColor("210 40% 96%");
      setAccentForeground("222 47% 11%");
      setMutedColor("210 40% 96%");
      setMutedForeground("215 16% 47%");
      setSidebarBackground("0 0% 98%");
      setSidebarForeground("240 5% 26%");
      setSidebarAccent("240 5% 96%");
      setSidebarAccentForeground("240 6% 10%");
      toast.success("Tema restaurado al original de EasyQuote");
    } catch (error) {
      console.error('Error resetting theme:', error);
      toast.error("Error al restaurar el tema");
    } finally {
      setResetting(false);
    }
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
          Personaliza los colores de tu organización.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Main colors: Primary, Secondary, Accent, Muted */}
          <div className="grid gap-8 grid-cols-2 md:grid-cols-4 mb-8">
            <ColorColumn
              title="Primario"
              bgValue={primaryColor}
              bgOnChange={setPrimaryColor}
              fgValue={primaryForeground}
              fgOnChange={setPrimaryForeground}
            />
            <ColorColumn
              title="Secundario"
              bgValue={secondaryColor}
              bgOnChange={setSecondaryColor}
              fgValue={secondaryForeground}
              fgOnChange={setSecondaryForeground}
            />
            <ColorColumn
              title="Acento"
              bgValue={accentColor}
              bgOnChange={setAccentColor}
              fgValue={accentForeground}
              fgOnChange={setAccentForeground}
            />
            <ColorColumn
              title="Atenuado"
              bgValue={mutedColor}
              bgOnChange={setMutedColor}
              fgValue={mutedForeground}
              fgOnChange={setMutedForeground}
            />
          </div>
          
          {/* Sidebar colors */}
          <div className="border-t pt-6 mb-6">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Sidebar</h3>
            <div className="grid gap-8 grid-cols-2 md:grid-cols-4">
              <div className="space-y-3 text-center">
                <h4 className="font-medium text-sm">Fondo</h4>
                <input
                  type="color"
                  value={hslToHex(sidebarBackground)}
                  onChange={(e) => setSidebarBackground(hexToHSL(e.target.value))}
                  className="w-28 h-20 cursor-pointer p-1 rounded-md mx-auto block border"
                />
              </div>
              <div className="space-y-3 text-center">
                <h4 className="font-medium text-sm">Texto</h4>
                <input
                  type="color"
                  value={hslToHex(sidebarForeground)}
                  onChange={(e) => setSidebarForeground(hexToHSL(e.target.value))}
                  className="w-28 h-20 cursor-pointer p-1 rounded-md mx-auto block border"
                />
              </div>
              <div className="space-y-3 text-center">
                <h4 className="font-medium text-sm">Fondo Destacado</h4>
                <input
                  type="color"
                  value={hslToHex(sidebarAccent)}
                  onChange={(e) => setSidebarAccent(hexToHSL(e.target.value))}
                  className="w-28 h-20 cursor-pointer p-1 rounded-md mx-auto block border"
                />
              </div>
              <div className="space-y-3 text-center">
                <h4 className="font-medium text-sm">Texto Destacado</h4>
                <input
                  type="color"
                  value={hslToHex(sidebarAccentForeground)}
                  onChange={(e) => setSidebarAccentForeground(hexToHSL(e.target.value))}
                  className="w-28 h-20 cursor-pointer p-1 rounded-md mx-auto block border"
                />
              </div>
            </div>
            {/* Sidebar preview */}
            <div 
              className="w-full max-w-xs mx-auto mt-4 p-4 rounded-md"
              style={{ background: `hsl(${sidebarBackground})` }}
            >
              <span className="text-sm" style={{ color: `hsl(${sidebarForeground})` }}>
                Elemento normal
              </span>
              <div 
                className="mt-2 p-2 rounded"
                style={{ background: `hsl(${sidebarAccent})` }}
              >
                <span className="text-sm font-medium" style={{ color: `hsl(${sidebarAccentForeground})` }}>
                  Elemento destacado
                </span>
              </div>
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
    </div>
  );
}
