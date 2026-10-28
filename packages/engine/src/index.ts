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
import { CloudSttProvider } from "./providers/stt/CloudSttProvider.js";
import { withSttFallback } from "./providers/stt/withFallback.js";
import { LocalLlamaProvider } from "./providers/polish/LocalLlamaProvider.js";
import { RemoteOpenAIProvider } from "./providers/polish/RemoteOpenAIProvider.js";
import type { PolishInput, PolishProvider } from "./providers/polish/PolishProvider.js";
import { DictationSession, type SttAdapter } from "./orchestrator/DictationSession.js";
import { pcmToWav } from "./audio/wav.js";

export { pcmToWav };

export interface EngineDirs {
  root: string;
  models: string;
  bin: string;
}

export interface StartDictationOptions {
  onEvent: (ev: DictationStateEvent) => void;
  /** Target app name, when the host knows it (used as polish context). */
  app?: string;
  /** Reference AppType of the target app — gates signature/messaging/cleanup rules. */
  appType?: "email" | "ai" | "terminal" | "other";
  /** Target app is a chat/messaging client (trailing-period stripping). */
  isMessaging?: boolean;
  /** A signature is already present in the target box — don't append another. */
  skipSignature?: boolean;
  /** Their transcriptCommand: how the dictation was triggered. */
  triggerSource?: "ptt" | "popo" | "command" | "lens";
  /** Absolute path of the recording file when the host is saving audio. */
  audioPath?: string;
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
    /** Merges backup entries (existing ids skipped). Returns how many were added. */
    importMany(items: readonly TranscriptItem[]): Promise<{ added: number }>;
  };
  models: {
    catalog(): Promise<readonly ModelCatalogEntry[]>;
    status(): Promise<ModelStatus[]>;
    download(id: string, onProgress?: (p: ModelDownloadProgress) => void): Promise<void>;
    delete(id: string): Promise<void>;
    setActive(role: "stt" | "polish", id: string): Promise<void>;
    recommend(tier?: HardwareTier): Promise<TierRecommendation>;
    /** Frees disk: removes downloaded models nothing points at. */
    deleteUnused(): Promise<{ deleted: string[] }>;
  };
  stt: {
    /** Validates the configured cloud STT key against its endpoint (no audio sent). */
    testCloud(): Promise<{ ok: boolean; message: string }>;
  };
  polish: {
    /** Sends a one-token probe to the configured cloud polish endpoint. */
    testCloud(): Promise<{ ok: boolean; message: string }>;
  };
  dispose(): Promise<void>;
}

export { DictationSession, CATALOG };
export type { DictationResult } from "./orchestrator/DictationSession.js";
export type { HistoryStore } from "./history/historyStore.js";
// Text post-processing + learning loop (used by the desktop host).
export {
  bestMatchingRegion,
  levenshtein,
  matchesBeforePasteAndAfter,
  normalizedEditDistance,
} from "./text/editDistance.js";
export {
  countDictionaryPhrases,
  learnFromEdits,
  STOPWORDS,
} from "./text/learnFromEdits.js";
export type { LearnedCandidate } from "./text/learnFromEdits.js";

