import { PropsWithChildren } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function MainContent({ children }: PropsWithChildren) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  return (
    <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
      <main 
        className={cn(
          "flex-1 p-4 transition-all duration-300 ease-in-out overflow-x-hidden",
          isCollapsed ? "ml-12" : "ml-28"
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  // Activar detección de tokens expirados
  useTokenRefresh();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full relative">
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
