import { PropsWithChildren } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

function MainContent({ children }: PropsWithChildren) {
  return (
    <main className={"flex-1 pr-4 md:pr-6 py-4 md:py-6 pl-4 md:pl-[calc(var(--sidebar-width)+1.5rem)] md:peer-data-[collapsible=icon]:pl-[calc(var(--sidebar-width-icon)+1.5rem)]"}>
      {children}
    </main>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  // Activar detección de tokens expirados
  useTokenRefresh();

  return (
    <SidebarProvider>

      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
