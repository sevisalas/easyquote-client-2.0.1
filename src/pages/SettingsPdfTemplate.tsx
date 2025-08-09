import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "pdf_template_config";

export default function SettingsPdfTemplate() {
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#0ea5e9");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    document.title = "Configuración | Plantilla PDF";
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { companyName, logoUrl, brandColor, footerText } = JSON.parse(raw);
        setCompanyName(companyName || "");
        setLogoUrl(logoUrl || "");
        setBrandColor(brandColor || "#0ea5e9");
        setFooterText(footerText || "");
      }
    } catch {}
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ companyName, logoUrl, brandColor, footerText }));
      toast({ title: "Plantilla guardada", description: "Tus cambios se han guardado en este navegador." });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message || "Inténtalo de nuevo", variant: "destructive" });
    }
  };

  return (
    <main className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Configuración de plantilla PDF</h1>
        <link rel="canonical" href={`${window.location.origin}/configuracion/plantilla-pdf`} />
        <meta name="description" content="Personaliza el logo, color y pie del PDF de presupuestos." />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Plantilla de PDF</CardTitle>
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
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
