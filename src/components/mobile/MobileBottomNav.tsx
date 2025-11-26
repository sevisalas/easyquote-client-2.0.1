import { Link, useLocation } from "react-router-dom";
import { Home, FileText, Users, Package, ClipboardList, User, Sparkles } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const location = useLocation();
  const { membership, isSuperAdmin } = useSubscription();
  
  const userRole = isSuperAdmin ? 'superadmin' : (membership?.role || 'admin');
  const isActive = (path: string) => location.pathname === path;
  
  // Navegación según rol
  const navItems = {
    superadmin: [
      { icon: Home, label: "Inicio", path: "/" },
      { icon: Sparkles, label: "Novedades", path: "/novedades" },
      { icon: Users, label: "Usuarios", path: "/superadmin/users" },
      { icon: ClipboardList, label: "Suscriptores", path: "/superadmin/subscribers" },
    ],
    admin: [
      { icon: Home, label: "Inicio", path: "/" },
      { icon: FileText, label: "Presupuestos", path: "/presupuestos" },
      { icon: Package, label: "Pedidos", path: "/pedidos" },
      { icon: Users, label: "Clientes", path: "/clientes" },
    ],
    gestor: [
      { icon: Home, label: "Inicio", path: "/" },
      { icon: FileText, label: "Presupuestos", path: "/presupuestos" },
      { icon: Package, label: "Pedidos", path: "/pedidos" },
      { icon: Users, label: "Clientes", path: "/clientes" },
    ],
    comercial: [
      { icon: Home, label: "Inicio", path: "/" },
      { icon: FileText, label: "Presupuestos", path: "/presupuestos" },
      { icon: Users, label: "Clientes", path: "/clientes" },
    ],
    operador: [
      { icon: Home, label: "Inicio", path: "/" },
      { icon: Package, label: "Pedidos", path: "/pedidos" },
      { icon: User, label: "Perfil", path: "/settings/theme" },
    ],
  };

  const items = navItems[userRole as keyof typeof navItems] || navItems.admin;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border h-16 md:hidden">
      <div className="flex items-center justify-around h-full px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-[60px]",
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon size={24} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
