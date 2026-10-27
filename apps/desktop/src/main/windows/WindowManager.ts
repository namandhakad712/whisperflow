import { BrowserWindow, screen, shell } from "electron";
import type { Display, WebContents } from "electron";
import { join } from "node:path";
import { log } from "../lib/log";
import { computeOverlayBounds, type OverlayAnchor } from "./overlayAnchor";

export type { OverlayAnchor };

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
      backgroundColor: "#050505",
      title: "WhisperFlow",
      webPreferences: {
        preload: this.opts.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // ESM preload
      },
    });
    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) win.show();
    });
    // Never stay invisible: if the renderer fails or is slow, show the window
    // anyway. An app with no window and no visible tray icon reads as "not
    // installed" — a blank window plus a log line is far better.
    const showTimer = setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) {
        log("window: settings never signalled ready-to-show — showing anyway");
        win.show();
      }
    }, 2500);
    win.once("show", () => clearTimeout(showTimer));
    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
      log(`window: settings failed to load (${code} ${desc}) ${url}`);
      if (!win.isDestroyed() && !win.isVisible()) win.show();
    });

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

  /** Shows the frameless overlay pill (anchor modes in overlayAnchor.ts). */
  private overlayAnchor: OverlayAnchor = "cursor";

  /**
   * Places the overlay. Anchor semantics replicated from the reference app:
   * everything is clamped inside the target display's *work area* (so it never
   * hides under the taskbar), the target display is the one nearest the anchor
   * point, and corner anchors are re-applied when monitors are added/removed.
   */
  showOverlay(near?: { x: number; y: number }, position: OverlayAnchor = "cursor"): void {
    const win = this.ensureOverlay();
    const size = win.getSize();
    const cursor = near ?? screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    this.overlayAnchor = position;
    this.overlayDisplayId = display.id;

    const bounds = computeOverlayBounds(
      position,
      { width: size[0] ?? 500, height: size[1] ?? 420 },
      display.workArea,
      cursor,
    );
    win.setBounds(bounds, false);
    log(
      `overlay: anchor=${position} size=${size[0]}x${size[1]} → bounds=${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`,
    );
    if (process.platform === "darwin") {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    this.watchDisplayChanges(win);
    win.showInactive();
  }

  /** Pure anchor → bounds math (see overlayAnchor.ts; unit-tested). */
  static computeBounds(
    anchor: OverlayAnchor,
    size: { width: number; height: number },
    display: Display,
    cursor?: { x: number; y: number },
  ): Electron.Rectangle {
    return computeOverlayBounds(anchor, size, display.workArea, cursor);
  }

  private boundsFor(
    anchor: OverlayAnchor,
    size: { width: number; height: number },
    display: Display,
    cursor: { x: number; y: number },
  ): Electron.Rectangle {
    return WindowManager.computeBounds(anchor, size, display, cursor);
  }

  private overlayDisplayId: number | null = null;
  private displayHooked = false;

  /** Corner-anchored overlays must stay on their display when the layout changes. */
  private watchDisplayChanges(win: BrowserWindow): void {
    if (this.displayHooked) return;
    this.displayHooked = true;
    const reposition = () => {
      if (win.isDestroyed() || !win.isVisible()) return;
      if (this.overlayAnchor === "cursor") return; // re-derived per dictation
      const display =
        screen.getAllDisplays().find((d) => d.id === this.overlayDisplayId) ??
        screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      this.overlayDisplayId = display.id;
      const size = win.getSize();
      const width = size[0] ?? 520;
      const height = size[1] ?? 148;
      win.setBounds(this.boundsFor(this.overlayAnchor, { width, height }, display, screen.getCursorScreenPoint()), false);
    };
    screen.on("display-removed", reposition);
    screen.on("display-metrics-changed", reposition);
  }

  /**
   * Click-through by default (the overlay never blocks the app underneath).
   * The renderer flips this on when the pointer is over something clickable.
   */
  setOverlayInteractive(interactive: boolean): void {
    const win = this.overlayWindow;
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
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
      // Reference geometry: 500×420 default panel, 300×200 minimum, expandable
      // to 920×660 (the overlay grows with long transcripts).
      width: 500,
      height: 420,
      minWidth: 300,
      minHeight: 200,
      maxWidth: 920,
      maxHeight: 660,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      // Windows: "toolbar" keeps the panel out of Alt-Tab and off the taskbar
      // while still floating above full-screen apps (pairs with screen-saver
      // level below). macOS: "panel".
      type: process.platform === "darwin" ? "panel" : "toolbar",
      fullscreenable: false,
      maximizable: false,
      minimizable: false,
      closable: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      focusable: true, // focusable but never focused: we always show inactive
      alwaysOnTop: true,
      webPreferences: {
        preload: this.opts.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    // Highest practical level: stays above full-screen apps and games.
    win.setAlwaysOnTop(true, "screen-saver");
    win.setFullScreenable(false);
    // Click-through until the renderer reports the pointer is over a control.
    win.setIgnoreMouseEvents(true, { forward: true });
    if (process.platform === "darwin") {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    const target = this.opts.resolveRenderer("overlay");
    if (target) void win.loadURL(target);
    else void win.loadFile(join(__dirname, "../renderer/overlay.html"));
    win.webContents.on("did-finish-load", () => {
      // Re-assert the default after (re)load so a fresh page can't leave the
      // overlay swallowing clicks.
      if (!win.isDestroyed()) win.setIgnoreMouseEvents(true, { forward: true });
    });
    this.overlayWindow = win;
    return win;
  }
}
