import { PropsWithChildren } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

function MainContent({ children }: PropsWithChildren) {
  return (
    <main className={"flex-1 pr-4 md:pr-6 py-4 md:py-6 md:pl-[--sidebar-width] md:peer-data-[collapsible=icon]:pl-[--sidebar-width-icon]"}>
      {children}
    </main>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {

  return (
    <SidebarProvider>

      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
