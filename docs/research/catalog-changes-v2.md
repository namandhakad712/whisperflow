# Catalog Changes v2 — PR-ready additions for `packages/engine/src/models/catalog.ts`

Follows [catalog-changes.md](catalog-changes.md) (whose P1–P3 edits are already applied to
the catalog as of 2026-10-25). All sizes + sha256 below verified via HuggingFace API
(`/api/models/<repo>/tree/main`, LFS `oid` = sha256) or GitHub Releases API on
**2026-10-25**. Rationale in [model-recommender.md](model-recommender.md). No source edited.

`ModelCatalogEntry` currently has `role: "stt" | "polish" | "vad"` and `format: "ggml" |
"gguf" | "onnx" | "binary"` — the additions below fit without schema changes. Note: entries
served by **transcribe.cpp** need an `engine: "whisper-cpp" | "transcribe-cpp"` discriminator
(or a naming convention) — small schema addition, included in each entry's comment.

## 1. New engine sidecar: transcribe.cpp v0.4.1 (MIT, Windows builds)

Verified via GitHub Releases API 2026-10-25. No sha256 published upstream for binaries —
vendor one after first download (see verification block).

```ts
{
  id: "transcribe-bin-x64",                       // cpu+vulkan build, ~18 MB
  role: "stt",
  name: "transcribe.cpp engine (Windows x64, CPU+Vulkan)",
  repo: "handy-computer/transcribe.cpp",
  file: "transcribe-native-0.4.1-windows-x86_64-cpu-vulkan.tar.gz",
  url: "https://github.com/handy-computer/transcribe.cpp/releases/download/v0.4.1/transcribe-native-0.4.1-windows-x86_64-cpu-vulkan.tar.gz",
  sizeBytes: 18_052_295,
  format: "binary",
  tiers: ["low", "mid", "high"],
  license: "MIT",
  notes: "ggml STT engine supporting Parakeet/Moonshine/Qwen3-ASR/Whisper GGUF. Pinned to v0.4.1 (2026-10-22).",
},
{
  id: "transcribe-bin-x64-cuda",                  // optional, NVIDIA builds, ~203 MB
  role: "stt",
  name: "transcribe.cpp engine (Windows x64, CUDA)",
  repo: "handy-computer/transcribe.cpp",
  file: "transcribe-native-0.4.1-windows-x86_64-cuda.tar.gz",
  url: "https://github.com/handy-computer/transcribe.cpp/releases/download/v0.4.1/transcribe-native-0.4.1-windows-x86_64-cuda.tar.gz",
  sizeBytes: 202_587_464,
  format: "binary",
  tiers: ["mid", "high"],
  license: "MIT",
  notes: "CUDA backend for NVIDIA GPUs. Install only when a compatible GPU is detected. Pinned to v0.4.1.",
},
```

## 2. STT model additions (GGUF, all run on transcribe.cpp)

### 2.1 `parakeet-unified-en-0.6b-q4` — English default candidate (tiers: low?, mid, high)

1.60% WER offline / 1.62% Q4, **cased+punctuated output**, streaming-capable,
14–15× realtime on laptop CPU (Ryzen 4750U, 2026-09-14 bench). NVIDIA Open Model License.

```ts
{
  id: "parakeet-unified-en-0.6b-q4",
  role: "stt",
  name: "Parakeet Unified EN 0.6B (Q4_K_M)",
  repo: "handy-computer/parakeet-unified-en-0.6b-gguf",
  file: "parakeet-unified-en-0.6b-Q4_K_M.gguf",
  url: HF("handy-computer/parakeet-unified-en-0.6b-gguf", "parakeet-unified-en-0.6b-Q4_K_M.gguf"),
  sizeBytes: 477_274_496,
  format: "gguf",          // engine: transcribe-cpp
  tiers: ["mid", "high"],
  license: "NVIDIA-Open-Model",   // commercial OK, attribution required — legal sign-off first
  notes: "English STT with built-in punctuation/capitalization + buffered streaming. 1.62% WER, ~12× realtime CPU. ~477 MB.",
},
// sha256: a8bf3de2b393bd14ead5a858c3748d5e3b07a20fdeabdd3b498fba4f463fa929
// higher-accuracy variant: Q8_0 = 731_357_568 B,
//   sha256 4b50b6dd862bf6e346929aaf4f5eaacec003bfa3f56462d6c874b41ef2f38795, 1.60% WER
```

