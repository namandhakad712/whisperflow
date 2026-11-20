import { app } from "electron";

/**
 * Applies login-item state from config. Only meaningful in packaged builds —
 * registering the dev Electron binary at login would be nonsense.
 */
export function applyLaunchAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: ["--hidden"],
  });
}

export function readLaunchAtLogin(): boolean {
  if (!app.isPackaged) return false;
  return app.getLoginItemSettings().openAtLogin;
}
