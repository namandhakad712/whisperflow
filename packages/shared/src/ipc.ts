/**
 * THE IPC contract. Channel-name constants, request/response payload types for
 * every channel, and the typed `window.whisperflow` preload API surface.
 *
 * - `IPC.*` constants are the exact `ipcRenderer.invoke` / `webContents.send`
 *   channel strings. Emit-only channels are marked in `IPC_EMIT_CHANNELS`.
 * - `IpcInvokeMap` types the main-process handler table 1:1 with the channels.
 * - `WhisperflowApi` is the shape `contextBridge.exposeInMainWorld("whisperflow", …)`
 *   must produce. The renderer never touches `ipcRenderer` directly.
 */
import type { WhisperFlowConfig, WhisperFlowConfigPatch } from "./config.js";
import type { DictionaryEntry, HistoryQuery, TranscriptItem, VoiceCommand } from "./entities.js";
import type {
  ModelCatalogEntry,
  ModelDownloadProgress,
  ModelRole,
  ModelStatus,
} from "./models.js";
import type { DictationStateEvent } from "./events.js";

/** Every IPC channel name used between main, preload, and renderer. */
export const IPC = {
  DictationToggle: "dictation/toggle",
  DictationStart: "dictation/start",
  DictationStop: "dictation/stop",
  /** emit (main → renderer) */
  DictationState: "dictation/state",

  SettingsGet: "settings/get",
  SettingsSet: "settings/set",

  HistoryList: "history/list",
  HistoryDelete: "history/delete",
  HistoryClear: "history/clear",

  DictionaryList: "dictionary/list",
  DictionaryAdd: "dictionary/add",
  DictionaryUpdate: "dictionary/update",
  DictionaryDelete: "dictionary/delete",

  CommandsList: "commands/list",
  CommandsAdd: "commands/add",
  CommandsUpdate: "commands/update",
  CommandsDelete: "commands/delete",

  ModelsCatalog: "models/catalog",
  ModelsStatus: "models/status",
  ModelsDownload: "models/download",
  /** emit (main → renderer) */
  ModelsProgress: "models/progress",
  ModelsDelete: "models/delete",
  ModelsSetActive: "models/setActive",

  AudioDevices: "audio/devices",

  AppOpenSettings: "app/openSettings",
  AppQuit: "app/quit",
  AppVersion: "app/version",

  /** emit (renderer → main, transferable Float32Array chunks) */
  CapturePcm: "capture/pcm",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Channels that are event pushes, not invoke/request channels. */
export const IPC_EMIT_CHANNELS: readonly IpcChannel[] = [
  IPC.DictationState,
  IPC.ModelsProgress,
  IPC.CapturePcm,
];

/** Tabs of the settings window (used by `app/openSettings`). */
export type SettingsTab =
  | "general"
  | "shortcuts"
  | "audio"
  | "models"
  | "dictionary"
  | "commands"
  | "privacy"
  | "advanced"
  | "about";

/** Input device descriptor (renderer `mediaDevices.enumerateDevices` passthrough). */
export interface AudioDevice {
  deviceId: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Request / response payloads, grouped per channel family.
// ---------------------------------------------------------------------------

export type DictationToggleRequest = void;
export interface DictationToggleResponse {
  /** `true` when the toggle started a new dictation, `false` when it stopped one. */
  started: boolean;
}

export type DictationStartRequest = void;
export type DictationStartResponse = void;
export type DictationStopRequest = void;
export type DictationStopResponse = void;

export type DictationStateEmit = DictationStateEvent;

export type SettingsGetRequest = void;
export type SettingsGetResponse = WhisperFlowConfig;
export type SettingsSetRequest = WhisperFlowConfigPatch;
export type SettingsSetResponse = WhisperFlowConfig;

export type HistoryListRequest = HistoryQuery;
export type HistoryListResponse = TranscriptItem[];
export interface HistoryDeleteRequest {
  id: string;
}
export interface HistoryDeleteResponse {
  deleted: boolean;
}
export type HistoryClearRequest = void;
export interface HistoryClearResponse {
  cleared: boolean;
}

export type DictionaryListRequest = void;
export type DictionaryListResponse = DictionaryEntry[];
export interface DictionaryAddRequest {
  term: string;
  pronunciation?: string;
  hint?: string;
}
export type DictionaryAddResponse = DictionaryEntry;
export interface DictionaryUpdateRequest {
  id: string;
  term?: string;
  pronunciation?: string;
  hint?: string;
}
export type DictionaryUpdateResponse = DictionaryEntry;
export interface DictionaryDeleteRequest {
  id: string;
}
export interface DictionaryDeleteResponse {
  deleted: boolean;
}

export type CommandsListRequest = void;
export type CommandsListResponse = VoiceCommand[];
export interface CommandsAddRequest {
  phrase: string;
  action: VoiceCommand["action"];
  payload?: string;
}
export type CommandsAddResponse = VoiceCommand;
export interface CommandsUpdateRequest {
  id: string;
  phrase?: string;
  action?: VoiceCommand["action"];
  payload?: string;
}
export type CommandsUpdateResponse = VoiceCommand;
export interface CommandsDeleteRequest {
  id: string;
}
export interface CommandsDeleteResponse {
  deleted: boolean;
}

export type ModelsCatalogRequest = void;
export type ModelsCatalogResponse = ModelCatalogEntry[];
export type ModelsStatusRequest = void;
export type ModelsStatusResponse = ModelStatus[];
export interface ModelsDownloadRequest {
  id: string;
}
export type ModelsDownloadResponse = void;
export type ModelsProgressEmit = ModelDownloadProgress;
export interface ModelsDeleteRequest {
  id: string;
}
export type ModelsDeleteResponse = void;
export interface ModelsSetActiveRequest {
  role: ModelRole;
  id: string;
}
export type ModelsSetActiveResponse = void;

export type AudioDevicesRequest = void;
export type AudioDevicesResponse = AudioDevice[];

export interface AppOpenSettingsRequest {
  tab?: SettingsTab;
}
export type AppOpenSettingsResponse = void;
export type AppQuitRequest = void;
export type AppQuitResponse = void;
export type AppVersionRequest = void;
export type AppVersionResponse = string;

/** Renderer → main PCM chunk (16 kHz mono after AudioWorklet resample). */
export interface CapturePcmRequest {
  chunk: Float32Array;
}
export type CapturePcmEmit = CapturePcmRequest;

// ---------------------------------------------------------------------------
// Typed channel → { request, response } map for main-process handler wiring.
// ---------------------------------------------------------------------------

/** One entry per invoke channel; lets the desktop host type its handler table. */
export interface IpcInvokeMap {
  [IPC.DictationToggle]: { request: DictationToggleRequest; response: DictationToggleResponse };
  [IPC.DictationStart]: { request: DictationStartRequest; response: DictationStartResponse };
  [IPC.DictationStop]: { request: DictationStopRequest; response: DictationStopResponse };
  [IPC.SettingsGet]: { request: SettingsGetRequest; response: SettingsGetResponse };
  [IPC.SettingsSet]: { request: SettingsSetRequest; response: SettingsSetResponse };
  [IPC.HistoryList]: { request: HistoryListRequest; response: HistoryListResponse };
  [IPC.HistoryDelete]: { request: HistoryDeleteRequest; response: HistoryDeleteResponse };
  [IPC.HistoryClear]: { request: HistoryClearRequest; response: HistoryClearResponse };
  [IPC.DictionaryList]: { request: DictionaryListRequest; response: DictionaryListResponse };
  [IPC.DictionaryAdd]: { request: DictionaryAddRequest; response: DictionaryAddResponse };
  [IPC.DictionaryUpdate]: { request: DictionaryUpdateRequest; response: DictionaryUpdateResponse };
  [IPC.DictionaryDelete]: { request: DictionaryDeleteRequest; response: DictionaryDeleteResponse };
  [IPC.CommandsList]: { request: CommandsListRequest; response: CommandsListResponse };
  [IPC.CommandsAdd]: { request: CommandsAddRequest; response: CommandsAddResponse };
  [IPC.CommandsUpdate]: { request: CommandsUpdateRequest; response: CommandsUpdateResponse };
  [IPC.CommandsDelete]: { request: CommandsDeleteRequest; response: CommandsDeleteResponse };
  [IPC.ModelsCatalog]: { request: ModelsCatalogRequest; response: ModelsCatalogResponse };
  [IPC.ModelsStatus]: { request: ModelsStatusRequest; response: ModelsStatusResponse };
  [IPC.ModelsDownload]: { request: ModelsDownloadRequest; response: ModelsDownloadResponse };
  [IPC.ModelsDelete]: { request: ModelsDeleteRequest; response: ModelsDeleteResponse };
  [IPC.ModelsSetActive]: { request: ModelsSetActiveRequest; response: ModelsSetActiveResponse };
  [IPC.AudioDevices]: { request: AudioDevicesRequest; response: AudioDevicesResponse };
  [IPC.AppOpenSettings]: { request: AppOpenSettingsRequest; response: AppOpenSettingsResponse };
  [IPC.AppQuit]: { request: AppQuitRequest; response: AppQuitResponse };
  [IPC.AppVersion]: { request: AppVersionRequest; response: AppVersionResponse };
}

/** Handler signature for an invoke channel. */
export type IpcHandler<C extends keyof IpcInvokeMap> = (
  request: IpcInvokeMap[C]["request"],
) => Promise<IpcInvokeMap[C]["response"]> | IpcInvokeMap[C]["response"];

// ---------------------------------------------------------------------------
// Preload API surface (window.whisperflow)
// ---------------------------------------------------------------------------

/** Unsubscribe function returned by every event subscription. */
export type Unsubscribe = () => void;

/**
 * The object exposed as `window.whisperflow` via `contextBridge`. Grouped by
 * domain; events use `on*` subscribe methods returning an `Unsubscribe`.
 */
export interface WhisperflowApi {
  dictation: {
    /** Toggle: start when idle, stop when active. Returns which happened. */
    toggle(): Promise<DictationToggleResponse>;
    start(): Promise<DictationStartResponse>;
    stop(): Promise<DictationStopResponse>;
    /** Live state + partial transcript stream for the overlay. */
    onState(listener: (event: DictationStateEmit) => void): Unsubscribe;
  };
  settings: {
    get(): Promise<SettingsGetResponse>;
    /** Deep-merge patch; throws a validation error on invalid input. */
    set(patch: SettingsSetRequest): Promise<SettingsSetResponse>;
  };
  history: {
    list(query?: HistoryListRequest): Promise<HistoryListResponse>;
    delete(request: HistoryDeleteRequest): Promise<HistoryDeleteResponse>;
    clear(): Promise<HistoryClearResponse>;
  };
  dictionary: {
    list(): Promise<DictionaryListResponse>;
    add(request: DictionaryAddRequest): Promise<DictionaryAddResponse>;
    update(request: DictionaryUpdateRequest): Promise<DictionaryUpdateResponse>;
    delete(request: DictionaryDeleteRequest): Promise<DictionaryDeleteResponse>;
  };
  commands: {
    list(): Promise<CommandsListResponse>;
    add(request: CommandsAddRequest): Promise<CommandsAddResponse>;
    update(request: CommandsUpdateRequest): Promise<CommandsUpdateResponse>;
    delete(request: CommandsDeleteRequest): Promise<CommandsDeleteResponse>;
  };
  models: {
    catalog(): Promise<ModelsCatalogResponse>;
    status(): Promise<ModelsStatusResponse>;
    /** Kicks off (or resumes) a download; progress arrives via `onProgress`. */
    download(request: ModelsDownloadRequest): Promise<ModelsDownloadResponse>;
    delete(request: ModelsDeleteRequest): Promise<ModelsDeleteResponse>;
    setActive(request: ModelsSetActiveRequest): Promise<ModelsSetActiveResponse>;
    onProgress(listener: (event: ModelsProgressEmit) => void): Unsubscribe;
  };
  audio: {
    devices(): Promise<AudioDevicesResponse>;
  };
  app: {
    openSettings(request?: AppOpenSettingsRequest): Promise<AppOpenSettingsResponse>;
    quit(): Promise<AppQuitResponse>;
    version(): Promise<AppVersionResponse>;
  };
  capture: {
    /** Sends one 16 kHz mono PCM chunk (renderer → main, transferable). */
    sendPcm(chunk: Float32Array): void;
  };
}