### 2.2 `parakeet-tdt-0.6b-v3-q4` — multilingual (25 EU langs), tiers: mid/high

CC-BY-4.0 (standard commercial-OK with attribution). 1.98% WER en; de 5.2 / fr 5.3 / es 3.7 /
it 3.0 / ru 6.5 FLEURS (Q8). 12–15× realtime CPU.

```ts
{
  id: "parakeet-tdt-0.6b-v3-q4",
  role: "stt",
  name: "Parakeet TDT 0.6B v3 (Q4_K_M, 25 languages)",
  repo: "handy-computer/parakeet-tdt-0.6b-v3-gguf",
  file: "parakeet-tdt-0.6b-v3-Q4_K_M.gguf",
  url: HF("handy-computer/parakeet-tdt-0.6b-v3-gguf", "parakeet-tdt-0.6b-v3-Q4_K_M.gguf"),
  sizeBytes: 485_425_504,
  format: "gguf",          // engine: transcribe-cpp
  tiers: ["mid", "high"],
  license: "CC-BY-4.0",
  notes: "25 European languages, auto language ID, token timestamps. 1.98% WER en, ~12× realtime CPU. ~485 MB.",
},
// sha256: b68557be1e3c40207fd7c4bd9d63f1d3316b963f15325bfb0cc16a8bb0ffd181
// variants (same repo): Q5_K_M = 548_946_272 B (1.92% WER, best accuracy/size),
//   sha256 cc722e76adc1a629fc0b2535de879d99b8160d07ad4c0215e2ca7d7ea0ae4b8f
//   Q8_0 = 739_508_576 B, sha256 5859f77944efcd8eafa23a6350731960b2b55b2203df51f319665c807d802cc7
```

### 2.3 `moonshine-streaming-tiny-q8` — lowest tier, tiers: low

MIT (cleanest license in the set). True streaming, en. 4.52% WER, 37–75× realtime CPU.
Q8 is the only small quant shipped.

```ts
{
  id: "moonshine-streaming-tiny-q8",
  role: "stt",
  name: "Moonshine Streaming Tiny (Q8_0)",
  repo: "handy-computer/moonshine-streaming-tiny-gguf",
  file: "moonshine-streaming-tiny-Q8_0.gguf",
  url: HF("handy-computer/moonshine-streaming-tiny-gguf", "moonshine-streaming-tiny-Q8_0.gguf"),
  sizeBytes: 50_462_816,
  format: "gguf",          // engine: transcribe-cpp
  tiers: ["low"],
  license: "MIT",
  notes: "Streaming English STT for very low-spec machines. 4.5% WER, 37-75x realtime CPU. ~50 MB.",
},
// sha256: 930e4622ad3a24158b91406c30c977fa6a26b34cb32d6ac3e57cfb23383a869e
// step-up sibling: moonshine-streaming-small Q8_0 = 198_506_848 B, 2.53% WER,
//   sha256 d03670f69629b649085d0f44a63d97668b4119117cc9611a4e4ad94341713dfc
```

### 2.4 `qwen3-asr-0.6b-q4` — multilingual incl. CJK + hotwords, tiers: mid/high

**Apache-2.0** end-to-end. 30 languages incl. zh/ja/ko/hi/vi. 2.26% WER en; 4.7–6.6×
realtime CPU (slower — audio-LLM decoder). `--vocabulary` hotwords.

