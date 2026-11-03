import { Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";
import { log } from "../lib/log";

export interface TraySttModel {
  id: string;
  name: string;
  /** Active STT model right now. */
  active: boolean;
  /** On disk and ready — not-downloaded entries are listed but disabled. */
  downloaded: boolean;
}

export interface TrayController {
  toggleDictation(): void;
  toggleRecorder(): void;
  /** True while the recorder session is running — labels the tray item. */
  isRecording(): boolean;
  openSettings(route?: string): void;
  setLaunchAtLogin(enabled: boolean): void;
  checkForUpdates(): void;
  quit(): void;
  /** Switch the active STT model from the tray submenu (optional). */
  setSttModel?(id: string): Promise<void>;
}

/** True when the tray icon could be created with a real (non-empty) image. */
export let trayUsable = false;

export function createTray(controller: TrayController): Tray {
  const iconPath = join(__dirname, "../../resources/tray.png");
  const fallbackPath = join(__dirname, "../../resources/icon.png");
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    log(`tray: tray.png not found or unreadable at ${iconPath} — trying icon.png`);
    image = nativeImage.createFromPath(fallbackPath);
  }
  if (image.isEmpty()) log("tray: no usable icon image — the tray icon will be invisible");
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  trayUsable = !image.isEmpty();
  log(
    trayUsable
      ? "tray: created (right-click for the menu, click to open Settings)"
      : "tray: created with an EMPTY image — icon will not be visible",
  );

  let launchAtLogin = false;
  let active = false;
  let recording = false;
  /** STT models for the "Model" submenu (set by main once status is known). */
  let sttModels: TraySttModel[] = [];

  const tooltip = () =>
    recording
      ? "WhisperFlow — recording… (press the hotkey or the tray to stop)"
      : active
        ? "WhisperFlow — listening…"
        : "WhisperFlow — press the hotkey to dictate";

  const rebuild = () => {
    tray.setToolTip(tooltip());
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(launchAtLogin, recording, sttModels, controller)));
  };
  rebuild();

  (tray as Tray & {
    refresh: (v: boolean) => void;
    setActivity: (a: boolean, r: boolean) => void;
    setModels: (m: TraySttModel[]) => void;
  }).refresh = (v) => {
    launchAtLogin = v;
    rebuild();
  };
  (tray as Tray & { setActivity: (a: boolean, r: boolean) => void }).setActivity = (a, r) => {
    active = a;
    recording = r;
    rebuild();
  };
  (tray as Tray & { setModels: (m: TraySttModel[]) => void }).setModels = (m) => {
    sttModels = m;
    rebuild();
  };

  tray.on("click", () => controller.openSettings());
  return tray;
}

function menuTemplate(
  launchAtLogin: boolean,
  recording: boolean,
  sttModels: TraySttModel[],
  c: TrayController,
): Electron.MenuItemConstructorOptions[] {
  // One-click model switch from the tray — no Settings round-trip (the same
  // affordance Hex ships from their menu bar).
  const modelItems: Electron.MenuItemConstructorOptions[] =
    sttModels.length === 0
      ? [{ label: "Loading…", enabled: false }]
      : sttModels.map((m) => ({
          label: m.name,
          type: "radio",
          checked: m.active,
          enabled: m.downloaded,
          click: () => {
            if (!m.active) void c.setSttModel?.(m.id);
          },
        }));

  return [
    { label: "Dictate now", click: () => c.toggleDictation() },
    {
      label: recording ? "Stop recorder" : "Start recorder…",
      click: () => c.toggleRecorder(),
    },
    { type: "separator" },
    { label: "Settings", click: () => c.openSettings() },
    { label: "History", click: () => c.openSettings("/history") },
    { label: "Model", submenu: modelItems },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: launchAtLogin,
      click: (item) => c.setLaunchAtLogin(item.checked),
    },
    { label: "Check for updates…", click: () => c.checkForUpdates() },
    { type: "separator" },
    { label: "Quit WhisperFlow", click: () => c.quit() },
  ];
}
