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
    label: "Vista Lista",
    mobileLabel: "Lista",
    route: "/panel-produccion-lista",
    icon: List,
  },
  {
    value: "compact",
    label: "Vista Compacta",
    mobileLabel: "Compacta",
    route: "/panel-produccion-compacta",
    icon: LayoutGrid,
  },
  {
    value: "kanban",
    label: "Vista Tablero",
    mobileLabel: "Tablero",
    route: "/panel-produccion-tablero",
    icon: LayoutGrid,
  },
];

export const ProductionBoardViewSwitcher = ({
  view,
  onViewChange,
}: ProductionBoardViewSwitcherProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {views.map(({ value, label, mobileLabel, route, icon: Icon }) => (
        <Button
          key={value}
          variant={view === value ? "default" : "outline"}
          onClick={() => {
            onViewChange(value);
            navigate(route);
          }}
          size="sm"
          className="w-[168px] shrink-0 justify-center gap-2"
        >
          {view === value && <Check className="h-4 w-4" />}
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{mobileLabel}</span>
        </Button>
      ))}
    </div>
  );
};