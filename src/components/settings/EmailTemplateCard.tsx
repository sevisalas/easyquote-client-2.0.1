import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useEmailTemplates, EMAIL_TEMPLATE_VARIABLES } from "@/hooks/useEmailTemplates";
import { Save, Eye, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EmailTemplateCard() {
  const { template, isLoading, saveMutation, defaultSubject, defaultBody } = useEmailTemplates();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (template) {
      setSubject(template.subject || defaultSubject);
      setBody(template.body || defaultBody);
    } else if (!isLoading) {
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [template, isLoading, defaultSubject, defaultBody]);

  const handleSave = () => {
    saveMutation.mutate({ subject, body });
  };

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success(`Variable ${variable} copiada`);
  };

  const handleResetToDefault = () => {
    setSubject(defaultSubject);
    setBody(defaultBody);
    toast.info("Plantilla restaurada a los valores por defecto (guarda para confirmar)");
  };

  const renderPreview = () => {
    return body
      .replace(/\{\{numero\}\}/g, "P-2025-0042")
      .replace(/\{\{cliente\}\}/g, "Juan Pérez")
      .replace(/\{\{precio\}\}/g, ' por un importe de <strong>1.250,00 €</strong>')
      .replace(/\{\{boton_pdf\}\}/g, '<p><a href="#" style="display: inline-block; background-color: #c83077; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Descargar presupuesto PDF</a></p>')
      .replace(/\{\{empresa\}\}/g, "Mi Empresa S.L.");
  };

  if (isLoading) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Plantilla de email</CardTitle>
              <CardDescription>
                Personaliza el email que se envía con los presupuestos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Variables disponibles</Label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="secondary"
                  className="cursor-pointer hover:bg-accent gap-1"
                  onClick={() => handleCopyVariable(v.key)}
                >
                  <Copy className="h-3 w-3" />
                  {v.key} — {v.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Asunto del email</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Presupuesto {{numero}}"
            />
          </div>

          <div className="space-y-2">
            <Label>Cuerpo del email (HTML)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder="Escribe el HTML del email..."
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1">
                <Eye className="h-4 w-4" />
                Vista previa
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetToDefault}>
                Restaurar por defecto
              </Button>
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Guardando..." : "Guardar plantilla"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa del email</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <div className="mb-3 pb-3 border-b">
              <p className="text-sm text-muted-foreground">
                <strong>Asunto:</strong>{" "}
                {subject
                  .replace(/\{\{numero\}\}/g, "P-2025-0042")
                  .replace(/\{\{cliente\}\}/g, "Juan Pérez")
                  .replace(/\{\{empresa\}\}/g, "Mi Empresa S.L.")}
              </p>
            </div>
            <div dangerouslySetInnerHTML={{ __html: renderPreview() }} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
