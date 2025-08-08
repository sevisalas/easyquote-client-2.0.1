import { PropsWithChildren, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
export default function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error", description: "No se pudo cerrar sesión", variant: "destructive" });
      return;
    }
    toast({ title: "Sesión cerrada" });
    navigate("/auth");
  }, [navigate]);
  return (
    <SidebarProvider>
      <header className="h-14 flex items-center border-b bg-background">
        <div className="container mx-auto flex items-center gap-3 px-4">
          <SidebarTrigger aria-label="Abrir menú" />
          <Link to="/" className="flex items-center gap-2" aria-label="Ir al inicio">
            <picture>
              <source srcSet="/lovable-uploads/6b895d66-5fd4-4be7-b9b7-6b22e2b14c75.png" media="(prefers-color-scheme: dark)" />
              <img
                src="/lovable-uploads/3ff3c1d3-fd0e-4649-9146-6991b081234b.png"
                alt="EasyQuote logo"
                loading="lazy"
                className="h-6 w-auto"
              />
            </picture>
          </Link>

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
