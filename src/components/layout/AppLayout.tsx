import { PropsWithChildren } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { cn } from "@/lib/utils";

function MainContent({ children }: PropsWithChildren) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";
  
  return (
    <main 
      className={cn(
        "flex-1 transition-[margin] duration-200 ease-linear",
        isMobile ? "pt-14 pb-20 px-4" : "py-4",
        !isMobile && (isCollapsed ? "md:ml-12 md:pr-4 md:pl-4" : "md:ml-56 md:pr-4 md:pl-6")
      )}
    >
      {children}
    </main>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  const isMobile = useIsMobile();
  useTokenRefresh();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full relative">
        <AppSidebar />
        
        <div className="flex-1 w-full">
          <MainContent>{children}</MainContent>
        </div>
        
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
