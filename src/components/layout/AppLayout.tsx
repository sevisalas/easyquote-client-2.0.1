import { PropsWithChildren } from "react";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { cn } from "@/lib/utils";

function MainContent({ children }: PropsWithChildren) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  return (
    <main 
      className={cn(
        "flex-1 py-4 transition-[margin] duration-200 ease-linear",
        isCollapsed ? "md:ml-12 md:pr-4 md:pl-4" : "md:ml-56 md:pr-4 md:pl-6"
      )}
    >
      {children}
    </main>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  // Activar detección de tokens expirados
  useTokenRefresh();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full relative">
        {/* Header with menu trigger - always visible on mobile */}
        <header className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center border-b bg-background md:hidden">
          <SidebarTrigger className="ml-2" />
        </header>
        
        <AppSidebar />
        
        <div className="flex-1 w-full pt-12 md:pt-0">
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </SidebarProvider>
  );
}
