import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProductionBoardView } from "@/hooks/useProductionBoardView";

export default function ProductionBoardRedirect() {
  const navigate = useNavigate();
  const { view, isLoading } = useProductionBoardView();

  useEffect(() => {
    // Otras vistas deshabilitadas: siempre redirigir al panel de pedidos (lista)
    navigate("/panel-produccion-lista", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-2xl font-semibold text-muted-foreground">Cargando panel de producción...</div>
    </div>
  );
}
