import { PropsWithChildren } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

function MainContent({ children }: PropsWithChildren) {
  return (
    <main className="flex-1 p-4 md:p-6 w-full min-w-0">
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
