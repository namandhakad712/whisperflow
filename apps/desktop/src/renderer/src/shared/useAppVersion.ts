import { useEffect, useState } from "react";

/**
 * The real app version, straight from main's `app.getVersion()` (package.json).
 * "—" until the IPC round-trips so footers never flash a stale or hardcoded
 * number. Never throws — the version is informational, not load-bearing.
 */
export function useAppVersion(): string {
  const [version, setVersion] = useState("—");
  useEffect(() => {
    let alive = true;
    window.whisperflow.app
      .version()
      .then((v) => {
        if (alive) setVersion(v || "—");
      })
      .catch(() => {
        /* unreachable in practice; keep the placeholder */
      });
    return () => {
      alive = false;
    };
  }, []);
  return version;
}
