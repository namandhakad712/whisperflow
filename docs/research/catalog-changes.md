# Catalog Changes — exact edits for `packages/engine/src/models/catalog.ts`

All sizes and sha256 values verified against the HuggingFace API / GitHub API on **2026-10-25**
(LFS `oid` = sha256 of file content). No source code was edited — these are PR-ready notes.
`url` entries assume the existing `HF(repo, file)` helper.

## Priority 1 — broken/incorrect today

### 1.1 `whisper-bin-x64` (sidecar binary) — URL currently 404s

`releases/latest/download/…` resolves to v1.9.5 (2026-10-06), which shipped **no assets**.
Windows binaries now attach to commit-tagged releases only.

```ts
// id: "whisper-bin-x64"
url: "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip",
// b5454 = 2026-10-06 commit release; file = 8,928,640 bytes (verified HTTP 200 + content-length)
// note: check for a newer commit tag before shipping; asset name may change between tags
notes: "Required on Windows for local transcription. Downloads once, ~9 MB. Pinned to release b5454."
```

Optionally pin by tag instead of `latest` in general — two consecutive "version" releases
(v1.9.4, v1.9.5) had zero assets.

### 1.2 `silero-vad` — stale sizeBytes

```ts
sizeBytes: 2_243_022,   // was 2_261_506
// sha256: a4a068cd6cf1ea8355b84327595838ca748ec29a25bc91fc82e6c299ccdc5808
// repo onnx-community/silero-vad, file onnx/model.onnx (MIT, v5 export, lastModified 2024-12-15)
```

## Priority 2 — whisper GGML sizes (repo re-upload; catalog values fail size checks)

| id | file | sizeBytes (new) | sha256 |
| --- | --- | --- | --- |
| `whisper-base-en` | ggml-base.en.bin | `147_964_211` (was 147,953,465) | `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002` |
| `whisper-small` | ggml-small.bin | `487_601_967` (was 488,434,761) | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |
| `whisper-large-v3-turbo` | ggml-large-v3-turbo.bin | `1_624_555_275` (was 1,646,940,402) | `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69` |

Also fix `whisper-large-v3-turbo` license stays `MIT` (ggml-org repo is MIT; underlying OpenAI
model is MIT) — unchanged.

## Priority 3 — replace the Qwen 2.5 polish lineup

### 3.1 Remove `qwen2.5-3b-instruct-q4` (default polish)

Reason: **license**. Qwen2.5-3B-Instruct is under the *Qwen Research License* (non-commercial,
"research or evaluation purposes only") since its 2024-09-19 release — NOT Apache-2.0 as the
catalog claims. Only Qwen2.5's 3B and 72B variants were carved out of Apache 2.0.
Source: https://huggingface.co/Qwen/Qwen2.5-3B/blob/main/LICENSE (checked 2026-10-25).

### 3.2 Add `qwen3.5-4b-instruct-q4` — new default (tiers: mid, high)

```ts
{
  id: "qwen3.5-4b-q4",
  role: "polish",
  name: "Qwen3.5 4B (Q4_K_M)",
  repo: "unsloth/Qwen3.5-4B-GGUF",
  file: "Qwen3.5-4B-Q4_K_M.gguf",
  url: HF("unsloth/Qwen3.5-4B-GGUF", "Qwen3.5-4B-Q4_K_M.gguf"),
  sizeBytes: 2_740_937_888,
  format: "gguf",
  tiers: ["mid", "high"],
  license: "Apache-2.0",
  notes: "Default polish model — best-in-size-class instruction following (IFEval 89.8), 201 languages. ~2.7 GB. Hybrid thinking: pass enable_thinking=false.",
}
// sha256: 00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4
// (official Qwen GGUF repos are gated as of 2026-10-25; unsloth mirror is ungated, Apache 2.0)
```

### 3.3 Add `qwen3.5-2b-q4` — low tier (replaces qwen2.5-1.5b)

```ts
{
  id: "qwen3.5-2b-q4",
  role: "polish",
  name: "Qwen3.5 2B (Q4_K_M)",
  repo: "unsloth/Qwen3.5-2B-GGUF",
  file: "Qwen3.5-2B-Q4_K_M.gguf",
  url: HF("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q4_K_M.gguf"),
  sizeBytes: 1_280_835_840,
  format: "gguf",
  tiers: ["low", "mid"],
  license: "Apache-2.0",
  notes: "Light polish model for low-RAM machines. ~1.3 GB. Hybrid thinking: pass enable_thinking=false.",
}
// sha256: aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223
```

### 3.4 Remove `qwen2.5-1.5b-instruct-q4`

Superseded by 3.3 (same role, newer generation, Apache 2.0). If kept as legacy: actual size is
now **1,117,320,736** B (catalog: 1,040,999,104 — stale); sha256
`6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`.

## Priority 4 — optional additions (recommend, keep catalog small)

### 4.1 `whisper-large-v3-turbo-q5_0` — mid-tier STT sweet spot (574 MB)

```ts
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
}
// sha256: 394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2
```

### 4.2 `whisper-large-v3-turbo-q8_0` — high tier, RAM-tight variant (874 MB)

```ts
sizeBytes: 874_188_075,
url: HF("ggerganov/whisper.cpp", "ggml-large-v3-turbo-q8_0.bin"),
// sha256: 317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1
```

### 4.3 Fallback polish if bundled llama.cpp predates Qwen3.5 (arch support landed ~Mar 2026)

```ts
// Qwen3-4B-Instruct-2507 (Apache 2.0, non-thinking only — no template kwargs needed)
repo: "bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF",
file: "Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
sizeBytes: 2_497_280_736,
// sha256: 2fde00ce69dd4899c70d020845e2638353015bba0fdf161b3eb965f2bca4464e
// (official Qwen/Qwen3-4B-Instruct-2507-GGUF is gated as of 2026-10-25)
```

## Do NOT add

- **distil-large-v3**: official GGML deleted from `ggerganov/whisper.cpp` (verified 404 +
  API tree 2026-10-25); English-only; superseded by large-v3-turbo.
- **gemma-4-E2B-it**: 3.1 GB at Q4_K_M despite "2B" name (E-model raw size) — no low-tier fit;
  llama.cpp support unverified in our bundled build.
- **Qwen2.5-3B**: non-commercial license; any fix short of removal leaves the app default
  non-redistributable for commercial use.

## Verification commands (for the PR)

```bash
# size check
curl -sIL https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin | grep -i content-length
# sha256 check (downloads file; compare with table above)
curl -sL <url> | sha256sum
```
