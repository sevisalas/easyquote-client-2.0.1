import { useVersionCheck } from "@/hooks/useVersionCheck";
import { RefreshCw } from "lucide-react";

export function UpdateBanner() {
  const { updateAvailable, reload } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <button
        onClick={reload}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg hover:opacity-90 transition-opacity text-sm font-medium"
      >
        <RefreshCw className="h-4 w-4" />
        Nueva versión disponible — Pulsa para actualizar
      </button>
    </div>
  );
}
