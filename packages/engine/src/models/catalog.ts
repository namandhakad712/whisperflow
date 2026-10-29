/**
 * Curated model catalog. Every artifact downloads from HuggingFace (weights)
 * or the official whisper.cpp GitHub release (sidecar binaries).
 * Sizes/sha256 verified 2026-10-25 — see docs/research/findings.md + catalog-changes.md.
 */
import type { ModelCatalogEntry } from "@whisperflow/shared";

const HF = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`;

export const CATALOG: readonly ModelCatalogEntry[] = [
  {
    id: "whisper-bin-x64",
    role: "stt",
    name: "whisper.cpp engine (Windows x64 binaries)",
    repo: "ggml-org/whisper.cpp",
    file: "whisper-bin-x64.zip",
    url: "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip",
    sizeBytes: 8_928_640,
    format: "binary",
    tiers: ["low", "mid", "high"],
    license: "MIT",
    notes: "Required on Windows for local transcription. Downloads once, ~9 MB. Pinned to release b5454.",
  },
  {
    id: "whisper-base-en",
    role: "stt",
    name: "Whisper base (English)",
    repo: "ggerganov/whisper.cpp",
    file: "ggml-base.en.bin",
    url: HF("ggerganov/whisper.cpp", "ggml-base.en.bin"),
    sizeBytes: 147_964_211,
    format: "ggml",
    tiers: ["low"],
    license: "MIT",
    notes: "Fast, English-only. ~148 MB.",
  },
  {
    id: "whisper-small",
    role: "stt",
    name: "Whisper small (multilingual)",
    repo: "ggerganov/whisper.cpp",
    file: "ggml-small.bin",
    url: HF("ggerganov/whisper.cpp", "ggml-small.bin"),
    sizeBytes: 487_601_967,
    format: "ggml",
    tiers: ["low", "mid", "high"],
    license: "MIT",
    notes: "Good balance, 100+ languages. ~488 MB. Default.",
  },
  {
    id: "whisper-large-v3-turbo",
    role: "stt",
    name: "Whisper large v3 turbo (multilingual)",
    repo: "ggerganov/whisper.cpp",
    file: "ggml-large-v3-turbo.bin",
    url: HF("ggerganov/whisper.cpp", "ggml-large-v3-turbo.bin"),
    sizeBytes: 1_624_555_275,
    format: "ggml",
    tiers: ["high"],
    license: "MIT",
    notes: "Best accuracy, needs RAM to spare. ~1.6 GB.",
  },
  {
    id: "whisper-large-v3-turbo-q5_0",
    role: "stt",
    name: "Whisper large v3 turbo (q5_0)",
    repo: "ggerganov/whisper.cpp",
    file: "ggml-large-v3-turbo-q5_0.bin",
    url: HF("ggerganov/whisper.cpp", "ggml-large-v3-turbo-q5_0.bin"),
    sizeBytes: 574_041_195,
    format: "ggml",
    tiers: ["mid"],
    license: "MIT",
    notes: "Turbo accuracy at 1/3 the download. Quantization loss noticeable on non-English — keep whisper-small for those. ~574 MB.",
  },
  {
    id: "qwen3.5-4b-q4",
    role: "polish",
    name: "Qwen3.5 4B (Q4_K_M)",
    repo: "unsloth/Qwen3.5-4B-GGUF",
    file: "Qwen3.5-4B-Q4_K_M.gguf",
    url: HF("unsloth/Qwen3.5-4B-GGUF", "Qwen3.5-4B-Q4_K_M.gguf"),
    sizeBytes: 2_740_937_888,
    format: "gguf",
    tiers: ["high"],
    license: "Apache-2.0",
    notes:
      "Larger polish model — only worth the download if you want heavier rewriting than text cleanup; the 2B default handles filler removal, punctuation, and casing fine. Use the text path only (don't load the mmproj vision file). ~2.7 GB.",
  },
  {
    id: "qwen3.5-2b-q4",
    role: "polish",
    name: "Qwen3.5 2B (Q4_K_M)",
    repo: "unsloth/Qwen3.5-2B-GGUF",
    file: "Qwen3.5-2B-Q4_K_M.gguf",
    url: HF("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q4_K_M.gguf"),
    sizeBytes: 1_280_835_840,
    format: "gguf",
    tiers: ["low", "mid", "high"],
    license: "Apache-2.0",
    notes:
      "Default polish model — 2B is plenty for text cleanup (filler words, punctuation, casing), and it is half the download of the 4B. Recommended for every hardware tier. ~1.3 GB.",
  },
  {
    id: "silero-vad",
    role: "vad",
    name: "Silero VAD (ONNX)",
    repo: "onnx-community/silero-vad",
    file: "onnx/model.onnx",
    url: HF("onnx-community/silero-vad", "onnx/model.onnx"),
    sizeBytes: 2_243_022,
    format: "onnx",
    tiers: ["low", "mid", "high"],
    license: "MIT",
    notes: "Optional upgrade over the built-in energy VAD. ~2 MB.",
  },
];

export function catalogEntry(id: string): ModelCatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}
