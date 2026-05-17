import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "easyquote-theme";

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(STORAGE_KEY);
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
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => resolve(getStoredMode()));

  useEffect(() => {
    const r = resolve(mode);
    setResolvedMode(r);
    apply(r);
  }, [mode]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setModeState(getStoredMode());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  }, []);

  return { mode, resolvedMode, setMode };
}