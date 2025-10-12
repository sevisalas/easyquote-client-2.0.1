import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { fetchAvailableTemplates, TemplateInfo } from "@/utils/templateRegistry";
import QuoteTemplate from "@/components/QuoteTemplate";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "pdf_template_config";

export default function SettingsPdfTemplate() {
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#0ea5e9");
  const [footerText, setFooterText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "Configuración | Plantilla PDF";
    
    // Load templates from database
    const loadTemplates = async () => {
      setIsLoading(true);
      const availableTemplates = await fetchAvailableTemplates();
      setTemplates(availableTemplates);
      setIsLoading(false);
    };
    
    loadTemplates();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const config = JSON.parse(raw);
        setCompanyName(config.companyName || "");
        setLogoUrl(config.logoUrl || "");
        setBrandColor(config.brandColor || "#0ea5e9");
        setFooterText(config.footerText || "");
        setSelectedTemplate(config.selectedTemplate || 1);
      }
    } catch {}
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
        companyName, 
        logoUrl, 
        brandColor, 
        footerText,
        selectedTemplate 
      }));
      toast({ title: "Plantilla guardada", description: "Tus cambios se han guardado en este navegador." });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message || "Inténtalo de nuevo", variant: "destructive" });
    }
  };

  // Datos de ejemplo para el preview
  const previewData = {
    config: {
      companyName: companyName || "Mi Empresa",
      logoUrl: logoUrl,
      brandColor: brandColor,
      footerText: footerText
    },
    quote: {
      quote_number: "01-01-2024-00001",
      created_at: new Date().toISOString(),
      title: "Propuesta Comercial",
      description: "Descripción del presupuesto de ejemplo",
      notes: "Notas y condiciones del presupuesto",
      subtotal: 1000,
      tax_amount: 210,
      discount_amount: 0,
      final_price: 1210
    },
    customer: {
      name: "Cliente Ejemplo S.L.",
      email: "cliente@ejemplo.com",
      phone: "+34 123 456 789",
      address: "Calle Ejemplo 123, Madrid"
    },
    items: [
      {
        name: "Producto 1",
        description: "Descripción del producto 1",
        price: 500
      },
      {
        name: "Producto 2",
        description: "Descripción del producto 2",
        price: 500
      }
    ]
  };

  return (
    <main className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Configuración de plantilla PDF</h1>
        <link rel="canonical" href={`${window.location.origin}/configuracion/plantilla-pdf`} />
        <meta name="description" content="Personaliza el logo, color y pie del PDF de presupuestos." />
      </header>

      {/* Configuración de datos */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de la Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre de empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Mi Empresa S.L." />
          </div>
          <div className="space-y-2">
            <Label>Color de marca</Label>
            <Input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Logo (URL)</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Texto de pie</Label>
            <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Condiciones, contacto, etc." />
          </div>
        </CardContent>
      </Card>

      {/* Selección de plantilla */}
      <Card>
        <CardHeader>
          <CardTitle>Selecciona tu Plantilla</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando plantillas...</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`flex-shrink-0 snap-start transition-all ${
                    selectedTemplate === template.id
                      ? 'ring-4 ring-primary scale-105'
                      : 'ring-2 ring-border hover:ring-primary/50'
                  } rounded-lg overflow-hidden`}
                >
                  <div className="w-48 bg-card">
                    <div className="aspect-[210/297] bg-muted flex items-center justify-center">
                      <img 
                        src={template.thumbnail} 
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{template.name}</p>
                        {template.isCustom && (
                          <Badge variant="secondary" className="text-xs">Personalizada</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                      {template.price && template.price > 0 && (
                        <p className="text-xs font-medium text-primary mb-2">
                          {template.price}€
                        </p>
                      )}
                      <div className="text-xs font-medium text-center py-1 rounded bg-muted">
                        {selectedTemplate === template.id ? '✓ Seleccionada' : 'Seleccionar'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vista previa */}
      <Card>
        <CardHeader>
          <CardTitle>Vista Previa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-8 rounded-lg overflow-auto">
            <div className="mx-auto shadow-2xl max-w-[210mm] scale-75 origin-top">
              <QuoteTemplate 
                data={previewData} 
                templateNumber={selectedTemplate} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">Guardar Configuración</Button>
      </div>
    </main>
  );
}