```ts
{
  id: "qwen3-asr-0.6b-q4",
  role: "stt",
  name: "Qwen3-ASR 0.6B (Q4_K_M, 30 languages)",
  repo: "handy-computer/Qwen3-ASR-0.6B-gguf",
  file: "Qwen3-ASR-0.6B-Q4_K_M.gguf",
  url: HF("handy-computer/Qwen3-ASR-0.6B-gguf", "Qwen3-ASR-0.6B-Q4_K_M.gguf"),
  sizeBytes: 589_560_480,
  format: "gguf",          // engine: transcribe-cpp
  tiers: ["mid", "high"],
  license: "Apache-2.0",
  notes: "Multilingual STT (incl. Chinese/Japanese/Korean) with custom-vocabulary prompting. 2.26% WER en. ~590 MB.",
},
// sha256: 5b58f32a58ffa2c8783e0b0963485623e286e6272d953dfc9e28bc3447dee0c0
// variant: Q8_0 = 850_423_456 B (2.11% WER),
//   sha256 f081b2d5e23bd669d92cc331d722a8a0681943b8e6f34b48996fd5c319b5acd8
// larger sibling: Qwen3-ASR-1.7B Q4_K_M = 1_319_830_496 B, Q8_0 = 2_185_030_624 B
```

## 3. Polish additions (GGUF, llama.cpp)

### 3.1 `qwen3.5-0.8b-q4` — completes the Qwen3.5 ladder for the 4 GB tier

```ts
{
  id: "qwen3.5-0.8b-q4",
  role: "polish",
  name: "Qwen3.5 0.8B (Q4_K_M)",
  repo: "unsloth/Qwen3.5-0.8B-GGUF",
  file: "Qwen3.5-0.8B-Q4_K_M.gguf",
  url: HF("unsloth/Qwen3.5-0.8B-GGUF", "Qwen3.5-0.8B-Q4_K_M.gguf"),
  sizeBytes: 532_517_120,
  format: "gguf",
  tiers: ["low"],
  license: "Apache-2.0",
  notes: "Ultra-light polish for <8 GB RAM machines. ~0.5 GB. Hybrid thinking: pass enable_thinking=false.",
},
// sha256: bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517
```

### 3.2 `olmo-3-7b-instruct-q4` — optional high tier, tiers: high

```ts
{
  id: "olmo-3-7b-instruct-q4",
  role: "polish",
  name: "OLMo 3 7B Instruct (Q4_K_M)",
  repo: "unsloth/Olmo-3-7B-Instruct-GGUF",
  file: "Olmo-3-7B-Instruct-Q4_K_M.gguf",
  url: HF("unsloth/Olmo-3-7B-Instruct-GGUF", "Olmo-3-7B-Instruct-Q4_K_M.gguf"),
  sizeBytes: 4_471_602_048,
  format: "gguf",
  tiers: ["high"],
  license: "Apache-2.0",
  notes: "Fully-open-data polish alternative for 16 GB+ / GPU. English-focused. ~4.5 GB.",
},
// sha256: 0de0bc63fae8a73a48e167be48f149c9544bd4af61d223cd3f331c6ea664c5c4
// verify llama.cpp arch support for OLMo-3 before shipping (Nov 2025 model; current builds OK per unsloth repo)
```

### 3.3 Optional max-fidelity tiers (document, add only if tiering calls for them)

```ts
// Qwen3.5-9B Q4_K_M — 5_680_522_464 B, Apache-2.0 (high + 8GB VRAM)
//   repo unsloth/Qwen3.5-9B-GGUF, sha256 prefix 03b74727a860a563 (full hash: fetch at PR time)
// Qwen3.5-35B-A3B Q4_K_M — 22_016_023_168 B, Apache-2.0 (32 GB special; 3B-active MoE)
//   repo unsloth/Qwen3.5-35B-A3B-GGUF, sha256 3b46d1066bc91cc2d613e3bc22ce691dd77e6f0d33c9060690d24ce6de494375
```

## 4. Do NOT add (with verified data, for the record)

