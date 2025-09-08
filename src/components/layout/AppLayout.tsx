import { PropsWithChildren } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function MainContent({ children }: PropsWithChildren) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b bg-background relative z-10">
        <SidebarTrigger className="-ml-1" />
      </header>
      <main 
        className={cn(
          "flex-1 p-4 overflow-auto transition-all duration-300 ease-in-out",
          isCollapsed ? "ml-14" : "ml-56"
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
