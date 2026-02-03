import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
  api_user_id: string;
}

interface OrgSelectorProps {
  value: string | null;
  onValueChange: (orgId: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export default function OrgSelector({
  value,
  onValueChange,
  label = "Organización",
  placeholder = "Selecciona una organización",
  className = "",
}: OrgSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrganizations = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, subscription_plan, api_user_id")
        .order("name");

      if (error) {
        console.error("Error fetching organizations:", error);
      } else {
        setOrganizations(data || []);
      }
      setIsLoading(false);
    };

    fetchOrganizations();
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" />
          {label}
        </Label>
      )}
      <Select value={value || ""} onValueChange={onValueChange} disabled={isLoading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isLoading ? "Cargando..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <div className="flex items-center gap-2">
                <span>{org.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({org.subscription_plan})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
