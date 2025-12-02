import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchAvailableTemplates, TemplateInfo } from "@/utils/templateRegistry";
import QuoteTemplate from "@/components/QuoteTemplate";
import { Badge } from "@/components/ui/badge";
import { usePdfAccess } from "@/hooks/usePdfAccess";
import { usePdfConfiguration } from "@/hooks/usePdfConfiguration";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SettingsPdfTemplate() {
  const { hasPdfAccess, loading: pdfAccessLoading } = usePdfAccess();
  const { configuration, isLoading: configLoading, saveConfiguration, isSaving } = usePdfConfiguration();
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
    // Load configuration from Supabase
    if (configuration) {
      setCompanyName(configuration.company_name || "");
      setLogoUrl(configuration.logo_url || "");
      setBrandColor(configuration.brand_color || "#0ea5e9");
      setFooterText(configuration.footer_text || "");
      setSelectedTemplate(configuration.selected_template || 1);
    }
  }, [configuration]);

  const handleSave = () => {
    saveConfiguration({
      company_name: companyName,
      logo_url: logoUrl,
      brand_color: brandColor,
      footer_text: footerText,
      selected_template: selectedTemplate,
    });
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

  if (pdfAccessLoading || configLoading) {
    return (
      <div className="w-full">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!hasPdfAccess) {
    return (
      <div className="space-y-4 md:space-y-6 w-full">
        <header className="sr-only">
          <h1>Configuración de plantilla PDF</h1>
          <link rel="canonical" href={`${window.location.origin}/configuracion/plantilla-pdf`} />
          <meta name="description" content="Personaliza el logo, color y pie del PDF de presupuestos." />
        </header>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso Restringido</AlertTitle>
          <AlertDescription>
            Tu organización no tiene habilitada la generación de PDFs. 
            Esta funcionalidad está configurada para usar el CRM/ERP integrado en su lugar.
            Contacta con tu administrador si necesitas acceso a esta función.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full">
      <header className="sr-only">
        <h1>Configuración de plantilla PDF</h1>
        <link rel="canonical" href={`${window.location.origin}/configuracion/plantilla-pdf`} />
        <meta name="description" content="Personaliza el logo, color y pie del PDF de presupuestos." />
      </header>

      {/* Configuración de datos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos de la Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nombre de empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Mi Empresa S.L." className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Color de marca</Label>
            <Input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-8 mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Logo (URL)</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png" className="h-8 text-sm mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Texto de pie</Label>
            <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Condiciones, contacto, etc." className="h-8 text-sm mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Selección de plantilla y Vista previa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Selección de plantilla - 1/2 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selecciona tu Plantilla</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Cargando plantillas...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`transition-all ${
                      selectedTemplate === template.id
                        ? 'ring-4 ring-primary scale-105'
                        : 'ring-2 ring-border hover:ring-primary/50'
                    } rounded-lg overflow-hidden`}
                  >
                    <div className="bg-card">
                      <div className="aspect-[210/297] bg-muted flex items-center justify-center">
                        <img 
                          src={template.thumbnail} 
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <p className="font-semibold text-xs truncate">{template.name}</p>
                          {template.isCustom && (
                            <Badge variant="secondary" className="text-xs">Custom</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{template.description}</p>
                        {template.price !== undefined && template.price > 0 && (
                          <p className="text-xs font-medium text-primary mb-1">
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

        {/* Vista previa - 1/3 */}
        <Card className="overflow-hidden h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vista Previa</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-muted/30 p-3 overflow-x-auto">
              <div className="flex justify-center">
                <div 
                  className="shadow-2xl bg-white origin-top"
                  style={{
                    width: '210mm',
                    transform: 'scale(0.5)',
                    marginBottom: 'calc(-50% + 1rem)'
                  }}
                >
                  <QuoteTemplate 
                    data={previewData} 
                    templateNumber={selectedTemplate} 
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="sm" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}
