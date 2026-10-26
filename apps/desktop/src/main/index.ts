import { app, session } from "electron";
import type { WhisperFlowConfig } from "@whisperflow/shared";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WindowManager } from "./windows/WindowManager";
import { createTray } from "./tray/tray";
import { HotkeyManager } from "./hotkeys/hotkeys";
import { DictationController } from "./audio/dictationController";
import { registerIpc } from "./ipc/register";
import { createEnginePort, resolveEngineDirs } from "./engine/enginePort";
import { HoldToTalkWatcher, hookAvailable, parseAccelerator, type KeyboardHookEvents } from "./hotkeys/holdToTalk";
import { applyLaunchAtLogin } from "./lifecycle/autostart";
import { initUpdater } from "./lifecycle/updater";
import { initLogging, log } from "./lib/log";

// Must precede anything that touches userData — this pins %APPDATA%/WhisperFlow.
app.setName("WhisperFlow");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let windowsRef: WindowManager | null = null;

function resolvePreloadPath(): string {
  const dir = join(__dirname, "../preload");
  for (const name of ["index.mjs", "index.js"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return join(dir, "index.mjs");
}

function resolveRenderer(page: "settings" | "overlay"): string | null {
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

  const windows = new WindowManager({ preloadPath: resolvePreloadPath(), resolveRenderer });
  windowsRef = windows;
  const hotkeys = new HotkeyManager({ onToggle: () => void controllerToggle(), onCancel: () => controllerCancel() });
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
  function controllerToggle(): void {
    void controller.toggle();
  }
  function controllerCancel(): void {
    controller.cancel();
  }

  const config = await engine.getConfig();
  applyLaunchAtLogin(config.general?.launchAtLogin === true);

  // Hold-to-talk: a global keyboard hook sees key-up, which globalShortcut
  // cannot. When armed it owns the main hotkey; otherwise the normal toggle
  // registration is used.
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

  const holdWanted = (cfg: WhisperFlowConfig) => Boolean(cfg.hotkey?.holdMode) && hookAvailable();
  function applyHotkeyConfig(cfg: WhisperFlowConfig): void {
    const accelerator = cfg.hotkey?.pushToTalk || "Control+Shift+Space";
    if (holdWanted(cfg)) {
      if (!holdWatcher || holdWatcher.accelerator !== accelerator) {
        holdWatcher?.stop();
        const parsed = parseAccelerator(accelerator);
        log(`hotkey: parsed "${accelerator}" main=${parsed.main} groups=${parsed.modifierGroups.map((g) => g.join("|")).join(",")}`);
        holdWatcher = new HoldToTalkWatcher(accelerator, holdEvents);
        holdWatcher.start();
        log(`hotkey: hold-to-talk armed (${accelerator}) via keyboard hook`);
      }
    } else if (holdWatcher) {
      holdWatcher.stop();
      holdWatcher = null;
      log("hotkey: hold-to-talk off — toggle mode");
    }
  }
  applyHotkeyConfig(config);

  const mainHotkey = config.hotkey?.pushToTalk || "Control+Shift+Space";
  if (!holdWanted(config)) {
    if (!hotkeys.bindMain(mainHotkey)) {
      log(`hotkey: "${mainHotkey}" is taken by another app — rebind in Settings → Shortcuts`);
    }
  }

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
  bootstrap().catch((err) => {
    log("fatal:", err);
    if (!app.isPackaged) console.error(err);
  });

  app.on("second-instance", () => {
    // A second launch focuses the settings window instead of starting a new process.
    windowsRef?.createSettingsWindow();
  });
});

app.on("window-all-closed", () => {
  // Tray-resident app: closing the settings window does not quit.
});

app.on("before-quit", () => {
  // best-effort cleanup; globalShortcut auto-unregisters on exit
});
