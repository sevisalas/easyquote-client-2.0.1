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
import { Sparkles, Ban, UserCheck } from "lucide-react";

const CURRENT_VERSION = "2.6.9";
const LS_KEY = "whats_new_seen_version";

interface ReleaseNote {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    icon: <Ban className="h-5 w-5 text-primary" />,
    title: "Estado 'Anulado' en pedidos",
    description:
      "Nuevo estado para marcar pedidos como anulados o cancelados, visible en listados, detalle y tableros de producción.",
    badge: "Admin",
  },
  {
    icon: <UserCheck className="h-5 w-5 text-primary" />,
    title: "Gestores pueden cambiar estado de pedidos",
    description:
      "Los usuarios con rol gestor ahora pueden modificar el estado de pedidos aprobados y editarlos con auditoría.",
    badge: "Admin",
  },
  {
    icon: <Target className="h-5 w-5 text-primary" />,
    title: "Roadmap: Objetivos y Sprints en Kanban",
    description:
      "Nueva vista Kanban para objetivos y sprints, con búsqueda de sprints y diálogo de objetivos optimizado.",
    badge: "SuperAdmin",
  },
];

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(LS_KEY);
    if (seen !== CURRENT_VERSION) {
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
