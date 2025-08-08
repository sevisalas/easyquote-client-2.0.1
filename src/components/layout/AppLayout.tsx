import { PropsWithChildren, useCallback } from "react";


import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function MainContent({ children }: PropsWithChildren) {
  return <main className={`flex-1 p-4 md:p-6`}>{children}</main>;
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
    <>
      <header className="h-14 flex items-center border-b bg-background">
        <div className="container mx-auto flex items-center gap-3 px-4">
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-screen flex w-full">
        <MainContent>{children}</MainContent>
      </div>
    </>
  );
}
