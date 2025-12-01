import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProductionBoardView } from "@/hooks/useProductionBoardView";

export default function ProductionBoardRedirect() {
  const navigate = useNavigate();
  const { view, isLoading } = useProductionBoardView();

  useEffect(() => {
    if (!isLoading) {
      const routes = {
        list: "/panel-produccion-lista",
        compact: "/panel-produccion-compacta",
        kanban: "/panel-produccion-tablero",
      };
      navigate(routes[view], { replace: true });
    }
  }, [view, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-2xl font-semibold text-muted-foreground">Cargando panel de producción...</div>
    </div>
  );
}
