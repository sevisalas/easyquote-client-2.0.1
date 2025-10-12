import { Home, LayoutDashboard, Users, PlusCircle, LogOut, FileText, Palette, UserCog, Settings, Plus, Plug, FileSpreadsheet, Package, Tags, Menu, Key, Image, Building } from "lucide-react";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";

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
  const { 
    isSuperAdmin, 
    isOrgAdmin, 
    canAccessClientes,
    canAccessPresupuestos,
    canAccessExcel,
    canAccessProductos,
    canAccessCategorias,
    loading
  } = useSubscription();
  const { isHoldedActive } = useHoldedIntegration();

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
      <SidebarHeader className="p-2">
        <Link to="/" aria-label="Ir al inicio" className="flex items-center justify-center px-1 py-1">
          {isCollapsed ? (
            <img
              src="/lovable-uploads/favicon.png"
              alt="EQ Logo"
              className="h-6 w-6 object-contain"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallbackApplied) {
                  console.warn('Collapsed logo fallback also failed, hiding');
                  img.style.display = 'none';
                  return;
                }
                console.warn('Collapsed logo failed, switching to fallback');
                img.src = '/lovable-uploads/logo_transparente.png';
                img.dataset.fallbackApplied = 'true';
              }}
            />
          ) : (
            <img
              src="/lovable-uploads/logo_transparente-removebg-preview.png"
              alt="Logo EasyQuote"
              className="h-6 w-auto max-w-full object-contain"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallbackApplied) {
                  console.warn('Expanded logo fallback also failed, hiding');
                  img.style.display = 'none';
                  return;
                }
                console.warn('Expanded logo failed, switching to fallback');
                img.src = '/lovable-uploads/logo_transparente.png';
                img.dataset.fallbackApplied = 'true';
              }}
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-1">
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0">
              {/* Menú para SuperAdmin */}
              {isSuperAdmin && (
                <>
                  <SidebarMenuItem>
                     <SidebarMenuButton asChild isActive={currentPath === "/"} className="h-7 px-2">
                       <NavLink to="/" end className={getNavCls}>
                         <Home className="mr-2 h-4 w-4" />
                         {!isCollapsed && <span>Dashboard</span>}
                       </NavLink>
                     </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                     <SidebarMenuButton asChild isActive={currentPath === "/planes"} className="h-7 px-2">
                       <NavLink to="/planes" end className={getNavCls}>
                         <Settings className="mr-2 h-4 w-4" />
                         {!isCollapsed && <span>Planes</span>}
                       </NavLink>
                     </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                     <SidebarMenuButton asChild isActive={currentPath === "/usuarios"} className="h-7 px-2">
                       <NavLink to="/usuarios" end className={getNavCls}>
                         <UserCog className="mr-2 h-4 w-4" />
                         {!isCollapsed && <span>Suscriptores</span>}
                       </NavLink>
                     </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                     <SidebarMenuButton asChild isActive={currentPath === "/integraciones-acceso"} className="h-7 px-2">
                       <NavLink to="/integraciones-acceso" end className={getNavCls}>
                         <Plug className="mr-2 h-4 w-4" />
                         {!isCollapsed && <span>Integraciones</span>}
                       </NavLink>
                     </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                     <SidebarMenuButton asChild isActive={currentPath === "/subscriber-users"} className="h-7 px-2">
                       <NavLink to="/subscriber-users" end className={getNavCls}>
                         <Users className="mr-2 h-4 w-4" />
                         {!isCollapsed && <span>Gestión Usuarios</span>}
                       </NavLink>
                     </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

              {/* Menú para usuarios normales */}
              {!isSuperAdmin && (
                <>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                       <SidebarMenuButton asChild isActive={currentPath === item.url} className="h-7 px-2">
                         <NavLink to={item.url} end className={getNavCls}>
                           <item.icon className="mr-2 h-4 w-4" />
                           {!isCollapsed && <span>{item.title}</span>}
                         </NavLink>
                       </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                  {/* Clientes - Solo para suscripciones Client */}
                  {canAccessClientes() && (
                    <SidebarMenuItem>
                       <SidebarMenuButton
                         asChild
                         isActive={currentPath.startsWith("/clientes")}
                         className="h-7 px-2"
                       >
                         <NavLink to="/clientes" end className={getNavCls}>
                           <Users className="mr-2 h-4 w-4" />
                           {!isCollapsed && <span>Clientes</span>}
                         </NavLink>
                       </SidebarMenuButton>
                       <SidebarMenuSub className="ml-2">
                         <SidebarMenuSubItem>
                           <SidebarMenuSubButton
                             asChild
                             isActive={currentPath === "/clientes"}
                             className="h-6 px-2"
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
                             className="h-6 px-2"
                           >
                             <NavLink to="/clientes/nuevo" className={getNavCls}>
                               <PlusCircle className="mr-2 h-4 w-4" />
                               {!isCollapsed && <span>Nuevo</span>}
                             </NavLink>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       </SidebarMenuSub>
                    </SidebarMenuItem>
                  )}

                  {/* Presupuestos - Solo para suscripciones Client */}
                  {canAccessPresupuestos() && (
                    <SidebarMenuItem>
                       <SidebarMenuButton
                         asChild
                         isActive={currentPath.startsWith("/presupuestos")}
                         className="h-7 px-2"
                       >
                         <NavLink to="/presupuestos" end className={getNavCls}>
                           <FileText className="mr-2 h-4 w-4" />
                           {!isCollapsed && <span>Presupuestos</span>}
                         </NavLink>
                       </SidebarMenuButton>
                       <SidebarMenuSub className="ml-2">
                         <SidebarMenuSubItem>
                           <SidebarMenuSubButton
                             asChild
                             isActive={currentPath === "/presupuestos"}
                             className="h-6 px-2"
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
                             className="h-6 px-2"
                           >
                             <NavLink to="/presupuestos/nuevo" className={getNavCls}>
                               <PlusCircle className="mr-2 h-4 w-4" />
                               {!isCollapsed && <span>Nuevo</span>}
                             </NavLink>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       </SidebarMenuSub>
                    </SidebarMenuItem>
                  )}

                   <SidebarMenuItem>
                     <SidebarMenuButton asChild isActive={currentPath.startsWith("/configuracion")} className="h-7 px-2">
                       <NavLink to="/configuracion/plantilla-pdf" end className={getNavCls}>
                         <Palette className="mr-2 h-4 w-4" />
                         {!isCollapsed && <span>Configuración</span>}
                       </NavLink>
                     </SidebarMenuButton>
                     <SidebarMenuSub className="ml-2">
                       <SidebarMenuSubItem>
                         <SidebarMenuSubButton asChild isActive={currentPath === "/configuracion/ajustes"} className="h-6 px-2">
                           <NavLink to="/configuracion/ajustes" end className={getNavCls}>
                             <Plus className="mr-2 h-4 w-4" />
                             {!isCollapsed && <span>Ajustes</span>}
                           </NavLink>
                         </SidebarMenuSubButton>
                       </SidebarMenuSubItem>
                       <SidebarMenuSubItem>
                         <SidebarMenuSubButton asChild isActive={currentPath === "/configuracion/plantilla-pdf"} className="h-6 px-2">
                           <NavLink to="/configuracion/plantilla-pdf" end className={getNavCls}>
                             <FileText className="mr-2 h-4 w-4" />
                             {!isCollapsed && <span>Plantilla PDF</span>}
                           </NavLink>
                         </SidebarMenuSubButton>
                       </SidebarMenuSubItem>
                        {/* Integraciones - Solo admins */}
                        {(isSuperAdmin || isOrgAdmin) && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={currentPath === "/configuracion/integraciones"} className="h-6 px-2">
                                <NavLink to="/configuracion/integraciones" end className={getNavCls}>
                                  <Plug className="mr-2 h-4 w-4" />
                                  {!isCollapsed && <span>Integraciones</span>}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                       
                       {/* Archivos Excel - Solo API suscriptions o Client admins */}
                       {canAccessExcel() && (
                         <SidebarMenuSubItem>
                           <SidebarMenuSubButton asChild isActive={currentPath === "/configuracion/archivos-excel"} className="h-6 px-2">
                             <NavLink to="/configuracion/archivos-excel" end className={getNavCls}>
                               <FileSpreadsheet className="mr-2 h-4 w-4" />
                               {!isCollapsed && <span>Archivos Excel</span>}
                             </NavLink>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       )}
                       
                       {/* Productos - Solo API subscriptions o Client admins */}
                       {canAccessProductos() && (
                         <SidebarMenuSubItem>
                           <SidebarMenuSubButton asChild isActive={currentPath === "/admin/productos"} className="h-6 px-2">
                             <NavLink to="/admin/productos" end className={getNavCls}>
                               <Package className="mr-2 h-4 w-4" />
                               {!isCollapsed && <span>Productos</span>}
                             </NavLink>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       )}
                       
                       {/* Categorías - Solo API subscriptions o Client admins */}
                       {canAccessCategorias() && (
                         <SidebarMenuSubItem>
                           <SidebarMenuSubButton asChild isActive={currentPath === "/admin/categorias"} className="h-6 px-2">
                             <NavLink to="/admin/categorias" end className={getNavCls}>
                               <Tags className="mr-2 h-4 w-4" />
                               {!isCollapsed && <span>Categorías</span>}
                             </NavLink>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       )}
                       
                       {/* Gestión de imágenes - Solo API subscriptions o Client admins */}
                       {canAccessProductos() && (
                         <SidebarMenuSubItem>
                           <SidebarMenuSubButton asChild isActive={currentPath === "/configuracion/imagenes"} className="h-6 px-2">
                             <NavLink to="/configuracion/imagenes" end className={getNavCls}>
                               <Image className="mr-2 h-4 w-4" />
                               {!isCollapsed && <span>Imágenes</span>}
                             </NavLink>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       )}
                     </SidebarMenuSub>
                   </SidebarMenuItem>
                </>
              )}

              {/* Gestión de usuarios - solo para org admin (no superadmin, ya está arriba) */}
               {!isSuperAdmin && isOrgAdmin && (
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild isActive={currentPath === "/usuarios"} className="h-7 px-2">
                     <NavLink to="/usuarios" end className={getNavCls}>
                       <UserCog className="mr-2 h-4 w-4" />
                       {!isCollapsed && <span>Gestión de usuarios</span>}
                     </NavLink>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
               )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Contraer menú" className="h-7 px-2">
              <button onClick={toggleSidebar} className="w-full flex items-center justify-start">
                <Menu className="mr-2 h-4 w-4" />
                {!isCollapsed && <span>Contraer menú</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Cerrar sesión" className="h-7 px-2">
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
