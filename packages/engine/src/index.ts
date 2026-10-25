/**
 * @whisperflow/engine — public factory. Runs anywhere Node runs; never
 * imports Electron. See docs/ARCHITECTURE.md for the binding contract.
 */
import type {
  DictationStateEvent,
  HardwareTier,
  HistoryQuery,
  ModelCatalogEntry,
  ModelDownloadProgress,
  ModelStatus,
  TierRecommendation,
  TranscriptItem,
  WhisperFlowConfig,
} from "@whisperflow/shared";
import { join } from "node:path";
import { ConfigStore } from "./config/ConfigStore.js";
import { createHistoryStore, type HistoryStore } from "./history/historyStore.js";
import { ModelManager } from "./models/manager.js";
import { CATALOG } from "./models/catalog.js";
import { WhisperCppProvider } from "./providers/stt/WhisperCppProvider.js";
import { LocalLlamaProvider } from "./providers/polish/LocalLlamaProvider.js";
import { RemoteOpenAIProvider } from "./providers/polish/RemoteOpenAIProvider.js";
import { DictationSession } from "./orchestrator/DictationSession.js";

export interface EngineDirs {
  root: string;
  models: string;
  bin: string;
}

export interface StartDictationOptions {
  onEvent: (ev: DictationStateEvent) => void;
  /** Target app name, when the host knows it (used as polish context). */
  app?: string;
}

export interface WhisperFlowEngine {
  id: string;
  getConfig(): Promise<WhisperFlowConfig>;
  updateConfig(patch: Record<string, unknown>): Promise<WhisperFlowConfig>;
  startDictation(opts: StartDictationOptions): Promise<DictationSession>;
  history: {
    list(query?: HistoryQuery): Promise<TranscriptItem[]>;
    delete(id: string): Promise<{ deleted: boolean }>;
    clear(): Promise<{ cleared: boolean }>;
  };
  models: {
    catalog(): Promise<readonly ModelCatalogEntry[]>;
    status(): Promise<ModelStatus[]>;
    download(id: string, onProgress?: (p: ModelDownloadProgress) => void): Promise<void>;
    delete(id: string): Promise<void>;
    setActive(role: "stt" | "polish", id: string): Promise<void>;
    recommend(tier?: HardwareTier): Promise<TierRecommendation>;
  };
  dispose(): Promise<void>;
}

export { DictationSession, CATALOG };
export type { DictationResult } from "./orchestrator/DictationSession.js";
export type { HistoryStore } from "./history/historyStore.js";

export async function createEngine(opts: { dirs: EngineDirs; configPath?: string }): Promise<WhisperFlowEngine> {
  const logger = (msg: string) => console.debug(`[engine] ${msg}`);
  const config = new ConfigStore(opts.configPath ?? join(opts.dirs.root, "config.json"));
  const history: HistoryStore = createHistoryStore(join(opts.dirs.root, "history.json"));
  const manager = new ModelManager({ modelsDir: opts.dirs.models, binDir: opts.dirs.bin, config });
  const sttProvider = new WhisperCppProvider({ binDir: opts.dirs.bin });
  const localPolish = new LocalLlamaProvider({
    resolveModelPath: (id) => {
      const entry = CATALOG.find((e) => e.id === id);
      return entry ? manager.localPath(entry) : null;
    },
    temperature: () => config.get().polish.temperature,
    logger,
  });
  const remotePolish = new RemoteOpenAIProvider(() => config.get());

  const activePolish = () => {
    const provider = config.get().polish.provider;
    if (provider === "none") return null;
    if (provider === "openai-compat") return remotePolish;
    return localPolish;
  };

  return {
    id: "whisperflow-engine",
    async getConfig() {
      return structuredClone(config.get());
    },
    async updateConfig(patch) {
      return config.set(patch);
    },
    async startDictation(sessionOpts) {
      const cfg = config.get();
      const sttReady = sttProvider.findBinary() !== null;
      return new DictationSession({
        config: structuredClone(cfg),
        stt: sttReady
          ? {
              transcribe: (pcm, o) => sttProvider.transcribe(pcm, o),
              modelPathFor: (id) => {
                const entry = CATALOG.find((e) => e.id === id && e.role === "stt" && e.format !== "binary");
                return entry ? manager.localPath(entry) : null;
              },
            }
          : null,
        polish: activePolish(),
        history,
        app: sessionOpts.app,
        onEvent: sessionOpts.onEvent,
        logger,
      });
    },
    history: {
      async list(query) {
        return history.list(query);
      },
      async delete(id) {
        return { deleted: history.delete(id) };
      },
      async clear() {
        return { cleared: history.clear() };
      },
    },
    models: {
      async catalog() {
        return manager.catalog();
      },
      async status() {
        return manager.status();
      },
      async download(id, onProgress) {
        await manager.download(id, onProgress);
      },
      async delete(id) {
        await manager.delete(id);
      },
      async setActive(role, id) {
        manager.setActive(role, id);
      },
      async recommend(tier) {
        return manager.recommend(tier);
      },
    },
    async dispose() {
      localPolish.dispose();
    },
  };
}
