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
  app: {
    openSettings: (request) => ipcRenderer.invoke(IPC.AppOpenSettings, request),
    quit: () => ipcRenderer.invoke(IPC.AppQuit),
    version: () => ipcRenderer.invoke(IPC.AppVersion),
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
  app: {
    setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke("app/setLaunchAtLogin", enabled),
    rebindHotkey: (accelerator: string) => ipcRenderer.invoke("app/rebindHotkey", accelerator),
    onNavigate: (cb: (route: string) => void) => subscribe<string>("app/navigate", cb),
  },
};
contextBridge.exposeInMainWorld("whisperflowExtras", extras);
export type Extras = typeof extras;
