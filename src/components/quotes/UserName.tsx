import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserNameProps {
  userId?: string | null;
  fallback?: string;
}

export const UserName = ({ userId, fallback = "—" }: UserNameProps) => {
  const [userName, setUserName] = useState<string>(fallback);

  useEffect(() => {
    if (!userId) {
      setUserName(fallback);
      return;
    }

    const fetchUserName = async () => {
      try {
        // First try to get from organization_members (display_name)
        const { data: member } = await supabase
          .from('organization_members')
          .select('display_name')
          .eq('user_id', userId)
          .maybeSingle();

        if (member?.display_name) {
          setUserName(member.display_name);
          return;
        }

        // Fallback to profiles (first_name + last_name)
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', userId)
          .maybeSingle();

        if (profile) {
          const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ');
          if (fullName) {
            setUserName(fullName);
            return;
          }
        }

        // If nothing found, show fallback
        setUserName(fallback);
      } catch (error) {
        console.error('Error fetching user name:', error);
        setUserName(fallback);
      }
    };

    fetchUserName();
  }, [userId, fallback]);

  return <span>{userName}</span>;
};
