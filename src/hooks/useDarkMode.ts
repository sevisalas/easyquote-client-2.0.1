import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeMode = "light" | "dark";
const STORAGE_PREFIX = "easyquote-theme:";
let currentUserId: string | null = null;

function storageKey(uid: string | null) {
  return STORAGE_PREFIX + (uid ?? "anon");
}

function getStoredMode(uid: string | null = currentUserId): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(storageKey(uid));
  return v === "dark" ? "dark" : "light";
}

function resolve(mode: ThemeMode): "light" | "dark" {
  return mode;
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function useDarkMode() {
  const [uid, setUid] = useState<string | null>(currentUserId);
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredMode(currentUserId));
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => resolve(getStoredMode(currentUserId)));

  // Track logged-in user; switch preference when user changes
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      currentUserId = data.user?.id ?? null;
      setUid(currentUserId);
      setModeState(getStoredMode(currentUserId));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      currentUserId = session?.user?.id ?? null;
      setUid(currentUserId);
      setModeState(getStoredMode(currentUserId));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const r = resolve(mode);
    setResolvedMode(r);
    apply(r);
  }, [mode]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey(uid)) setModeState(getStoredMode(uid));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [uid]);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(storageKey(uid), m);
    setModeState(m);
  }, [uid]);

  return { mode, resolvedMode, setMode };
}