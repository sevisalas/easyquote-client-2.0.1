import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "easyquote-theme";

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function resolve(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

    if (mode === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const next = mql.matches ? "dark" : "light";
        setResolvedMode(next);
        apply(next);
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
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