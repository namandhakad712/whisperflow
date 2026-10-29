import { BrowserWindow, screen, shell } from "electron";
import type { Display, WebContents } from "electron";
import { join } from "node:path";
import { log } from "../lib/log";
import { computeOverlayBounds, type OverlayAnchor } from "./overlayAnchor";
import { SurfaceRecovery, type RecoverableSurface } from "./surfaceRecovery";

export type { OverlayAnchor };

/**
 * Owns every window in the app:
 *  - settings: full app window (settings tabs, history, onboarding)
 *  - overlay:  the frameless dictation pill shown near the cursor while listening
 */
export class WindowManager {
  private settingsWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private statusWindow: BrowserWindow | null = null;
  private overlayRecovery: SurfaceRecovery | null = null;
  private settingsRecovery: SurfaceRecovery | null = null;

  constructor(
    private readonly opts: {
      preloadPath: string;
      resolveRenderer: (page: "settings" | "overlay" | "status") => string | null; // dev URL or null → file
      /** True while a dictation is mid-flight — recovery must defer then. */
      isDictationBusy?: () => boolean;
    },
  ) {}

  private busy(): boolean {
    return this.opts.isDictationBusy?.() ?? false;
  }

  /** Their StatusSurface recovery ladder, attached to one of our windows. */
  private attachRecovery(win: BrowserWindow, name: "settings" | "overlay"): SurfaceRecovery {
    const surface: RecoverableSurface = {
      isAlive: () => !win.isDestroyed(),
      invalidate: () => void win.webContents?.invalidate(),
      pulse: () => {
        if (win.isDestroyed()) return null;
        const b = win.getContentBounds();
        win.setContentBounds({ ...b, height: b.height + 1 });
        return { width: b.width, height: b.height + 1 };
      },
      hideShow: () => {
        if (win.isDestroyed()) return;
        win.hide();
        // The overlay must never steal focus on its way back.
        if (name === "overlay") win.showInactive();
        else win.show();
      },
      rebuild: () => {
        if (win.isDestroyed()) return;
        win.destroy();
        if (name === "overlay") this.ensureOverlay();
        else this.createSettingsWindow();
      },
      log,
    };
    const recovery = new SurfaceRecovery(surface, () => this.busy());
    // Renderer deadlock or a hung load → escalate through the ladder.
    win.on("unresponsive", () => recovery.trigger());
    return recovery;
  }

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
    this.settingsRecovery = this.attachRecovery(win, "settings");
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
      { width: size[0] ?? 440, height: size[1] ?? 120 },
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
  private repositionOverlay: (() => void) | null = null;

