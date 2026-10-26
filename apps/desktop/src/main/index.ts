import { app, session } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WindowManager } from "./windows/WindowManager";
import { createTray } from "./tray/tray";
import { HotkeyManager } from "./hotkeys/hotkeys";
import { DictationController } from "./audio/dictationController";
import { registerIpc } from "./ipc/register";
import { createEnginePort, resolveEngineDirs } from "./engine/enginePort";
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
  const controller = new DictationController({ engine, windows, hotkeys });
  function controllerToggle(): void {
    void controller.toggle();
  }
  function controllerCancel(): void {
    controller.cancel();
  }

  const config = await engine.getConfig();
  applyLaunchAtLogin(config.general?.launchAtLogin === true);

  const mainHotkey = config.hotkey?.pushToTalk || "Control+Shift+Space";
  if (!hotkeys.bindMain(mainHotkey)) {
    log(`hotkey: "${mainHotkey}" is taken by another app — rebind in Settings → Shortcuts`);
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
  }) as Electron.Tray & { refresh?: (v: boolean, r?: boolean) => void };

  registerIpc({ engine, controller, windows, hotkeys, tray, onQuit: () => app.quit() });

  initUpdater(log);

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
