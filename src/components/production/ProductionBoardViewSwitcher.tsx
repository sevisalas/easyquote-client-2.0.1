import { Button } from "@/components/ui/button";
import { Check, LayoutGrid, List } from "lucide-react";
import { useNavigate } from "react-router-dom";

type ProductionBoardView = "list" | "compact" | "kanban";

interface ProductionBoardViewSwitcherProps {
  view: ProductionBoardView;
  onViewChange: (view: ProductionBoardView) => void;
}

const views: Array<{
  icon: typeof List;
  label: string;
  mobileLabel: string;
  route: string;
  value: ProductionBoardView;
}> = [
  {
    value: "list",
    label: "Vista listado",
    mobileLabel: "Lista",
    route: "/panel-produccion-lista",
    icon: List,
  },
  {
    value: "compact",
    label: "Vista compacta",
    mobileLabel: "Compacta",
    route: "/panel-produccion-compacta",
    icon: LayoutGrid,
  },
  {
    value: "kanban",
    label: "Vista tablero",
    mobileLabel: "Tablero",
    route: "/panel-produccion-tablero",
    icon: LayoutGrid,
  },
];

export const ProductionBoardViewSwitcher = (_props: ProductionBoardViewSwitcherProps) => {
  // Vistas alternativas (tablero/compacta) deshabilitadas. Solo se muestra el panel de pedidos.
  return null;
};