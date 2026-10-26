import { Menu, nativeImage, Tray } from "electron";
import { join } from "node:path";

export interface TrayController {
  toggleDictation(): void;
  toggleRecorder(): void;
  /** True while the recorder session is running — labels the tray item. */
  isRecording(): boolean;
  openSettings(route?: string): void;
  setLaunchAtLogin(enabled: boolean): void;
  checkForUpdates(): void;
  quit(): void;
}

export function createTray(controller: TrayController): Tray {
  const iconPath = join(__dirname, "../../resources/tray.png");
  const image = nativeImage.createFromPath(iconPath);
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);

  let launchAtLogin = false;
  let active = false;
  let recording = false;

  const tooltip = () =>
    recording
      ? "WhisperFlow — recording… (press the hotkey or the tray to stop)"
      : active
        ? "WhisperFlow — listening…"
        : "WhisperFlow — hold nothing back";

  const rebuild = () => {
    tray.setToolTip(tooltip());
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(launchAtLogin, recording, controller)));
  };
  rebuild();

  (tray as Tray & {
    refresh: (v: boolean) => void;
    setActivity: (a: boolean, r: boolean) => void;
  }).refresh = (v) => {
    launchAtLogin = v;
    rebuild();
  };
  (tray as Tray & { setActivity: (a: boolean, r: boolean) => void }).setActivity = (a, r) => {
    active = a;
    recording = r;
    rebuild();
  };

  tray.on("click", () => controller.openSettings());
  return tray;
}

function menuTemplate(
  launchAtLogin: boolean,
  recording: boolean,
  c: TrayController,
): Electron.MenuItemConstructorOptions[] {
  return [
    { label: "Dictate now", click: () => c.toggleDictation() },
    {
      label: recording ? "Stop recorder" : "Start recorder…",
      click: () => c.toggleRecorder(),
    },
    { type: "separator" },
    { label: "Settings", click: () => c.openSettings() },
    { label: "History", click: () => c.openSettings("/history") },
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
