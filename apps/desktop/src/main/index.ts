import { app, nativeTheme, session } from "electron";
import type { WhisperFlowConfig } from "@whisperflow/shared";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WindowManager } from "./windows/WindowManager";
import { createTray, trayUsable } from "./tray/tray";
import { HotkeyManager } from "./hotkeys/hotkeys";
import { DictationController } from "./audio/dictationController";
import { registerIpc } from "./ipc/register";
import { createEnginePort, resolveEngineDirs } from "./engine/enginePort";
import { copyFocusedSelection } from "./injection/windowsInjector";
import { HoldToTalkWatcher, hookAvailable, parseAccelerator, type KeyboardHookEvents } from "./hotkeys/holdToTalk";
import { applyLaunchAtLogin } from "./lifecycle/autostart";
import { initUpdater } from "./lifecycle/updater";
import { runDailyBackup } from "./lifecycle/backup";
import { initLogging, log } from "./lib/log";

// Must precede anything that touches userData — this pins %APPDATA%/WhisperFlow.
app.setName("WhisperFlow");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance owns the app: quit immediately and do NOT bootstrap.
  app.quit();
}
/** A second launch that arrived before bootstrap finished. */
let pendingShow = false;

let windowsRef: WindowManager | null = null;

function resolvePreloadPath(): string {
  const dir = join(__dirname, "../preload");
  for (const name of ["index.mjs", "index.js"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return join(dir, "index.mjs");
}

function resolveRenderer(page: "settings" | "overlay" | "status" | "lens"): string | null {
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  return devUrl ? `${devUrl}/${page}.html` : null;
}

async function bootstrap(): Promise<void> {
  initLogging(join(app.getPath("userData"), "logs"));
  log(`WhisperFlow ${app.getVersion()} starting (packaged: ${app.isPackaged})`);

  // Mic permission for our own pages only.
  const allow = new Set(["media"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(allow.has(permission));
  });

  const engine = await createEnginePort(resolveEngineDirs(app.getPath("userData")));
  // One local backup per day of config + history (kept 7 days), like the app
  // this is modelled on — a bad write should never cost the user their data.
  runDailyBackup(app.getPath("userData"));

  // The controller is created after the windows (it needs the manager), so the
  // busy signal reaches WindowManager through this late-bound handle.
  const busyRef: { fn?: () => boolean } = {};
  // Live config snapshot (set once the config loads below; refreshed by
  // onConfigChanged) so the free-float providers read the freshest position.
  let liveConfig: WhisperFlowConfig | null = null;
  // Debounced persistence of dragged pill positions.
  let posTimer: NodeJS.Timeout | null = null;
  const persistPos = (patch: Record<string, unknown>): void => {
    if (posTimer) clearTimeout(posTimer);
    posTimer = setTimeout(() => {
      posTimer = null;
      void engine.setConfig(patch as Parameters<typeof engine.setConfig>[0]).catch(() => {});
    }, 600);
  };

  const windows = new WindowManager({
    preloadPath: resolvePreloadPath(),
    resolveRenderer,
    isDictationBusy: () => busyRef.fn?.() ?? false,
    freePosProvider: () => liveConfig?.general?.overlayFreePos ?? null,
    onOverlayMoved: ({ x, y }) => {
      // Dragging the pill makes the free-float position authoritative.
      if (liveConfig) {
        liveConfig = { ...liveConfig, general: { ...liveConfig.general, overlayPosition: "free", overlayFreePos: { x, y } } };
      }
      persistPos({ general: { overlayPosition: "free", overlayFreePos: { x, y } } });
    },
    onStatusMoved: ({ x, y }) => {
      if (liveConfig) {
        liveConfig = { ...liveConfig, general: { ...liveConfig.general, statusFreePos: { x, y } } };
      }
      persistPos({ general: { statusFreePos: { x, y } } });
    },
  });
  windowsRef = windows;
  const hotkeys = new HotkeyManager({
    onToggle: () => void controllerToggle(),
    onCancel: () => controllerCancel(),
    onPasteLast: () => void controllerPasteLast(),
    onCopyLast: () => void controllerCopyLast(),
    onLens: () => void controllerLens(),
  });
  // The controller is created before the tray; it reaches the tray through this
  // late-bound handle (both sides only call each other after bootstrap).
  const trayHandle: { setActivity?: (active: boolean, recording: boolean) => void } = {};
  const controller = new DictationController({
    engine,
    windows,
    hotkeys,
    onActivity: (active, recording) => {
      trayHandle.setActivity?.(active, recording);
      holdWatcher?.setArmed(active); // typing detection runs only mid-dictation
    },
  });
  busyRef.fn = () => controller.busy;
  function controllerToggle(): void {
    void controller.toggle();
  }
  function controllerCancel(): void {
    controller.cancel();
  }
  function controllerPasteLast(): void {
    void controller.pasteLast();
  }
  function controllerCopyLast(): void {
    void controller.copyLast();
  }
  /** Their `lens` action: copy the current selection → open the AI edit bar. */
  async function controllerLens(): Promise<void> {
    try {
      const text = await copyFocusedSelection();
      if (!text.trim()) {
        log("lens: nothing selected — nothing to edit");
        return;
      }
      windows.openLensWithSelection(text.trim());
    } catch (err) {
      log("lens: selection read failed:", String(err).slice(0, 140));
    }
  }

  const config = await engine.getConfig();
  applyLaunchAtLogin(config.general?.launchAtLogin === true);

  // Hold-to-talk: a global keyboard hook sees key-up, which globalShortcut
  // cannot. When armed it owns the main hotkey; otherwise the normal toggle
  // registration is used. `hotkey.mode` is the single source of truth — the
  // legacy holdMode/toggleMode flags are derived from it in the shared schema.
  let holdWatcher: HoldToTalkWatcher | null = null;
  const holdEvents: KeyboardHookEvents = {
    onHoldStart: () => void controller.start(),
    onHoldEnd: () => void controller.finish(),
    onTyping: () => {
      log("hotkey: typing detected — holding the session open");
      windows.sendToOverlay("dictation/state", { state: "listening", typing: true });
    },
    onFirstKey: (keycode) => log(`hotkey: hook is live — first keycode ${keycode}`),
  };

  const holdWanted = (cfg: WhisperFlowConfig) => cfg.hotkey?.mode === "hold" && hookAvailable();
  function applyHotkeyConfig(cfg: WhisperFlowConfig): void {
    const accelerator = cfg.hotkey?.pushToTalk || "Control+Shift+Space";
    if (holdWanted(cfg)) {
      // Hold mode owns the accelerator: the global shortcut MUST be unbound,
      // or pressing it fires both paths — a double-trigger that starts two
      // dictations back-to-back (seen in the wild as paired
      // "dictation: started" log lines 200 ms apart).
      hotkeys.unbindMain();
      if (!holdWatcher || holdWatcher.accelerator !== accelerator) {
        holdWatcher?.stop();
        const parsed = parseAccelerator(accelerator);
        log(`hotkey: parsed "${accelerator}" main=${parsed.main} groups=${parsed.modifierGroups.map((g) => g.join("|")).join(",")}`);
        holdWatcher = new HoldToTalkWatcher(accelerator, holdEvents);
        holdWatcher.start();
        log(`hotkey: hold-to-talk armed (${accelerator}) via keyboard hook`);
      }
    } else {
      if (holdWatcher) {
        holdWatcher.stop();
        holdWatcher = null;
        log("hotkey: hold-to-talk off — toggle mode");
      }
      if (!hotkeys.bindMain(accelerator)) {
        log(`hotkey: "${accelerator}" is taken by another app — rebind in Settings → Shortcuts`);
      }
    }
    // Re-apply their per-action shortcuts on every settings change.
    hotkeys.bindActions(cfg.hotkey?.shortcuts ?? {});
  }
  applyHotkeyConfig(config);
  liveConfig = config;

  // Their per-action shortcuts (paste_last / copy_last) register whenever the
  // hotkey config is applied; bindActions is idempotent.
  const shortcutResult = hotkeys.bindActions(config.hotkey?.shortcuts ?? {});
  if (!shortcutResult.ok) {
    log(`hotkey: "${shortcutResult.failed}" shortcut is taken by another app — rebind in Settings → Shortcuts`);
  }

  // Their persistent resting "flow bar" — the 30×6 dash docked on a screen
  // edge. Off by default (their `hideFlowBarPermanently` equivalent).
  windows.applyStatusBar(config.general?.dockEdge ?? "none");

  // OS theme: push the real light/dark signal to the overlay (the renderer's
  // matchMedia follows Chromium's notion, which lags the OS in Electron).
  const pushTheme = () => windows.sendToOverlay("system/theme", { dark: nativeTheme.shouldUseDarkColors });
  pushTheme();
  nativeTheme.on("updated", pushTheme);

  const tray = createTray({
    toggleDictation: () => void controller.toggle(),
    toggleRecorder: () => {
      if (controller.active && controller.isRecording) void controller.finish();
      else void controller.start({ recorder: true });
    },
    isRecording: () => controller.isRecording,
    openSettings: (route) => windows.createSettingsWindow(route ?? ""),
    setLaunchAtLogin: (enabled) => {
      applyLaunchAtLogin(enabled);
      void engine.setConfig({ general: { ...config.general, launchAtLogin: enabled } });
    },
    checkForUpdates: () => log("updater: manual check requested"),
    quit: () => app.quit(),
  }) as Electron.Tray & {
    refresh?: (v: boolean) => void;
    setActivity?: (active: boolean, recording: boolean) => void;
  };
  trayHandle.setActivity = (active, recording) => tray.setActivity?.(active, recording);

  registerIpc({
    engine,
    controller,
    windows,
    hotkeys,
    tray,
    onQuit: () => app.quit(),
    onConfigChanged: () => {
      void engine.getConfig().then((cfg) => {
        liveConfig = cfg;
        applyHotkeyConfig(cfg);
        const accelerator = cfg.hotkey?.pushToTalk || "Control+Shift+Space";
        if (!holdWanted(cfg) && hotkeys.current !== accelerator) hotkeys.bindMain(accelerator);
      });
    },
  });

  initUpdater(log, {
    getConfig: () => engine.getConfig(),
    send: (status) => windows.sendToSettings("update/status", status),
  });

  if (!process.argv.includes("--hidden")) {
    windows.createSettingsWindow();
  }
}

app.whenReady().then(() => {
  if (!gotLock) return; // the second instance must never bootstrap
  bootstrap()
    .then(() => {
      if (pendingShow) {
        pendingShow = false;
        windowsRef?.createSettingsWindow();
      }
    })
    .catch((err) => {
      log("fatal:", err);
      if (!app.isPackaged) console.error(err);
    });

  app.on("second-instance", () => {
    // Opening the app again must always surface a window — even if it is
    // still booting, or the user closed the window and the app is tray-only.
    if (windowsRef) windowsRef.createSettingsWindow();
    else pendingShow = true;
  });
});

app.on("window-all-closed", () => {
  // Tray-resident app: closing the settings window does not quit — unless the
  // tray is unusable, in which case quitting is the only way the user can tell
  // the app is gone instead of invisible.
  if (!trayUsable) app.quit();
});

// Clicking the task-bar / dock icon while the window is hidden re-opens it.
app.on("activate", () => windowsRef?.createSettingsWindow());

app.on("before-quit", () => {
  // best-effort cleanup; globalShortcut auto-unregisters on exit
});
