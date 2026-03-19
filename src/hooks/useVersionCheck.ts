import { useState, useEffect, useCallback } from "react";

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

interface VersionInfo {
  buildTime: string;
  hash: string;
}

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [initialHash, setInitialHash] = useState<string | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: VersionInfo = await res.json();
      
      if (initialHash === null) {
        setInitialHash(data.hash);
      } else if (data.hash !== initialHash) {
        setUpdateAvailable(true);
      }
    } catch {
      // Silently ignore - server might be unreachable
    }
  }, [initialHash]);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkVersion]);

  const reload = () => {
    window.location.reload();
  };

  return { updateAvailable, reload };
}
