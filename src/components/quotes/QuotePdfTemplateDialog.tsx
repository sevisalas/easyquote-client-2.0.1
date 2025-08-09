import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PDFDownloadLink } from "@react-pdf/renderer";
import QuotePDF from "@/components/quotes/QuotePDF";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  main: any;
  items: any[];
}

const STORAGE_KEY = "pdf_template_config";

export default function QuotePdfTemplateDialog({ open, onOpenChange, customer, main, items }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#0ea5e9");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    try {
      const data = { companyName, logoUrl, brandColor, footerText };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [companyName, logoUrl, brandColor, footerText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar plantilla de PDF</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <PDFDownloadLink
            document={<QuotePDF customer={customer} main={main} items={items} template={{ companyName, logoUrl, brandColor, footerText }} />}
            fileName={`Presupuesto_${new Date().toISOString().slice(0,10)}.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading}>{loading ? "Generando PDF..." : "Descargar PDF"}</Button>
            )}
          </PDFDownloadLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
