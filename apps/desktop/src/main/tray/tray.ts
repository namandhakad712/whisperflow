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
  tray.setToolTip("WhisperFlow — hold nothing back");

  const rebuild = (launchAtLogin: boolean, recording: boolean) => {
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(launchAtLogin, recording, controller)));
  };
  rebuild(false, false);
  (tray as Tray & { refresh: (v: boolean, r?: boolean) => void }).refresh = (v, r) =>
    rebuild(v, r ?? controller.isRecording());
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
