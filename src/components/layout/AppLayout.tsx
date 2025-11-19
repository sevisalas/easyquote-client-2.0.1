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
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
