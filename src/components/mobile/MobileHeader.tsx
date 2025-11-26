import { SidebarTrigger } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
}

export function MobileHeader({ title, showBack = false, showMenu = true }: MobileHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-background border-b border-border md:hidden">
      <div className="flex items-center gap-2">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9"
          >
            <ArrowLeft size={20} />
          </Button>
        )}
        {showMenu && !showBack && <SidebarTrigger className="h-8 w-8" />}
      </div>
      
      {title && (
        <h1 className="text-base font-semibold truncate flex-1 text-center">
          {title}
        </h1>
      )}
      
      <div className="w-9" /> {/* Spacer for centering */}
    </header>
  );
}