  /** Corner-anchored overlays must stay on their display when the layout changes. */
  private watchDisplayChanges(win: BrowserWindow): void {
    if (this.displayHooked) return;
    this.displayHooked = true;
    const reposition = () => {
      const win = this.overlayWindow;
      if (!win || win.isDestroyed() || !win.isVisible()) return;
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
    this.repositionOverlay = reposition;
    screen.on("display-removed", reposition);
    screen.on("display-metrics-changed", reposition);
  }

  private unwatchDisplayChanges(): void {
    if (this.repositionOverlay) {
      screen.removeListener("display-removed", this.repositionOverlay);
      screen.removeListener("display-metrics-changed", this.repositionOverlay);
      this.repositionOverlay = null;
    }
    this.displayHooked = false;
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
    // The overlay is only shown while a dictation is in flight; keeping a
    // hidden BrowserWindow (and its renderer process) resident between
    // dictations wastes real memory for something used seconds at a time.
    // ensureOverlay() rebuilds it on demand, so drop it once it is hidden.
    this.destroyOverlay();
  }

  /**
   * Grows/shrinks the overlay window while keeping the pill bottom-anchored —
   * used for their notification card (200px) on a paste failure. The default
   * height (120) fits the pill states.
   */
  resizeOverlay(height: number): void {
    const win = this.overlayWindow;
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    win.setBounds({ ...b, y: b.y + b.height - height, height }, false);
  }

  private destroyOverlay(): void {
    this.unwatchDisplayChanges();
    if (this.overlayWindow?.isDestroyed() === false) this.overlayWindow.destroy();
    this.overlayWindow = null;
    this.overlayRecovery = null;
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

  statusWeb(): WebContents | null {
    return this.statusWindow?.isDestroyed() === false ? this.statusWindow.webContents : null;
  }

  sendToStatus(channel: string, payload: unknown): void {
    this.statusWeb()?.send(channel, payload);
  }

  sendToSettings(channel: string, payload: unknown): void {
    this.settingsWeb()?.send(channel, payload);
  }

  dispose(): void {
    for (const w of [this.settingsWindow, this.overlayWindow, this.statusWindow]) {
      if (w && !w.isDestroyed()) w.destroy();
    }
    this.settingsWindow = null;
    this.overlayWindow = null;
    this.statusWindow = null;
  }

  private ensureOverlay(): BrowserWindow {
    if (this.overlayWindow?.isDestroyed() === false) return this.overlayWindow;
    const win = new BrowserWindow({
      // The reference pill: 416×48 (mini) / 416×80 (card) / 416×322 (l4), plus
      // room for the badge and the drop shadow. Their window hugs the bar.
      width: 440,
      height: 120,
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
    this.overlayRecovery = this.attachRecovery(win, "overlay");
    this.overlayWindow = win;
    return win;
  }

  /**
   * Their persistent resting "flow bar": a 30×6 dash docked on a screen edge.
   * The window is a 56×56 invisible hit zone centered on the dash; the renderer
   * draws the dash and morphs it on hover. `edge: "none"` closes it.
   */
  applyStatusBar(edge: "none" | "left" | "right" | "bottom"): void {
    if (edge === "none") {
      if (this.statusWindow?.isDestroyed() === false) this.statusWindow.destroy();
      this.statusWindow = null;
      return;
    }
    if (this.statusWindow?.isDestroyed()) this.statusWindow = null;
    if (!this.statusWindow) {
      const win = new BrowserWindow({
        width: 56,
        height: 56,
        show: true,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        hasShadow: false,
        type: process.platform === "darwin" ? "panel" : "toolbar",
        fullscreenable: false,
        maximizable: false,
        minimizable: false,
        closable: false,
        resizable: false,
        movable: false,
        skipTaskbar: true,
        focusable: false,
        alwaysOnTop: true,
        webPreferences: {
          preload: this.opts.preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      win.setAlwaysOnTop(true, "screen-saver");
      // Click-through until the renderer reports the pointer is over the dash.
      win.setIgnoreMouseEvents(true, { forward: true });
      const target = this.opts.resolveRenderer("status");
      if (target) void win.loadURL(target);
      else void win.loadFile(join(__dirname, "../renderer/status.html"));
      win.webContents.on("did-finish-load", () => {
        if (!win.isDestroyed()) win.setIgnoreMouseEvents(true, { forward: true });
      });
      this.statusWindow = win;
    }
    this.dockStatusBar(this.statusWindow, edge);
    if (!this.statusWindow.isVisible()) this.statusWindow.showInactive();
  }

  /** Edge-anchors the status hit zone (flush to the edge, vertically centered). */
  private dockStatusBar(win: BrowserWindow, edge: "left" | "right" | "bottom"): void {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const w = 56;
    const h = 56;
    const bounds =
      edge === "left"
        ? { x: area.x + 2, y: area.y + Math.round((area.height - h) / 2), width: w, height: h }
        : edge === "right"
          ? { x: area.x + area.width - w - 2, y: area.y + Math.round((area.height - h) / 2), width: w, height: h }
          : { x: area.x + Math.round((area.width - w) / 2), y: area.y + area.height - h - 2, width: w, height: h };
    win.setBounds(bounds, false);
  }

  setStatusBarInteractive(interactive: boolean): void {
    const win = this.statusWindow;
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
  }
}
