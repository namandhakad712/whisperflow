import { app } from "electron";

/**
 * Auto-update wiring. Inert until electron-builder.yml `publish` points at a
 * real GitHub repository with releases; checkForUpdates() simply rejects in
 * dev/unpublished builds and we swallow it.
 */
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
      await autoUpdater.checkForUpdates();
      setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
    } catch (err) {
      log("updater: unavailable:", err);
    }
  })();
}
