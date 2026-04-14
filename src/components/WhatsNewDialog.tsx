import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, Mail, Globe } from "lucide-react";

const CURRENT_VERSION = "2.7.13";
const SILENT_UPDATE = true;
const LS_KEY = "whats_new_seen_version";

interface ReleaseNote {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    icon: <Users className="h-5 w-5 text-primary" />,
    title: "Información ampliada de clientes en ERP",
    description:
      "Se amplía la información sincronizada de los clientes con la integración ERP, incluyendo más datos de contacto y comerciales.",
  },
  {
    icon: <Mail className="h-5 w-5 text-primary" />,
    title: "Envío de presupuestos por email",
    description:
      "Nueva opción para enviar presupuestos directamente por correo electrónico desde la aplicación, con configuración SMTP personalizable y plantillas editables por organización.",
  },
  {
    icon: <Globe className="h-5 w-5 text-primary" />,
    title: "Primera fase del portal de cliente",
    description:
      "Sentamos las bases para el futuro portal de cliente: el enlace al PDF en el email es el primer paso hacia la aprobación online de presupuestos.",
    badge: "Próximamente",
  },
];

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(LS_KEY);
    if (seen !== CURRENT_VERSION) {
      if (SILENT_UPDATE) {
        localStorage.setItem(LS_KEY, CURRENT_VERSION);
        return;
      }
      setOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(LS_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Novedades v{CURRENT_VERSION}
          </DialogTitle>
          <DialogDescription>
            Mejoras recientes que ya están disponibles en tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {RELEASE_NOTES.map((note, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="mt-0.5 shrink-0">{note.icon}</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{note.title}</span>
                  {note.badge && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {note.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {note.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