| Candidate | Size (Q4_K_M) | License | Why not |
| --- | ---: | --- | --- |
| Gemma 3 1B (`ggml-org/gemma-3-1b-it-GGUF`) | 806,058,240 B, sha `8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135` | **"gemma" custom ToU** | Not Apache/MIT (policy); revisit if policy relaxes — best-in-class 1B multilingual |
| Gemma 3 4B (`ggml-org/gemma-3-4b-it-GGUF`) | 2,489,757,856 B, sha `882e8d2db44dc554fb0ea5077cb7e4bc49e7342a1f0da57901c0802ea21a0863` | "gemma" custom ToU | Same |
| Llama 3.2 3B (`bartowski/Llama-3.2-3B-Instruct-GGUF`) | 2,019,377,696 B, sha `6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff` | **"llama3.2" community** | Not Apache/MIT; also older gen than Qwen3.5 |
| Phi-4-mini (`unsloth/Phi-4-mini-instruct-GGUF`) | 2,491,874,272 B, sha `88c00229914083cd112853aab84ed51b87bdf6b9ce42f532d8c85c7c63b1730a` | **MIT** | License fine; ranked below Qwen3.5-4B for multilingual cleanup — add only if users request it |
| SmolLM3-3B | 1,915,305,512 B (findings.md) | Apache-2.0 | Outclassed by Qwen3.5-2B at similar size |
| sensevoice-small | Q8 ~240 MB | FunASR Model License (custom) | Non-OSI license; 30 s cap; CJK niche covered by qwen3-asr |
| voxtral-mini-3b | Q4 2.98 GB | Apache-2.0 | 1.8–2.4× realtime CPU — GPU-only, and translation is out of scope |
| canary-qwen-2.5b | Q4 ~2.7 GB | CC-BY-4.0 | GPU-tier English only; parakeet-unified covers en better per GB |
| distil-whisper (any) | — | — | GGML deleted (v1 findings); ONNX v3.5 exists (MIT, 2025-03-25) but adds a JS inference stack for en-only |
| Vosk small-en-us | ~50 MB | Apache-2.0 | 16.26% WER (open_stt, official table) — 4–10× worse than new candidates |

## 5. Tiering implications (`packages/engine/src/models/tiering.ts`)

If adopted, the per-spec mapping from model-recommender.md §4 collapses to:

- low: STT `moonshine-streaming-tiny-q8` (or keep whisper-base.en GGML on whisper.cpp),
  polish `qwen3.5-0.8b-q4`, VAD silero-v5 ONNX
- mid: STT `parakeet-unified-en-0.6b-q4` (en) / `parakeet-tdt-0.6b-v3-q4` (EU langs) /
  `qwen3-asr-0.6b-q4` (CJK), polish `qwen3.5-2b-q4`
- high: STT parakeet Q8 variants + existing whisper-turbo GGML for 99-language coverage,
  polish `qwen3.5-4b-q4` (+ optional `olmo-3-7b` / `qwen3.5-9b` on GPU/32 GB)

## 6. Verification for the PR

```bash
# size check (HF)
curl -sIL "https://huggingface.co/handy-computer/parakeet-unified-en-0.6b-gguf/resolve/main/parakeet-unified-en-0.6b-Q4_K_M.gguf" | grep -i content-length
# sha256 (HF LFS oid == sha256; or download + hash)
curl -sL "<url>" | sha256sum
# sidecar binaries: no upstream sha256 published — hash after first download and pin:
curl -sL -o /tmp/t.zip "https://github.com/handy-computer/transcribe.cpp/releases/download/v0.4.1/transcribe-native-0.4.1-windows-x86_64-cpu-vulkan.tar.gz"
sha256sum /tmp/t.zip   # record in catalog notes
```

Engine-detection prerequisite: `whisper-bin-x64` (whisper.cpp) and `transcribe-bin-x64`
(transcribe.cpp) coexist; entries need an `engine` field so the manager spawns the right
sidecar per model format (ggml → whisper.cpp, gguf → transcribe.cpp, existing GGUF-less
GGML entries unchanged).
