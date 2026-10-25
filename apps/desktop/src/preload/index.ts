import { contextBridge, ipcRenderer } from "electron";

/**
 * The single typed bridge into main. Renderers never touch ipcRenderer directly.
 * Channel names mirror docs/ARCHITECTURE.md (canonical: packages/shared ipc.ts).
 */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  app: {
    version: () => ipcRenderer.invoke("app/version") as Promise<string>,
    openSettings: (route?: string) => ipcRenderer.invoke("app/openSettings", route) as Promise<{ ok: boolean }>,
    quit: () => ipcRenderer.invoke("app/quit") as Promise<{ ok: boolean }>,
    setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke("app/setLaunchAtLogin", enabled) as Promise<void>,
    rebindHotkey: (accelerator: string) => ipcRenderer.invoke("app/rebindHotkey", accelerator) as Promise<{ ok: boolean }>,
    onNavigate: (cb: (route: string) => void) => subscribe<string>("app/navigate", cb),
  },
  dictation: {
    toggle: () => ipcRenderer.invoke("dictation/toggle") as Promise<{ ok: boolean }>,
    start: () => ipcRenderer.invoke("dictation/start") as Promise<{ ok: boolean }>,
    stop: () => ipcRenderer.invoke("dictation/stop") as Promise<{ ok: boolean }>,
    cancel: () => ipcRenderer.invoke("dictation/cancel") as Promise<{ ok: boolean }>,
    onState: (cb: (ev: DictationStateEvent) => void) => subscribe<DictationStateEvent>("dictation/state", cb),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings/get") as Promise<Record<string, unknown>>,
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke("settings/set", patch) as Promise<Record<string, unknown>>,
  },
  history: {
    list: (opts?: { query?: string; limit?: number }) =>
      ipcRenderer.invoke("history/list", opts) as Promise<unknown[]>,
    delete: (id: string) => ipcRenderer.invoke("history/delete", id) as Promise<void>,
    clear: () => ipcRenderer.invoke("history/clear") as Promise<void>,
  },
  dictionary: {
    list: () => ipcRenderer.invoke("dictionary/list") as Promise<DictionaryEntry[]>,
    add: (item: DictionaryEntry) => ipcRenderer.invoke("dictionary/add", item) as Promise<unknown>,
    update: (item: DictionaryEntry) => ipcRenderer.invoke("dictionary/update", item) as Promise<unknown>,
    delete: (id: string) => ipcRenderer.invoke("dictionary/delete", id) as Promise<unknown>,
  },
  commands: {
    list: () => ipcRenderer.invoke("commands/list") as Promise<VoiceCommand[]>,
    add: (item: VoiceCommand) => ipcRenderer.invoke("commands/add", item) as Promise<unknown>,
    update: (item: VoiceCommand) => ipcRenderer.invoke("commands/update", item) as Promise<unknown>,
    delete: (id: string) => ipcRenderer.invoke("commands/delete", id) as Promise<unknown>,
  },
  models: {
    catalog: () => ipcRenderer.invoke("models/catalog") as Promise<unknown[]>,
    download: (id: string) => ipcRenderer.invoke("models/download", id) as Promise<void>,
    delete: (id: string) => ipcRenderer.invoke("models/delete", id) as Promise<void>,
    setActive: (role: "stt" | "polish", id: string) => ipcRenderer.invoke("models/setActive", role, id) as Promise<unknown>,
    onProgress: (cb: (p: ModelDownloadProgress) => void) => subscribe<ModelDownloadProgress>("models/progress", cb),
  },
  capture: {
    /** 16 kHz mono Float32 PCM chunk from the overlay's AudioWorklet. */
    sendPcm: (chunk: Float32Array) => ipcRenderer.send("capture/pcm", chunk),
  },
};

export type PreloadApi = typeof api;

contextBridge.exposeInMainWorld("whisperflow", api);

// ---- shapes (kept local + structural; canonical types live in @whisperflow/shared)
export interface DictationStateEvent {
  state: "idle" | "listening" | "transcribing" | "polishing" | "injecting" | "done" | "cancelled" | "error";
  partial?: string;
  error?: string;
}
export interface DictionaryEntry {
  id: string;
  term: string;
  pronunciation?: string;
  hint?: string;
}
export interface VoiceCommand {
  id: string;
  phrase: string;
  action: "undo" | "insert" | "replace";
  payload?: string;
}
export interface ModelDownloadProgress {
  id: string;
  receivedBytes: number;
  totalBytes: number;
  done: boolean;
  error?: string;
}
