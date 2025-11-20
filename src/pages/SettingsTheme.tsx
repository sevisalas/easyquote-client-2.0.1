import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

interface Theme {
  id: string | null;
  name: string;
  description: string;
  preview: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
  };
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
  }
];

export default function SettingsTheme() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Configuración | Tema";
    loadCurrentTheme();
  }, []);

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
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTheme = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ selected_theme: selectedTheme })
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
                onClick={() => setSelectedTheme(theme.id)}
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