/**
 * Model catalog types: what a downloadable model IS, and how downloads report
 * progress. The curated catalog itself lives in
 * `@whisperflow/engine/src/models/catalog.ts`; these are the shared shapes.
 */

/** What a model is used for. */
export type ModelRole = "stt" | "polish" | "vad";

/**
 * Hardware tier used for recommendations.
 *
 * - `low`  — RAM < 8 GB
 * - `mid`  — RAM 8–16 GB
 * - `high` — RAM > 16 GB (and/or capable GPU)
 */
export type HardwareTier = "low" | "mid" | "high";

/** One downloadable artifact (model weights or sidecar binary) in the catalog. */
export interface ModelCatalogEntry {
  /** Stable catalog id, e.g. `"whisper-small"`. Referenced by config modelIds. */
  id: string;
  role: ModelRole;
  /** Human-readable label for the Models settings tab. */
  name: string;
  /**
   * Source repo slug: `"<owner>/<repo>"` on HuggingFace for weights, or the
   * GitHub repo for the whisper.cpp sidecar binary.
   */
  repo: string;
  /** File name inside the repo. */
  file: string;
  /** Absolute download URL (resolve link for HF, release asset for GitHub). */
  url: string;
  /** Approximate on-disk size in bytes, when known. */
  sizeBytes?: number;
  /** Hex sha256, when known — verified after download. */
  sha256?: string;
  /** Tiers this entry is recommended for. */
  tiers: readonly HardwareTier[];
  /** File format: whisper GGML, llama GGUF, Silero ONNX, or a zip binary. */
  format: "ggml" | "gguf" | "onnx" | "binary";
  /** License identifier (e.g. `"MIT"`, `"Apache-2.0"`). */
  license?: string;
  /** Short human note shown in the catalog UI. */
  notes?: string;
}

/** Lifecycle of one download, mirrored into `models/progress` events. */
export type ModelDownloadState =
  | "idle"
  | "downloading"
  | "paused"
  | "done"
  | "error";

/** Progress payload emitted on the `models/progress` channel. */
export interface ModelDownloadProgress {
  entryId: string;
  state: ModelDownloadState;
  /** Bytes written so far (includes resumed-from bytes). */
  receivedBytes: number;
  /** Total bytes, when the server reports Content-Length. */
  totalBytes?: number;
  /** Human-readable failure reason in the `error` state. */
  error?: string;
}

/** Local state of one catalog entry, as returned by `models/status`. */
export interface ModelStatus {
  entryId: string;
  state: "not-downloaded" | "downloading" | "downloaded" | "error";
  /** Bytes currently on disk (partial file while downloading). */
  bytesOnDisk: number;
  /** Live progress while `state === "downloading"`. */
  progress?: ModelDownloadProgress;
}

/** A recommended set of catalog ids for one hardware tier. */
export interface TierRecommendation {
  tier: HardwareTier;
  stt: string;
  polish: string;
  /** Whether local polish is realistic on this tier (false ⇒ suggest polish off). */
  polishViable: boolean;
  vad: string;
}
