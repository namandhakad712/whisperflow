import { create } from "zustand";
import type {
  AppHardwareResponse,
  AudioDevice,
  CustomModelEntry,
  DictionaryEntry,
  ModelCatalogEntry,
  ModelDownloadProgress,
  ModelStatus,
  TierRecommendation,
  TranscriptItem,
  VoiceCommand,
  WhisperFlowConfig,
  WhisperFlowConfigPatch,
} from "@whisperflow/shared";

interface SettingsState {
  config: WhisperFlowConfig | null;
  devices: AudioDevice[];
  history: TranscriptItem[];
  catalog: readonly ModelCatalogEntry[];
  statuses: ModelStatus[];
  progress: Record<string, ModelDownloadProgress>;
  activeDictation: boolean;
  hardware: AppHardwareResponse | null;
  recommendation: TierRecommendation | null;

  loadConfig(): Promise<void>;
  patchConfig(patch: WhisperFlowConfigPatch): Promise<void>;
  loadDevices(): Promise<void>;
  loadHistory(query?: string): Promise<void>;
  loadModels(): Promise<void>;
  loadHardware(): Promise<void>;
  bindProgress(): () => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  config: null,
  devices: [],
  history: [],
  catalog: [],
  statuses: [],
  progress: {},
  activeDictation: false,
  hardware: null,
  recommendation: null,

  async loadConfig() {
    const config = await window.whisperflow.settings.get();
    set({ config });
  },

  async patchConfig(patch) {
    const config = await window.whisperflow.settings.set(patch);
    set({ config });
  },

  async loadDevices() {
    try {
      const devices = await window.whisperflow.audio.devices();
      set({ devices });
    } catch {
      set({ devices: [] });
    }
  },

  async loadHistory(query) {
    const history = await window.whisperflow.history.list(query ? { query } : undefined);
    set({ history });
  },

  async loadModels() {
    const [catalog, statuses, recommendation] = await Promise.all([
      window.whisperflow.models.catalog(),
      window.whisperflow.models.status(),
      window.whisperflow.models.recommend().catch(() => null),
    ]);
    set({ catalog, statuses, recommendation });
  },

  async loadHardware() {
    try {
      const hardware = await window.whisperflow.app.hardware();
      set({ hardware });
    } catch {
      /* non-fatal: the page works without it */
    }
  },

  bindProgress() {
    return window.whisperflow.models.onProgress((p) => {
      set({ progress: { ...get().progress, [p.entryId]: p } });
      if (p.state === "done" || p.state === "error") {
        void get().loadModels().then(() => void get().loadConfig());
      }
    });
  },
}));

// ---- dictionary & command helpers (config-backed collections) ---------------

export async function addDictionaryEntry(term: string): Promise<void> {
  await window.whisperflow.dictionary.add({ term });
}

export async function removeDictionaryEntry(entry: DictionaryEntry): Promise<void> {
  await window.whisperflow.dictionary.delete({ id: entry.id });
}

export async function addCommand(phrase: string, action: VoiceCommand["action"], payload?: string): Promise<void> {
  await window.whisperflow.commands.add({ phrase, action, payload });
}

export async function removeCommand(command: VoiceCommand): Promise<void> {
  await window.whisperflow.commands.delete({ id: command.id });
}
