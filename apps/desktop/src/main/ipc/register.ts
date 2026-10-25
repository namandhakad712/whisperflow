import { app, ipcMain } from "electron";
import type { EnginePort } from "../engine/enginePort";
import type { DictationController } from "../audio/dictationController";
import type { WindowManager } from "../windows/WindowManager";
import type { HotkeyManager } from "../hotkeys/hotkeys";
import type { Tray } from "electron";
import { applyLaunchAtLogin } from "../lifecycle/autostart";
import { log } from "../lib/log";

type TrayWithRefresh = Tray & { refresh?: (launchAtLogin: boolean) => void };

/**
 * Registers every IPC channel from docs/ARCHITECTURE.md. Channel names are
 * literals by design: shared/src/ipc.ts is the canonical list; keeping them
 * literal here would surface drift loudly in review.
 */
export function registerIpc(deps: {
  engine: EnginePort;
  controller: DictationController;
  windows: WindowManager;
  hotkeys: HotkeyManager;
  tray: TrayWithRefresh;
  onQuit(): void;
}): void {
  const { engine, controller, windows, hotkeys } = deps;

  // ---- dictation -----------------------------------------------------------
  ipcMain.handle("dictation/toggle", () => {
    void controller.toggle();
    return { ok: true };
  });
  ipcMain.handle("dictation/start", () => {
    void controller.start();
    return { ok: true };
  });
  ipcMain.handle("dictation/stop", () => {
    void controller.finish();
    return { ok: true };
  });
  ipcMain.handle("dictation/cancel", () => {
    controller.cancel();
    return { ok: true };
  });
  ipcMain.on("capture/pcm", (event, chunk: Float32Array) => {
    if (!(event.sender === windows.overlayWeb()) || !(chunk instanceof Float32Array)) return;
    controller.feed(chunk);
  });

  // ---- settings & config-backed collections --------------------------------
  ipcMain.handle("settings/get", () => engine.getConfig());
  ipcMain.handle("settings/set", (_e, patch: Record<string, unknown>) => engine.setConfig(patch ?? {}));

  const collection = <T extends { id: string }>(key: "dictionary" | "commands") => ({
    list: () => engine.getConfig().then((c) => (c[key] ?? []) as T[]),
    add: async (item: T) => {
      const c = await engine.getConfig();
      const next = [...((c[key] ?? []) as T[]), item];
      return engine.setConfig({ [key]: next }) as Promise<{ dictionary?: T[]; commands?: T[] }>;
    },
    update: async (item: T) => {
      const c = await engine.getConfig();
      const next = ((c[key] ?? []) as T[]).map((x) => (x.id === item.id ? item : x));
      return engine.setConfig({ [key]: next }) as Promise<{ dictionary?: T[]; commands?: T[] }>;
    },
    delete: async (id: string) => {
      const c = await engine.getConfig();
      const next = ((c[key] ?? []) as T[]).filter((x) => x.id !== id);
      return engine.setConfig({ [key]: next }) as Promise<{ dictionary?: T[]; commands?: T[] }>;
    },
  });
  const dictionary = collection<{ id: string; term: string; pronunciation?: string; hint?: string }>("dictionary");
  const commands = collection<{ id: string; phrase: string; action: "undo" | "insert" | "replace"; payload?: string }>("commands");

  ipcMain.handle("dictionary/list", () => dictionary.list());
  ipcMain.handle("dictionary/add", (_e, item) => dictionary.add(item));
  ipcMain.handle("dictionary/update", (_e, item) => dictionary.update(item));
  ipcMain.handle("dictionary/delete", (_e, id: string) => dictionary.delete(id));

  ipcMain.handle("commands/list", () => commands.list());
  ipcMain.handle("commands/add", (_e, item) => commands.add(item));
  ipcMain.handle("commands/update", (_e, item) => commands.update(item));
  ipcMain.handle("commands/delete", (_e, id: string) => commands.delete(id));

  // ---- history --------------------------------------------------------------
  ipcMain.handle("history/list", (_e, opts?: { query?: string; limit?: number }) =>
    engine.listHistory(opts?.query, opts?.limit ?? 200),
  );
  ipcMain.handle("history/delete", (_e, id: string) => engine.deleteHistory(id));
  ipcMain.handle("history/clear", () => engine.clearHistory());

  // ---- models ----------------------------------------------------------------
  ipcMain.handle("models/catalog", () => engine.modelCatalog());
  ipcMain.handle("models/download", (_e, id: string) =>
    engine.downloadModel(id, (p) => windows.sendToSettings("models/progress", p)),
  );
  ipcMain.handle("models/delete", (_e, id: string) => engine.deleteModel(id));
  ipcMain.handle("models/setActive", (_e, role: "stt" | "polish", id: string) => engine.setActiveModel(role, id));

  // ---- app lifecycle ----------------------------------------------------------
  ipcMain.handle("app/version", () => app.getVersion());
  ipcMain.handle("app/openSettings", (_e, route?: string) => {
    windows.createSettingsWindow(route ?? "");
    return { ok: true };
  });
  ipcMain.handle("app/quit", () => {
    deps.onQuit();
    return { ok: true };
  });
  ipcMain.handle("app/setLaunchAtLogin", (_e, enabled: boolean) => {
    applyLaunchAtLogin(enabled);
    deps.tray.refresh?.(enabled);
  });
  ipcMain.handle("app/rebindHotkey", (_e, accelerator: string) => {
    const ok = hotkeys.bindMain(accelerator);
    if (ok) void engine.setConfig({ hotkey: { pushToTalk: accelerator, toggleMode: true } });
    return { ok };
  });

  log("ipc: registered");
}