export async function createEngine(opts: { dirs: EngineDirs; configPath?: string }): Promise<WhisperFlowEngine> {
  const logger = (msg: string) => console.debug(`[engine] ${msg}`);
  const config = new ConfigStore(opts.configPath ?? join(opts.dirs.root, "config.json"));
  const history: HistoryStore = createHistoryStore(join(opts.dirs.root, "history.json"));
  const manager = new ModelManager({ modelsDir: opts.dirs.models, binDir: opts.dirs.bin, config });
  const sttProvider = new WhisperCppProvider({ binDir: opts.dirs.bin });
  const localPolish = new LocalLlamaProvider({
    resolveModelPath: (id) => {
      const entry = manager.entry(id);
      return entry ? manager.localPath(entry) : null;
    },
    temperature: () => config.get().polish.temperature,
    logger,
  });
  const remotePolish = new RemoteOpenAIProvider(() => config.get());
  const cloudStt = new CloudSttProvider(() => config.get());

  /** Remote polish, with an optional local-model rescue before offline cleanup. */
  const activePolish = (): PolishProvider | null => {
    const cfg = config.get();
    const provider = cfg.polish.provider;
    if (provider === "none") return null;
    if (provider !== "openai-compat") return localPolish;
    if (!cfg.polish.fallbackToLocal) return remotePolish;
    return {
      id: "openai-compat",
      available: () => remotePolish.available(),
      async *polish(input: PolishInput) {
        try {
          yield* remotePolish.polish(input);
        } catch (err) {
          const local = await localPolish.available();
          if (!local) throw err; // session falls back to offline cleanup
          logger(`polish: remote failed (${String(err).slice(0, 80)}) — using the local model`);
          yield* localPolish.polish(input);
        }
      },
    };
  };

  /**
   * Test affordance: set `WF_STT_MOCK=<text>` and every transcription returns
   * that text, so automated end-to-end runs can drive the whole pipeline
   * (session → polish → injection) with no model download, no network key, and
   * no microphone. Never active unless the variable is set.
   */
  const mockStt = (): SttAdapter | null => {
    const mock = process.env["WF_STT_MOCK"];
    if (!mock) return null;
    return {
      transcribe: async () => mock,
      modelPathFor: () => "mock",
      ready: () => true,
    };
  };

  /** Local whisper.cpp adapter, when the sidecar binary exists. */
  const localStt = (): SttAdapter | null =>
    sttProvider.findBinary() === null
      ? null
      : {
          transcribe: (pcm, o) => sttProvider.transcribe(pcm, o),
          modelPathFor: (id) => {
            const entry = manager.entry(id);
            return entry && entry.role === "stt" && entry.format !== "binary" ? manager.localPath(entry) : null;
          },
        };

  /** Cloud BYOK adapter, when a key is configured and the local-only lock is off. */
  const cloudSttAdapter = (): SttAdapter | null =>
    cloudStt.isReady()
      ? {
          transcribe: (pcm, o) => cloudStt.transcribe(pcm, o),
          modelPathFor: () => null,
          ready: () => true,
        }
      : null;

  /**
   * Wraps a primary engine with a backup: if the primary throws (quota, network,
   * missing weights), the backup transcribes that same segment instead.
   */
  const pickStt = (primary: SttAdapter | null, backup: SttAdapter | null): SttAdapter | null =>
    withSttFallback(primary, backup, logger);

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
      const mock = mockStt();
      const local = localStt();
      const cloud = cloudSttAdapter();
      const primary = mock ?? (cfg.stt.provider === "cloud" ? cloud : local);
      const backup =
        cfg.stt.fallback === "local" ? local : cfg.stt.fallback === "cloud" ? cloud : null;
      const stt = mock ?? pickStt(primary, backup);
      if (mock) logger("stt: WF_STT_MOCK is set — transcriptions are the canned test text");
      return new DictationSession({
        config: structuredClone(cfg),
        stt,
        polish: activePolish(),
        history,
        app: sessionOpts.app,
        appType: sessionOpts.appType,
        isMessaging: sessionOpts.isMessaging,
        skipSignature: sessionOpts.skipSignature,
        triggerSource: sessionOpts.triggerSource,
        audioPath: sessionOpts.audioPath,
        appendMode: cfg.general.meetingMode,
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
      async importMany(items) {
        return { added: history.importMany(items) };
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
      async deleteUnused() {
        return manager.deleteUnused();
      },
    },
    stt: {
      async testCloud() {
        return cloudStt.testConnection();
      },
    },
    polish: {
      /** One-token probe: validates baseUrl/key/model without dictation. */
      async testCloud() {
        const cfg = config.get();
        if (cfg.privacy.localOnly) {
          return { ok: false, message: "Local-only mode is on — remote providers are blocked (Privacy tab)." };
        }
        const { baseUrl, apiKey, model } = cfg.polish.remote;
        if (!baseUrl) return { ok: false, message: "No endpoint configured — pick a provider in Settings." };
        if (!model) return { ok: false, message: "No model configured — pick a model in Settings." };
        try {
          const res = await fetch(baseUrl.replace(/\/+$/, "") + "/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              max_tokens: 8,
              stream: false,
              messages: [{ role: "user", content: "Reply with the single word: OK" }],
            }),
          });
          if (!res.ok) {
            const body = (await res.text()).slice(0, 160);
            return { ok: false, message: `HTTP ${res.status}: ${body}` };
          }
          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const text = json.choices?.[0]?.message?.content?.trim();
          return text
            ? { ok: true, message: `${model} answered (${text.slice(0, 40)})` }
            : { ok: true, message: `${model} responded with an empty completion (endpoint works)` };
        } catch (err) {
          return { ok: false, message: String(err).slice(0, 200) };
        }
      },
    },
    async dispose() {
      localPolish.dispose();
    },
  };
}
