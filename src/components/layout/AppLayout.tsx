import { PropsWithChildren, useCallback } from "react";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function MainContent({ children }: PropsWithChildren) {
  const { state } = useSidebar();
  const paddingCls = state === "collapsed" ? "md:pl-12" : "md:pl-64";
  return <main className={`flex-1 p-4 md:p-6 ${paddingCls}`}>{children}</main>;
}

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
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
