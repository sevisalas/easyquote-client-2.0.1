import { Home, LayoutDashboard, Users, PlusCircle, LogOut, PanelLeft, FileText, Palette, UserCog, Settings } from "lucide-react";
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Item {
  title: string;
  url: string;
  icon: LucideIcon;
}

const items: Item[] = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Panel de control", url: "/dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error", description: "No se pudo cerrar sesión", variant: "destructive" });
      return;
    }
    toast({ title: "Sesión cerrada" });
    navigate("/auth");
  };
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" aria-label="Ir al inicio" className="flex items-center justify-center px-2 py-2">
          <picture>
            <source srcSet="/lovable-uploads/6b895d66-5fd4-4be7-b9b7-6b22e2b14c75.png" media="(prefers-color-scheme: dark)" />
            <img
              src="/lovable-uploads/3ff3c1d3-fd0e-4649-9146-6991b081234b.png"
              alt="Logo EasyQuote"
              className={`${isCollapsed ? "h-6" : "h-8"} w-auto max-w-full object-contain`}
            />
          </picture>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Solo mostrar Inicio y Dashboard si NO es superadmin */}
              {!isSuperAdmin && items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Solo mostrar si NO es superadmin */}
              {!isSuperAdmin && (
                <>
                  {/* Clientes */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={currentPath.startsWith("/clientes")}
                    >
                      <NavLink to="/clientes" end className={getNavCls}>
                        <Users className="mr-2 h-4 w-4" />
                        {!isCollapsed && <span>Clientes</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={currentPath === "/clientes"}
                        >
                          <NavLink to="/clientes" end className={getNavCls}>
                            <Users className="mr-2 h-4 w-4" />
                            {!isCollapsed && <span>Listado</span>}
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={currentPath === "/clientes/nuevo"}
                        >
                          <NavLink to="/clientes/nuevo" className={getNavCls}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {!isCollapsed && <span>Nuevo</span>}
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>

                  {/* Presupuestos */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={currentPath.startsWith("/presupuestos")}
                    >
                      <NavLink to="/presupuestos" end className={getNavCls}>
                        <FileText className="mr-2 h-4 w-4" />
                        {!isCollapsed && <span>Presupuestos</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={currentPath === "/presupuestos"}
                        >
                          <NavLink to="/presupuestos" end className={getNavCls}>
                            <FileText className="mr-2 h-4 w-4" />
                            {!isCollapsed && <span>Listado</span>}
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={currentPath === "/presupuestos/nuevo"}
                        >
                          <NavLink to="/presupuestos/nuevo" className={getNavCls}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {!isCollapsed && <span>Nuevo</span>}
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>

                  {/* Configuración */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={currentPath.startsWith("/configuracion")}>
                      <NavLink to="/configuracion/plantilla-pdf" end className={getNavCls}>
                        <Palette className="mr-2 h-4 w-4" />
                        {!isCollapsed && <span>Configuración</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={currentPath === "/configuracion/plantilla-pdf"}>
                          <NavLink to="/configuracion/plantilla-pdf" end className={getNavCls}>
                            <FileText className="mr-2 h-4 w-4" />
                            {!isCollapsed && <span>Plantilla PDF</span>}
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </>
              )}

              {/* Solo mostrar si es superadmin o admin de suscriptor */}
              {(isSuperAdmin || isOrgAdmin) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={currentPath === "/usuarios"}>
                    <NavLink to="/usuarios" end className={getNavCls}>
                      <UserCog className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>Gestión de usuarios</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Solo mostrar si es superadmin */}
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={currentPath === "/planes"}>
                    <NavLink to="/planes" end className={getNavCls}>
                      <Settings className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>Gestión de planes</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={isCollapsed ? "Expandir" : "Contraer"}>
              <button onClick={toggleSidebar} className="w-full flex items-center">
                <PanelLeft className="mr-2 h-4 w-4" />
                {!isCollapsed && <span>{isCollapsed ? "Expandir" : "Contraer"}</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Cerrar sesión">
              <button onClick={handleSignOut} className="w-full flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                {!isCollapsed && <span>Cerrar sesión</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
