import { Moon, Sun } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Check } from "lucide-react";

interface Props {
  isCollapsed?: boolean;
}

export function ThemeToggle({ isCollapsed }: Props) {
  const { mode, resolvedMode, setMode } = useDarkMode();
  const Icon = resolvedMode === "dark" ? Moon : Sun;
  const label = mode === "dark" ? "Oscuro" : "Claro";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip={`Apariencia: ${label}`} className="h-7 px-2">
          <Icon className="mr-2 h-4 w-4" />
          {!isCollapsed && <span>Apariencia</span>}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-40 bg-popover border shadow-lg z-50">
        <DropdownMenuItem onClick={() => setMode("light")} className="cursor-pointer flex items-center justify-between">
          <span className="flex items-center"><Sun className="mr-2 h-4 w-4" /> Claro</span>
          {mode === "light" && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("dark")} className="cursor-pointer flex items-center justify-between">
          <span className="flex items-center"><Moon className="mr-2 h-4 w-4" /> Oscuro</span>
          {mode === "dark" && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}