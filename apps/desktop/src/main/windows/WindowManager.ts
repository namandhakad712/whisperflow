import { BrowserWindow, screen, shell, WebContents } from "electron";
import { join } from "node:path";

/**
 * Owns every window in the app:
 *  - settings: full app window (settings tabs, history, onboarding)
 *  - overlay:  the frameless dictation pill shown near the cursor while listening
 */
export class WindowManager {
  private settingsWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;

  constructor(
    private readonly opts: {
      preloadPath: string;
      resolveRenderer: (page: "settings" | "overlay") => string | null; // dev URL or null → file
    },
  ) {}

  createSettingsWindow(route = ""): BrowserWindow {
    if (this.settingsWindow?.isDestroyed() === false) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      if (route) this.settingsWindow.webContents.send("app/navigate", route);
      return this.settingsWindow;
    }
    const win = new BrowserWindow({
      width: 1120,
      height: 760,
      minWidth: 920,
      minHeight: 640,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: "#070b14",
      title: "WhisperFlow",
      webPreferences: {
        preload: this.opts.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // ESM preload
      },
    });
    win.once("ready-to-show", () => win.show());

    // External links open in the browser, never in-app.
    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: "deny" };
    });

    const target = this.opts.resolveRenderer("settings");
    if (target) void win.loadURL(target + (route ? `#${route}` : ""));
    else void win.loadFile(join(__dirname, "../renderer/settings.html"));

    this.settingsWindow = win;
    return win;
  }

  /** Shows the frameless overlay pill near a point (defaults to cursor), without stealing focus. */
  showOverlay(near?: { x: number; y: number }): void {
    const win = this.ensureOverlay();
    const [w, h] = win.getSize();
    const point = near ?? screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    const bx = Math.min(
      Math.max(point.x - w / 2, display.workArea.x + 8),
      display.workArea.x + display.workArea.width - w - 8,
    );
    const by = Math.min(
      Math.max(point.y - h - 28, display.workArea.y + 8),
      display.workArea.y + display.workArea.height - h - 8,
    );
    win.setPosition(Math.round(bx), Math.round(by), false);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.showInactive();
  }

  hideOverlay(): void {
    if (this.overlayWindow?.isDestroyed() === false) this.overlayWindow.hide();
  }

  isOverlayVisible(): boolean {
    return this.overlayWindow?.isDestroyed() === false && this.overlayWindow.isVisible();
  }

  overlayWeb(): WebContents | null {
    return this.overlayWindow?.isDestroyed() === false ? this.overlayWindow.webContents : null;
  }

  settingsWeb(): WebContents | null {
    return this.settingsWindow?.isDestroyed() === false ? this.settingsWindow.webContents : null;
  }

  sendToOverlay(channel: string, payload: unknown): void {
    this.overlayWeb()?.send(channel, payload);
  }

  sendToSettings(channel: string, payload: unknown): void {
    this.settingsWeb()?.send(channel, payload);
  }

  dispose(): void {
    for (const w of [this.settingsWindow, this.overlayWindow]) {
      if (w && !w.isDestroyed()) w.destroy();
    }
    this.settingsWindow = null;
    this.overlayWindow = null;
  }

  private ensureOverlay(): BrowserWindow {
    if (this.overlayWindow?.isDestroyed() === false) return this.overlayWindow;
    const win = new BrowserWindow({
      width: 520,
      height: 148,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      focusable: false, // never steal focus from the app receiving text
      alwaysOnTop: true,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: this.opts.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(false);
    const target = this.opts.resolveRenderer("overlay");
    if (target) void win.loadURL(target);
    else void win.loadFile(join(__dirname, "../renderer/overlay.html"));
    this.overlayWindow = win;
    return win;
  }
}
