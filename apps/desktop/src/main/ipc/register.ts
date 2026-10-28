import { app, dialog, ipcMain, shell, type Tray } from "electron";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { IPC, type AppPickFileRequest, type DictionaryEntry, type TranscriptItem, type VoiceCommand } from "@whisperflow/shared";
import type { EnginePort } from "../engine/enginePort";
import type { DictationController } from "../audio/dictationController";
import type { WindowManager } from "../windows/WindowManager";
import type { HotkeyManager } from "../hotkeys/hotkeys";
import { applyLaunchAtLogin } from "../lifecycle/autostart";
import { checkForUpdatesNow, installDownloadedUpdate } from "../lifecycle/updater";
import { hookAvailable, hookUnavailableReason } from "../hotkeys/holdToTalk";
import { log } from "../lib/log";

type TrayWithRefresh = Tray & { refresh?: (launchAtLogin: boolean) => void };

/**
 * Registers every IPC channel from the contract (packages/shared ipc.ts).
 * Handlers speak the shared request/response shapes verbatim.
 */
export function registerIpc(deps: {
  engine: EnginePort;
  controller: DictationController;
  windows: WindowManager;
  hotkeys: HotkeyManager;
  tray: TrayWithRefresh;
  /** Fired after every successful settings save — hotkey mode may need to change. */
  onConfigChanged(): void;
  onQuit(): void;
}): void {
  const { engine, controller, windows, hotkeys } = deps;

  // ---- dictation -----------------------------------------------------------
  ipcMain.handle(IPC.DictationToggle, () => {
    const started = !controller.active;
    void controller.toggle();
    return { started };
  });
  ipcMain.handle(IPC.DictationStart, () => {
    void controller.start();
  });
  ipcMain.handle(IPC.DictationStop, () => {
    void controller.finish();
  });
  ipcMain.handle("dictation/cancel", () => {
    controller.cancel();
    return { ok: true };
  });
  ipcMain.on(IPC.CapturePcm, (event, chunk: Float32Array) => {
    if (event.sender !== windows.overlayWeb() || !(chunk instanceof Float32Array)) return;
    controller.feed(chunk);
  });

  // ---- settings --------------------------------------------------------------
  ipcMain.handle(IPC.SettingsGet, () => engine.getConfig());
  ipcMain.handle(IPC.SettingsSet, async (_e, patch) => {
    const next = await engine.setConfig(patch ?? {});
    // Live windows (overlay) re-read config so shape/position/backdrop changes
    // apply without a relaunch; main re-evaluates hold-to-talk vs toggle.
    windows.sendToOverlay(IPC.SettingsChanged, null);
    deps.onConfigChanged();
    return next;
  });

  // ---- dictionary (id generation lives here; engine just persists config) ----
  ipcMain.handle(IPC.DictionaryList, () =>
    engine.getConfig().then((c) => c.dictionary as DictionaryEntry[]),
  );
  ipcMain.handle(IPC.DictionaryAdd, async (_e, req: { term: string; pronunciation?: string; hint?: string }) => {
    const entry: DictionaryEntry = {
      id: randomUUID(),
      term: req.term,
      ...(req.pronunciation ? { pronunciation: req.pronunciation } : {}),
      ...(req.hint ? { hint: req.hint } : {}),
    };
    const config = await engine.getConfig();
    await engine.setConfig({ dictionary: [...config.dictionary, entry] });
    return entry;
  });
  ipcMain.handle(IPC.DictionaryUpdate, async (_e, req: { id: string; term?: string; pronunciation?: string; hint?: string }) => {
    const config = await engine.getConfig();
    const next = config.dictionary.map((d): DictionaryEntry =>
      d.id === req.id
        ? {
            ...d,
            ...(req.term !== undefined ? { term: req.term } : {}),
            ...(req.pronunciation !== undefined ? { pronunciation: req.pronunciation } : {}),
            ...(req.hint !== undefined ? { hint: req.hint } : {}),
          }
        : d,
    );
    await engine.setConfig({ dictionary: next });
    return next.find((d) => d.id === req.id)!;
  });
  ipcMain.handle(IPC.DictionaryDelete, async (_e, req: { id: string }) => {
    const config = await engine.getConfig();
    await engine.setConfig({ dictionary: config.dictionary.filter((d) => d.id !== req.id) });
    return { deleted: true };
  });

  // ---- commands ----------------------------------------------------------------
  ipcMain.handle(IPC.CommandsList, () => engine.getConfig().then((c) => c.commands as VoiceCommand[]));
  ipcMain.handle(IPC.CommandsAdd, async (_e, req: { phrase: string; action: VoiceCommand["action"]; payload?: string }) => {
    const command: VoiceCommand = { id: randomUUID(), phrase: req.phrase, action: req.action, ...(req.payload ? { payload: req.payload } : {}) };
    const config = await engine.getConfig();
    await engine.setConfig({ commands: [...config.commands, command] });
    return command;
  });
  ipcMain.handle(IPC.CommandsUpdate, async (_e, req: { id: string; phrase?: string; action?: VoiceCommand["action"]; payload?: string }) => {
    const config = await engine.getConfig();
    const next = config.commands.map((c): VoiceCommand =>
      c.id === req.id
        ? {
            ...c,
            ...(req.phrase !== undefined ? { phrase: req.phrase } : {}),
            ...(req.action !== undefined ? { action: req.action } : {}),
            ...(req.payload !== undefined ? { payload: req.payload } : {}),
          }
        : c,
    );
    await engine.setConfig({ commands: next });
    return next.find((c) => c.id === req.id)!;
  });
  ipcMain.handle(IPC.CommandsDelete, async (_e, req: { id: string }) => {
    const config = await engine.getConfig();
    await engine.setConfig({ commands: config.commands.filter((c) => c.id !== req.id) });
    return { deleted: true };
  });

  // ---- history -------------------------------------------------------------------
  ipcMain.handle(IPC.HistoryList, (_e, req?: { query?: string; limit?: number }) => engine.listHistory(req));
  ipcMain.handle(IPC.HistoryDelete, async (_e, req: { id: string }) => ({ deleted: await engine.deleteHistory(req.id) }));
  ipcMain.handle(IPC.HistoryClear, async () => ({ cleared: await engine.clearHistory() }));

  // ---- models ---------------------------------------------------------------------
  ipcMain.handle(IPC.ModelsCatalog, () => engine.modelCatalog());
  ipcMain.handle(IPC.ModelsStatus, () => engine.modelStatus());
  ipcMain.handle(IPC.ModelsDownload, (_e, req: { id: string }) =>
    engine.downloadModel(req.id, (p) => windows.sendToSettings(IPC.ModelsProgress, p)),
  );
  ipcMain.handle(IPC.ModelsDelete, (_e, req: { id: string }) => engine.deleteModel(req.id));
  ipcMain.handle(IPC.ModelsSetActive, (_e, req: { role: "stt" | "polish"; id: string }) => engine.setActiveModel(req.role, req.id));
  ipcMain.handle(IPC.ModelsRecommend, () => engine.recommendModels());
  ipcMain.handle(IPC.ModelsDeleteUnused, () => engine.deleteUnusedModels());

  // ---- cloud STT (BYOK) -----------------------------------------------------------
  ipcMain.handle(IPC.SttTest, () => engine.testCloudStt());

  // ---- app lifecycle ----------------------------------------------------------------
  ipcMain.handle(IPC.AppVersion, () => app.getVersion());
  ipcMain.handle(IPC.AppOpenSettings, (_e, req?: { tab?: string }) => {
    windows.createSettingsWindow(req?.tab ? `/${req.tab}` : "");
  });
  ipcMain.handle(IPC.AppQuit, () => {
    deps.onQuit();
    return undefined;
  });
  ipcMain.handle("app/setLaunchAtLogin", (_e, enabled: boolean) => {
    applyLaunchAtLogin(enabled);
    deps.tray.refresh?.(enabled);
  });
  ipcMain.handle("app/checkForUpdates", async () => ({ message: await checkForUpdatesNow() }));
  ipcMain.handle("app/exportBackup", async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog({
      title: "Export WhisperFlow backup",
      defaultPath: `whisperflow-backup-${stamp}.json`,
      filters: [{ name: "WhisperFlow backup", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return { exported: false };
    const [config, history] = await Promise.all([engine.getConfig(), engine.listHistory({ limit: 500 })]);
    writeFileSync(
      result.filePath,
      JSON.stringify({ app: "WhisperFlow", version: app.getVersion(), exportedAt: Date.now(), config, history }, null, 2),
      "utf-8",
    );
    log("backup exported to", result.filePath);
    return { exported: true, path: result.filePath };
  });
  ipcMain.handle("app/rebindHotkey", (_e, accelerator: string) => {
    const ok = hotkeys.bindMain(accelerator);
    if (ok) void engine.setConfig({ hotkey: { pushToTalk: accelerator, toggleMode: true } });
    return { ok };
  });
  ipcMain.handle("app/rebindShortcut", async (_e, req: { action: "pasteLast" | "copyLast"; accelerator: string }) => {
    const ok = hotkeys.bindActions({ [req.action]: req.accelerator }).ok;
    if (ok) {
      const config = await engine.getConfig();
      await engine.setConfig({ hotkey: { shortcuts: { ...config.hotkey.shortcuts, [req.action]: req.accelerator } } });
    }
    return { ok };
  });
  ipcMain.handle("app/keyboardHookStatus", () => {
    // Hold-to-talk availability is reported honestly to the settings UI.
    return { available: hookAvailable(), reason: hookUnavailableReason() };
  });
  ipcMain.handle(IPC.AppHardware, async () => {
    const cpus = os.cpus();
    let gpu = "unknown";
    try {
      const info = (await app.getGPUInfo("basic")) as {
        auxAttributes?: Record<string, unknown>;
        gpuDevice?: Array<{ vendorString?: string }>;
      };
      gpu =
        (info.auxAttributes?.["vendor-string"] as string | undefined) ||
        info.gpuDevice?.[0]?.vendorString ||
        "unknown";
    } catch {
      gpu = "unavailable";
    }
    const totalMemGb = os.totalmem() / 1024 ** 3;
    const tier = totalMemGb < 8 ? "low" : totalMemGb < 17.2 ? "mid" : "high";
    return {
      cpu: cpus[0]?.model || "unknown",
      cores: cpus.length,
      totalMemGb: Math.round(totalMemGb * 10) / 10,
      tier,
      gpu,
    };
  });
  ipcMain.handle(IPC.AppOpenPath, async (_e, req: { path: string }) => {
    const result = await shell.openPath(req.path);
    return result ? { error: result } : undefined;
  });

  // ---- updates --------------------------------------------------------------------
  ipcMain.handle(IPC.AppQuitAndInstall, () => {
    installDownloadedUpdate();
  });

  // ---- diagnostics + file pickers + backup import ----------------------------------
  // The overlay renderer reports when the pointer is over a real control, so the
  // panel can stay click-through (never blocking the app underneath) otherwise.
  ipcMain.on("overlay/setInteractive", (_e, interactive: boolean) => {
    windows.setOverlayInteractive(Boolean(interactive));
  });
  ipcMain.handle(IPC.AppOpenLogsFolder, () => {
    void shell.openPath(join(app.getPath("userData"), "logs"));
  });
  ipcMain.handle(IPC.AppOpenConfigFolder, () => {
    void shell.openPath(app.getPath("userData"));
  });
  ipcMain.handle(IPC.AppPickFile, async (_e, req: AppPickFileRequest) => {
    const result = await dialog.showOpenDialog({
      title: req?.title ?? "Choose a file",
      properties: ["openFile"],
      ...(req?.filters?.length ? { filters: req.filters } : {}),
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const path = result.filePaths[0];
    if (req?.readText) {
      try {
        return { canceled: false, path, content: readFileSync(path, "utf-8") };
      } catch {
        return { canceled: false, path }; // unreadable: the caller decides
      }
    }
    return { canceled: false, path };
  });
  ipcMain.handle(IPC.AppPickFolder, async (_e, req: { title?: string }) => {
    const result = await dialog.showOpenDialog({
      title: req?.title ?? "Choose a folder",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, path: result.filePaths[0] };
  });
  ipcMain.handle(IPC.AppImportBackup, async (_e, req: { path: string }) => {
    try {
      const raw = JSON.parse(readFileSync(req.path, "utf-8")) as {
        app?: string;
        config?: unknown;
        history?: unknown;
      };
      if (raw.app !== "WhisperFlow" || !Array.isArray(raw.history)) {
        return { ok: false, message: "Not a WhisperFlow backup file." };
      }
      const items = raw.history.filter(
        (t): t is TranscriptItem => !!t && typeof (t as TranscriptItem).id === "string",
      );
      const { added } = await engine.importHistory(items);
      if (raw.config && typeof raw.config === "object") {
        await engine.setConfig(raw.config as Record<string, unknown>);
      }
      log(`backup imported: ${added} history entries from ${req.path}`);
      return { ok: true, addedHistory: added };
    } catch (err) {
      return { ok: false, message: String(err).slice(0, 140) };
    }
  });

  log("ipc: registered");
}
