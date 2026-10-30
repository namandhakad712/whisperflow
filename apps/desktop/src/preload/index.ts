import { contextBridge, ipcRenderer } from "electron";
import { IPC, type Unsubscribe, type WhisperflowApi } from "@whisperflow/shared";

/**
 * The single typed bridge into main — implements @whisperflow/shared's
 * WhisperflowApi verbatim. Renderers never touch ipcRenderer directly.
 */
function subscribe<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: WhisperflowApi = {
  dictation: {
    toggle: () => ipcRenderer.invoke(IPC.DictationToggle),
    start: () => ipcRenderer.invoke(IPC.DictationStart),
    stop: () => ipcRenderer.invoke(IPC.DictationStop),
    onState: (listener) => subscribe(IPC.DictationState, listener),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.SettingsGet),
    set: (patch) => ipcRenderer.invoke(IPC.SettingsSet, patch),
  },
  history: {
    list: (query) => ipcRenderer.invoke(IPC.HistoryList, query),
    delete: (request) => ipcRenderer.invoke(IPC.HistoryDelete, request),
    clear: () => ipcRenderer.invoke(IPC.HistoryClear),
  },
  dictionary: {
    list: () => ipcRenderer.invoke(IPC.DictionaryList),
    add: (request) => ipcRenderer.invoke(IPC.DictionaryAdd, request),
    update: (request) => ipcRenderer.invoke(IPC.DictionaryUpdate, request),
    delete: (request) => ipcRenderer.invoke(IPC.DictionaryDelete, request),
  },
  commands: {
    list: () => ipcRenderer.invoke(IPC.CommandsList),
    add: (request) => ipcRenderer.invoke(IPC.CommandsAdd, request),
    update: (request) => ipcRenderer.invoke(IPC.CommandsUpdate, request),
    delete: (request) => ipcRenderer.invoke(IPC.CommandsDelete, request),
  },
  models: {
    catalog: () => ipcRenderer.invoke(IPC.ModelsCatalog),
    status: () => ipcRenderer.invoke(IPC.ModelsStatus),
    download: (request) => ipcRenderer.invoke(IPC.ModelsDownload, request),
    delete: (request) => ipcRenderer.invoke(IPC.ModelsDelete, request),
    setActive: (request) => ipcRenderer.invoke(IPC.ModelsSetActive, request),
    recommend: () => ipcRenderer.invoke(IPC.ModelsRecommend),
    deleteUnused: () => ipcRenderer.invoke(IPC.ModelsDeleteUnused),
    onProgress: (listener) => subscribe(IPC.ModelsProgress, listener),
  },
  audio: {
    // Runs in the renderer world where mediaDevices lives — no IPC needed.
    devices: async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));
    },
  },
  stt: {
    test: () => ipcRenderer.invoke(IPC.SttTest),
  },
  app: {
    openSettings: (request) => ipcRenderer.invoke(IPC.AppOpenSettings, request),
    quit: () => ipcRenderer.invoke(IPC.AppQuit),
    version: () => ipcRenderer.invoke(IPC.AppVersion),
    hardware: () => ipcRenderer.invoke(IPC.AppHardware),
    openPath: (request) => ipcRenderer.invoke(IPC.AppOpenPath, request),
    quitAndInstall: () => ipcRenderer.invoke(IPC.AppQuitAndInstall),
    openLogsFolder: () => ipcRenderer.invoke(IPC.AppOpenLogsFolder),
    openConfigFolder: () => ipcRenderer.invoke(IPC.AppOpenConfigFolder),
    pickFile: (request) => ipcRenderer.invoke(IPC.AppPickFile, request ?? {}),
    pickFolder: (request) => ipcRenderer.invoke(IPC.AppPickFolder, request ?? {}),
    importBackup: (request) => ipcRenderer.invoke(IPC.AppImportBackup, request),
  },
  updates: {
    onStatus: (listener) => subscribe(IPC.UpdateStatus, listener),
  },
  capture: {
    /** 16 kHz mono Float32 PCM chunk from the overlay's AudioWorklet. */
    sendPcm: (chunk) => ipcRenderer.send(IPC.CapturePcm, chunk),
  },
};

contextBridge.exposeInMainWorld("whisperflow", api);

// Non-contract extras (cancel button on the overlay, tray-driven actions).
const extras = {
  dictation: {
    cancel: () => ipcRenderer.invoke("dictation/cancel"),
  },
  status: {
    setInteractive: (interactive: boolean) => ipcRenderer.send("status/setInteractive", interactive),
    click: () => ipcRenderer.invoke("status/click"),
    contextMenu: () => ipcRenderer.invoke("status/contextMenu"),
  },
  lens: {
    submit: (instruction: string) => ipcRenderer.invoke("lens/submit", instruction),
    dismiss: () => ipcRenderer.invoke("lens/dismiss"),
    onText: (cb: (ev: { text: string }) => void) => subscribe("lens/text", cb),
  },
  system: {
    theme: () => ipcRenderer.invoke("system/theme/get") as Promise<{ dark: boolean }>,
    onTheme: (cb: (ev: { dark: boolean }) => void) => subscribe("system/theme", cb),
  },
  app: {
    setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke("app/setLaunchAtLogin", enabled),
    rebindHotkey: (accelerator: string) => ipcRenderer.invoke("app/rebindHotkey", accelerator),
    rebindShortcut: (action: "pasteLast" | "copyLast" | "lens", accelerator: string) =>
      ipcRenderer.invoke("app/rebindShortcut", { action, accelerator }),
    checkForUpdates: () => ipcRenderer.invoke("app/checkForUpdates") as Promise<{ message: string }>,
    exportBackup: () => ipcRenderer.invoke("app/exportBackup") as Promise<{ exported: boolean; path?: string }>,
    onNavigate: (cb: (route: string) => void) => subscribe<string>("app/navigate", cb),
    keyboardHookStatus: () =>
      ipcRenderer.invoke("app/keyboardHookStatus") as Promise<{ available: boolean; reason?: string }>,
    testCloudPolish: () =>
      ipcRenderer.invoke("app/testCloudPolish") as Promise<{ ok: boolean; message: string }>,
  },
  settings: {
    /** Fired after every settings/set — lets live windows re-read config. */
    onChanged: (cb: () => void) => subscribe(IPC.SettingsChanged, cb),
  },
  overlay: {
    /** Tell main whether the pointer is over a control (drives click-through). */
    setInteractive: (interactive: boolean) => ipcRenderer.send("overlay/setInteractive", interactive),
    /** Which edge the overlay hangs from (top anchors grow downward). */
    onAlign: (cb: (ev: { edge: "top" | "bottom" }) => void) => subscribe("overlay/align", cb),
  },
};
contextBridge.exposeInMainWorld("whisperflowExtras", extras);
export type Extras = typeof extras;
