import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ConfigurableStatusKey,
  DEFAULT_STATUS_HEX,
  DEFAULT_STATUS_LABEL,
  normalizeStatusKey,
  styleFromHex,
} from "@/lib/statusColors";
import { useToast } from "@/hooks/use-toast";

export interface StatusSetting {
  status_key: ConfigurableStatusKey;
  label: string;
  color: string; // hex
  display_order: number;
}

const ORDER: ConfigurableStatusKey[] = [
  "draft",
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

function defaultsList(): StatusSetting[] {
  return ORDER.map((k, i) => ({
    status_key: k,
    label: DEFAULT_STATUS_LABEL[k],
    color: DEFAULT_STATUS_HEX[k],
    display_order: i,
  }));
}

const getStatusSettingsQueryKey = (organizationId: string | null) => ["status-settings", organizationId];

function notifyStatusSettingsUpdated(organizationId: string) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({ organizationId, ts: Date.now() });
  window.localStorage.setItem("status-settings-updated", payload);

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("status-settings-sync");
    channel.postMessage({ organizationId, ts: Date.now() });
    channel.close();
  }
}

export function useStatusSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const organizationId = sessionStorage.getItem("selected_organization_id");

  const { data: settings = defaultsList(), isLoading } = useQuery({
    queryKey: getStatusSettingsQueryKey(organizationId),
    queryFn: async () => {
      if (!organizationId) return defaultsList();
      const { data, error } = await supabase
        .from("organization_status_settings")
        .select("status_key,label,color,display_order")
        .eq("organization_id", organizationId)
        .order("display_order", { ascending: true });
      if (error) {
        console.error("status-settings", error);
        return defaultsList();
      }
      const map = new Map((data || []).map((r) => [r.status_key, r]));
      return ORDER.map((k, i) => {
        const row = map.get(k);
        return {
          status_key: k,
          label: row?.label || DEFAULT_STATUS_LABEL[k],
          color: row?.color || DEFAULT_STATUS_HEX[k],
          display_order: row?.display_order ?? i,
        } as StatusSetting;
      });
    },
    refetchInterval: organizationId ? 30000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!organizationId || typeof window === "undefined") return;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: getStatusSettingsQueryKey(organizationId) });
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "status-settings-updated" || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as { organizationId?: string };
        if (payload.organizationId === organizationId) invalidate();
      } catch {
        console.warn("status-settings: no se pudo leer el evento de sincronización");
      }
    };

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("status-settings-sync")
        : null;

    const onBroadcastMessage = (event: MessageEvent<{ organizationId?: string }>) => {
      if (event.data?.organizationId === organizationId) invalidate();
    };

    channel?.addEventListener("message", onBroadcastMessage);
    window.addEventListener("storage", onStorage);

    const realtimeChannel = supabase
      .channel(`organization-status-settings-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organization_status_settings",
          filter: `organization_id=eq.${organizationId}`,
        },
        invalidate
      )
      .subscribe();

    return () => {
      channel?.removeEventListener("message", onBroadcastMessage);
      channel?.close();
      window.removeEventListener("storage", onStorage);
      supabase.removeChannel(realtimeChannel);
    };
  }, [organizationId, qc]);

  const upsert = useMutation({
    mutationFn: async (s: StatusSetting) => {
      if (!organizationId) throw new Error("Sin organización");
      const { error } = await supabase
        .from("organization_status_settings")
        .upsert(
          {
            organization_id: organizationId,
            status_key: s.status_key,
            label: s.label,
            color: s.color,
            display_order: s.display_order,
          },
          { onConflict: "organization_id,status_key" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, saved) => {
      qc.setQueryData(getStatusSettingsQueryKey(organizationId), (current: StatusSetting[] | undefined) => {
        const base = current?.length ? current : defaultsList();
        return base.map((row) => (row.status_key === saved.status_key ? saved : row));
      });
      qc.invalidateQueries({ queryKey: getStatusSettingsQueryKey(organizationId) });
      if (organizationId) notifyStatusSettingsUpdated(organizationId);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const map = Object.fromEntries(settings.map((s) => [s.status_key, s])) as Record<
    ConfigurableStatusKey,
    StatusSetting
  >;

  const resolve = (raw: string | null | undefined) => {
    const key = normalizeStatusKey(raw);
    const s = map[key];
    return { key, label: s.label, color: s.color, style: styleFromHex(s.color) };
  };

  return { settings, map, isLoading, upsert: upsert.mutate, resolve };
}