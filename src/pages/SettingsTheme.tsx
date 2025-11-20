import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Palette } from "lucide-react";

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  foreground: string;
}

interface Theme {
  id: string | null;
  name: string;
  description: string;
  preview: ThemeColors;
}

const themes: Theme[] = [
  {
    id: null,
    name: "Original",
    description: "Tema predeterminado de la aplicación",
    preview: {
      primary: "#c83077",
      secondary: "#250353",
      background: "#ffffff",
      foreground: "#09090b"
    }
  },
  {
    id: "dark-pro",
    name: "Oscuro Profesional",
    description: "Tema oscuro con contraste profesional",
    preview: {
      primary: "#7c3aed",
      secondary: "#1e293b",
      background: "#0f172a",
      foreground: "#f8fafc"
    }
  },
  {
    id: "light-minimal",
    name: "Claro Minimalista",
    description: "Tema claro con diseño minimalista",
    preview: {
      primary: "#3b82f6",
      secondary: "#e2e8f0",
      background: "#ffffff",
      foreground: "#1e293b"
    }
  },
  {
    id: "blue-corporate",
    name: "Azul Corporativo",
    description: "Tema corporativo con tonos azules",
    preview: {
      primary: "#0ea5e9",
      secondary: "#1e40af",
      background: "#f8fafc",
      foreground: "#0f172a"
    }
  },
  {
    id: "green-nature",
    name: "Verde Natural",
    description: "Tema con tonos verdes naturales",
    preview: {
      primary: "#10b981",
      secondary: "#065f46",
      background: "#f0fdf4",
      foreground: "#064e3b"
    }
  },
  {
    id: "custom",
    name: "Personalizado",
    description: "Crea tu propio tema con colores personalizados",
    preview: {
      primary: "#c83077",
      secondary: "#250353",
      background: "#ffffff",
      foreground: "#09090b"
    }
  }
];

export default function SettingsTheme() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [customColors, setCustomColors] = useState<ThemeColors>({
    primary: "#c83077",
    secondary: "#250353",
    background: "#ffffff",
    foreground: "#09090b"
  });
  const [previewColors, setPreviewColors] = useState<ThemeColors | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Configuración | Tema";
    loadCurrentTheme();
  }, []);

  // Convertir HEX a HSL
  const hexToHSL = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    
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

  // Vista previa en tiempo real
  useEffect(() => {
    if (previewColors) {
      document.documentElement.style.setProperty('--primary', hexToHSL(previewColors.primary));
      document.documentElement.style.setProperty('--secondary', hexToHSL(previewColors.secondary));
      document.documentElement.style.setProperty('--background', hexToHSL(previewColors.background));
      document.documentElement.style.setProperty('--foreground', hexToHSL(previewColors.foreground));
    }
  }, [previewColors]);

  const loadCurrentTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('selected_theme')
        .eq('user_id', user.id)
        .single();

      const theme = profile?.selected_theme || null;
      setSelectedTheme(theme);
      setCurrentTheme(theme);
      
      // Si es tema custom, cargar los colores guardados
      if (theme === 'custom' && profile) {
        const customColorsData = (profile as any).custom_colors;
        if (customColorsData) {
          setCustomColors(customColorsData as ThemeColors);
        }
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeSelect = (themeId: string | null) => {
    setSelectedTheme(themeId);
    
    // Aplicar vista previa inmediata
    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      const colors = themeId === 'custom' ? customColors : theme.preview;
      setPreviewColors(colors);
    }
  };

  const handleCustomColorChange = (key: keyof ThemeColors, value: string) => {
    const newColors = { ...customColors, [key]: value };
    setCustomColors(newColors);
    if (selectedTheme === 'custom') {
      setPreviewColors(newColors);
    }
  };

  const handleSaveTheme = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData: any = { selected_theme: selectedTheme };
      
      // Si es tema custom, guardar también los colores
      if (selectedTheme === 'custom') {
        updateData.custom_colors = customColors;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      setCurrentTheme(selectedTheme);
      toast({
        title: "Tema guardado",
        description: "El tema se ha actualizado correctamente. Recarga la página para ver los cambios.",
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el tema",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <p className="text-muted-foreground text-center">Cargando...</p>
      </div>
    );
  }

  const hasChanges = selectedTheme !== currentTheme;

  return (
    <div className="container mx-auto py-10">
      <header className="sr-only">
        <h1>Configuración de tema</h1>
        <link rel="canonical" href={`${window.location.origin}/configuracion/tema`} />
        <meta name="description" content="Personaliza el tema visual de la aplicación." />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Selecciona tu Tema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id || 'original'}
                onClick={() => handleThemeSelect(theme.id)}
                className={`relative transition-all rounded-lg border-2 overflow-hidden ${
                  selectedTheme === theme.id
                    ? 'ring-4 ring-primary scale-105 border-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {selectedTheme === theme.id && (
                  <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                
                <div className="p-4 space-y-3">
                  <div className="flex gap-2 h-16">
                    <div 
                      className="flex-1 rounded" 
                      style={{ backgroundColor: theme.preview.primary }}
                    />
                    <div 
                      className="flex-1 rounded" 
                      style={{ backgroundColor: theme.preview.secondary }}
                    />
                  </div>
                  
                  <div className="flex gap-2 h-8">
                    <div 
                      className="flex-1 rounded border" 
                      style={{ 
                        backgroundColor: theme.preview.background,
                        borderColor: theme.preview.foreground + '20'
                      }}
                    />
                    <div 
                      className="flex-1 rounded" 
                      style={{ backgroundColor: theme.preview.foreground }}
                    />
                  </div>
                  
                  <div className="text-left pt-2">
                    <h3 className="font-semibold text-sm">{theme.name}</h3>
                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Editor de colores personalizados */}
          {selectedTheme === 'custom' && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Personaliza tus colores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primary">Color Primario</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="primary"
                        type="color"
                        value={customColors.primary}
                        onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={customColors.primary}
                        onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="secondary">Color Secundario</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="secondary"
                        type="color"
                        value={customColors.secondary}
                        onChange={(e) => handleCustomColorChange('secondary', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={customColors.secondary}
                        onChange={(e) => handleCustomColorChange('secondary', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="background">Color de Fondo</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="background"
                        type="color"
                        value={customColors.background}
                        onChange={(e) => handleCustomColorChange('background', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={customColors.background}
                        onChange={(e) => handleCustomColorChange('background', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="foreground">Color de Texto</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="foreground"
                        type="color"
                        value={customColors.foreground}
                        onChange={(e) => handleCustomColorChange('foreground', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={customColors.foreground}
                        onChange={(e) => handleCustomColorChange('foreground', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {hasChanges && (
            <div className="flex justify-end mt-6">
              <Button 
                onClick={handleSaveTheme} 
                disabled={saving}
                size="lg"
              >
                {saving ? 'Guardando...' : 'Guardar Tema'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}