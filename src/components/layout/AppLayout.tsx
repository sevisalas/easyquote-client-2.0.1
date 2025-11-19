import { PropsWithChildren } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { cn } from "@/lib/utils";

function MainContent({ children }: PropsWithChildren) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  return (
    <main 
      className={cn(
        "flex-1 p-4 transition-[margin] duration-200 ease-linear",
        isCollapsed ? "md:ml-12" : "md:ml-56"
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
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
