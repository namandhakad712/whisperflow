import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { log } from "../lib/log";

/**
 * The ONLY file in the desktop app that talks to @whisperflow/engine.
 * Everything else goes through this port, so engine API drift lands here.
 */
import type { ModelCatalogEntry, TranscriptItem, WhisperFlowConfig } from "@whisperflow/shared";

export interface DictationResult {
  raw: string;
  final: string;
  transcriptId?: string;
}

export interface EngineSession {
  feed(pcm: Float32Array): void;
  stop(): Promise<DictationResult | null>;
  cancel(): void;
  onState(cb: (ev: { state: string; partial?: string; error?: string }) => void): void;
}

export interface ModelDownloadProgress {
  id: string;
  receivedBytes: number;
  totalBytes: number;
  done: boolean;
  error?: string;
}

export interface EnginePort {
  startSession(): Promise<EngineSession>;
  getConfig(): Promise<WhisperFlowConfig>;
  setConfig(patch: Record<string, unknown>): Promise<WhisperFlowConfig>;
  listHistory(query?: string, limit?: number): Promise<TranscriptItem[]>;
  deleteHistory(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  modelCatalog(): Promise<ModelCatalogEntry[]>;
  downloadModel(id: string, onProgress: (p: ModelDownloadProgress) => void): Promise<void>;
  deleteModel(id: string): Promise<void>;
  setActiveModel(role: "stt" | "polish", id: string): Promise<WhisperFlowConfig>;
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

/** Loads the engine module defensively and maps it onto the port surface main needs. */
export async function createEnginePort(dirs: EngineDirs): Promise<EnginePort> {
  // Structural typing against the module keeps drift detectable at integration time.
  const mod = (await import("@whisperflow/engine")) as {
    createEngine?: (opts: Record<string, unknown>) => Promise<EngineLike>;
  };
  if (typeof mod.createEngine !== "function") {
    throw new Error("@whisperflow/engine did not export createEngine");
  }
  const engine = await mod.createEngine({ dirs, configPath: join(dirs.root, "config.json") });
  log("engine: initialized", engine.id ?? "");

  return {
    startSession: () => engine.startDictation(),
    getConfig: () => engine.getConfig(),
    setConfig: (patch) => engine.updateConfig(patch),
    listHistory: (query, limit) => engine.history.list(query, limit),
    deleteHistory: (id) => engine.history.delete(id),
    clearHistory: () => engine.history.clear(),
    modelCatalog: () => engine.models.catalog(),
    downloadModel: (id, onProgress) => engine.models.download(id, onProgress),
    deleteModel: (id) => engine.models.delete(id),
    setActiveModel: (role, id) => engine.models.setActive(role, id),
    dispose: () => engine.dispose(),
  };
}

/** The engine surface main relies on; the real module must satisfy this structurally. */
interface EngineLike {
  id?: string;
  startDictation(): Promise<EngineSession>;
  getConfig(): Promise<WhisperFlowConfig>;
  updateConfig(patch: Record<string, unknown>): Promise<WhisperFlowConfig>;
  history: { list(q?: string, limit?: number): Promise<TranscriptItem[]>; delete(id: string): Promise<void>; clear(): Promise<void> };
  models: {
    catalog(): Promise<ModelCatalogEntry[]>;
    download(id: string, onProgress: (p: ModelDownloadProgress) => void): Promise<void>;
    delete(id: string): Promise<void>;
    setActive(role: "stt" | "polish", id: string): Promise<WhisperFlowConfig>;
  };
  dispose(): Promise<void>;
}
