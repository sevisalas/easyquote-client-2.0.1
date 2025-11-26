import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
}

export function MobileHeader({ title, showBack = false }: MobileHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-center px-4 bg-background border-b border-border md:hidden">
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9 absolute left-4"
        >
          <ArrowLeft size={20} />
        </Button>
      )}
      
      {title && (
        <h1 className="text-base font-semibold truncate">
          {title}
        </h1>
      )}
    </header>
  );
}
