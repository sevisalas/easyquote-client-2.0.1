import { PropsWithChildren } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Link } from "react-router-dom";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <SidebarProvider>
      <header className="h-14 flex items-center border-b bg-background">
        <div className="container mx-auto flex items-center gap-3 px-4">
          <SidebarTrigger aria-label="Abrir menú" />
          <Link to="/" className="flex items-center gap-2" aria-label="Ir al inicio">
            <img
              src="/lovable-uploads/3ff3c1d3-fd0e-4649-9146-6991b081234b.png"
              alt="EasyQuote logo"
              loading="lazy"
              className="h-6 w-auto"
            />
          </Link>
        </div>
      </header>

      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
