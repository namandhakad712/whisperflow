import { app } from "electron";

/**
 * Auto-update wiring. Publishes to GitHub Releases (electron-builder.yml);
 * settings/history live in userData and survive updates untouched.
 * Checks at launch, every 6 hours, and on demand via checkNow().
 */
let checkNow: () => Promise<string> = async () => "dev build — updates skipped";

export function initUpdater(log: (...args: unknown[]) => void): void {
  if (!app.isPackaged) {
    log("updater: skipped (dev build)");
    return;
  }
  void (async () => {
    try {
      const { autoUpdater } = await import("electron-updater");
      autoUpdater.logger = null;
      autoUpdater.autoDownload = true;
      autoUpdater.on("update-downloaded", () => log("updater: update downloaded, installs on quit"));
      const check = async () => {
        try {
          const r = await autoUpdater.checkForUpdates();
          return r?.updateInfo?.version ? `latest: ${r.updateInfo.version}` : "up to date";
        } catch (err) {
          return `check failed: ${String(err).slice(0, 80)}`;
        }
      };
      checkNow = check;
      await check();
      setInterval(() => void check(), 6 * 60 * 60 * 1000);
    } catch (err) {
      log("updater: unavailable:", err);
    }
  })();
}

export function checkForUpdatesNow(): Promise<string> {
  return checkNow();
}
