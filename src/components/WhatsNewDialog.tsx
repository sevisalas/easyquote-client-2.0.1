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
import { Sparkles, LayoutGrid, Factory, ListChecks } from "lucide-react";

  const CURRENT_VERSION = "2.8.10";
const SILENT_UPDATE = true;
const LS_KEY = "whats_new_seen_version_v3";

interface ReleaseNote {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    icon: <LayoutGrid className="h-5 w-5 text-primary" />,
    title: "Nuevo panel de producción",
    description:
      "Vista renovada del panel de producción con cambio entre lista, compacta y kanban, y preferencia guardada por usuario.",
    badge: "Nuevo",
  },
  {
    icon: <Factory className="h-5 w-5 text-primary" />,
    title: "Recursos de producción",
    description:
      "Añade y gestiona recursos (máquinas, puestos) y asígnalos a las tareas de cada artículo.",
    badge: "Nuevo",
  },
  {
    icon: <ListChecks className="h-5 w-5 text-primary" />,
    title: "Visualización de tareas y estados",
    description:
      "Consulta el estado de cada tarea (pendiente, en curso, pausada, terminada) con tiempos totales por artículo.",
    badge: "Mejora",
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
