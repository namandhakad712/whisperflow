import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createEngine, type DictationResult, type WhisperFlowEngine } from "@whisperflow/engine";
import type {
  DictationStateEvent,
  HistoryQuery,
  ModelCatalogEntry,
  ModelDownloadProgress,
  ModelStatus,
  TierRecommendation,
  TranscriptItem,
  WhisperFlowConfig,
} from "@whisperflow/shared";
import { log } from "../lib/log";

/**
 * The ONLY file in the desktop app that talks to @whisperflow/engine.
 * Everything else goes through this port, so engine API drift lands here.
 */
export type { DictationResult };

export interface EngineSession {
  feed(pcm: Float32Array): void;
  stop(): Promise<DictationResult | null>;
  cancel(): void;
}

export interface EnginePort {
  startSession(
    onEvent: (ev: DictationStateEvent) => void,
    opts?: {
      app?: string;
      appType?: "email" | "ai" | "terminal" | "other";
      isMessaging?: boolean;
      skipSignature?: boolean;
      triggerSource?: "ptt" | "popo" | "command" | "lens";
      audioPath?: string;
    },
  ): Promise<EngineSession>;
  getConfig(): Promise<WhisperFlowConfig>;
  setConfig(patch: Record<string, unknown>): Promise<WhisperFlowConfig>;
  listHistory(query?: HistoryQuery): Promise<TranscriptItem[]>;
  deleteHistory(id: string): Promise<boolean>;
  clearHistory(): Promise<boolean>;
  importHistory(items: readonly TranscriptItem[]): Promise<{ added: number }>;
  modelCatalog(): Promise<readonly ModelCatalogEntry[]>;
  modelStatus(): Promise<ModelStatus[]>;
  downloadModel(id: string, onProgress: (p: ModelDownloadProgress) => void): Promise<void>;
  deleteModel(id: string): Promise<void>;
  setActiveModel(role: "stt" | "polish", id: string): Promise<void>;
  recommendModels(): Promise<TierRecommendation>;
  deleteUnusedModels(): Promise<{ deleted: string[] }>;
  testCloudStt(): Promise<{ ok: boolean; message: string }>;
  /** One-token probe of the configured cloud polish endpoint. */
  testCloudPolish(): Promise<{ ok: boolean; message: string }>;
  /** Their "lens": AI-edit the given text with a free-form instruction. */
  transformText(text: string, instruction: string): Promise<string>;
  dispose(): Promise<void>;
}

export interface EngineDirs {
  root: string;
  models: string;
  bin: string;
}

export function resolveEngineDirs(userData: string): EngineDirs {
  const dirs: EngineDirs = {
    root: userData,
    models: join(userData, "models"),
    bin: join(userData, "bin"),
  };
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
  return dirs;
}

export async function createEnginePort(dirs: EngineDirs): Promise<EnginePort> {
  const engine: WhisperFlowEngine = await createEngine({
    dirs,
    configPath: join(dirs.root, "config.json"),
  });
  log("engine: initialized", engine.id);

  return {
    startSession: async (onEvent, opts) => {
      const session = await engine.startDictation({
        onEvent,
        app: opts?.app,
        appType: opts?.appType,
        isMessaging: opts?.isMessaging,
        skipSignature: opts?.skipSignature,
        triggerSource: opts?.triggerSource,
        audioPath: opts?.audioPath,
      });
      return {
        feed: (pcm) => session.feed(pcm),
        stop: () => session.stop(),
        cancel: () => session.cancel(),
      };
    },
    getConfig: () => engine.getConfig(),
    setConfig: (patch) => engine.updateConfig(patch),
    listHistory: (query) => engine.history.list(query),
    deleteHistory: async (id) => (await engine.history.delete(id)).deleted,
    clearHistory: async () => (await engine.history.clear()).cleared,
    importHistory: (items) => engine.history.importMany(items),
    modelCatalog: () => engine.models.catalog(),
    modelStatus: () => engine.models.status(),
    downloadModel: (id, onProgress) => engine.models.download(id, onProgress),
    deleteModel: (id) => engine.models.delete(id),
    setActiveModel: (role, id) => engine.models.setActive(role, id),
    recommendModels: () => engine.models.recommend(),
    deleteUnusedModels: () => engine.models.deleteUnused(),
    testCloudStt: () => engine.stt.testCloud(),
    testCloudPolish: () => engine.polish.testCloud(),
    transformText: (text, instruction) => engine.polish.transform(text, instruction),
    dispose: () => engine.dispose(),
  };
}
