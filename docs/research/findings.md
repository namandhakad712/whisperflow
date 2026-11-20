# Model Research Findings — verified 2026-10-25

All byte sizes and sha256 hashes below were pulled from the HuggingFace API
(`/api/models/<repo>/tree/main`, LFS `oid` = sha256) or GitHub API on **2026-10-25**.
Quality/speed claims are dated inline. Baseline references `docs/research/MODEL-RESEARCH.md`.

## Headline changes vs. the shipped baseline

1. **The sidecar download is broken.** `releases/latest/download/whisper-bin-x64.zip` now 404s:
   v1.9.5 (2026-10-06) shipped with **zero assets**; Windows binaries now ride a commit-tagged
   release (`b5454`). Pin the URL (see catalog-changes.md).
2. **The default polish model (Qwen2.5-3B-Instruct) is non-commercial.** It has been under the
   *Qwen Research License* since launch (Sept 19, 2024) — the catalog's `license: Apache-2.0`
   field is wrong. Qwen's blog: "All our open-source models, **except for the 3B and 72B
   variants**, are licensed under Apache 2.0." (https://huggingface.co/Qwen/Qwen2.5-3B/blob/main/LICENSE)
3. **Qwen3.5 small models (Mar 2, 2026, Apache 2.0) obsolete the whole Qwen2.5 polish lineup.**
   Artificial Analysis (Mar 5, 2026): Qwen3.5-9B/4B are "the most intelligent models at their
   respective size class"; Qwen3.5-4B scores **IFEval 89.8**, supports **201 languages**, 262K
   context. (https://huggingface.co/Qwen/Qwen3.5-4B, https://artificialanalysis.ai/articles/qwen3-5-small-models)
4. **All three whisper GGML files in the catalog changed size on HuggingFace** (repo re-upload,
   repo lastModified 2024-10-29): catalog sizes are stale and must be updated or downloads fail
   size checks.
5. **distil-large-v3 GGML is no longer published.** `ggml-distil-large-v3.bin` /
   `ggml-distil-small.en.bin` are gone from `ggerganov/whisper.cpp` (verified absent via API +
   404 on resolve, 2026-10-25; `distil-whisper/distil-large-v3` itself ships only safetensors/ONNX,
   MIT, lastModified 2026-04-21). Do **not** add distil to the catalog — large-v3-turbo supersedes it
   (multilingual, similar speed, official GGML).

---

## 1. STT (whisper.cpp GGML) — per tier

RTF reference: whisper.cpp defaults on Intel i7 CPU (openwhispr.com, updated 2026-02-17);
RTF < 1 = faster than real time. WER: LibriSpeech test-clean (en) / multilingual evals as noted.

| Model (file) | Size on disk | Params | Languages | CPU RTF (i7) | Accuracy notes | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `ggml-base.en.bin` | **147,964,211** B | 74 M | en | ~0.15 | ~4.3% WER test-clean, ~12.8% test-other | **low tier, English** |
| `ggml-small.bin` | **487,601,967** B | 244 M | ~100 | ~0.4 | ~3.4% WER test-clean | **low/mid tier, multilingual** |
| `ggml-large-v3-turbo-q5_0.bin` | **574,041,195** B | 809 M | ~100 | ~0.25–0.3 (est. between small 0.4 and turbo 0.6) | Near-turbo on English; **q5_0 degradation noticeable on non-English** (fazm.ai guide + whisper.cpp #3074, 2024/25) | **mid tier default** (en-heavy users) |
| `ggml-large-v3-turbo.bin` | **1,624,555,275** B | 809 M | ~100 | ~0.6 | ~2.5% WER test-clean; multilingual WER ~3.7% vs large-v3 ~3.5%; 8x faster than large-v3; "not trained for translation" (OpenAI model card) | **high tier default; mid-tier option on 16 GB** |
| `ggml-large-v3-turbo-q8_0.bin` | **874,188,075** B | 809 M | ~100 | ~0.5 (est.) | Negligible quantization loss vs f16 | **high tier, RAM-tight** |
| `ggml-large-v3.bin` | **3,095,033,483** B | 1,550 M | ~100 | ~3.0 (slower than realtime) | Best accuracy (10–20% err. reduction over v2); only worth it on GPU or 32 GB+ RAM | optional max-accuracy |

Sources: HF `ggerganov/whisper.cpp` API (sizes+sha256, 2026-10-25); openwhispr.com
"Whisper Model Sizes Explained" (pub. 2026-02-05, upd. 2026-02-17); whisper.cpp discussion
#3074 (2025-05); whisper.cpp issue #2439 (2024-10-01, turbo = "8x faster, minimal degradation");
whispernotes.app turbo WER comparison (13.40% vs 13.20% long-form, 2024-11).

**No Whisper v4 exists.** Latest official remains large-v3 / large-v3-turbo (verified 2026-10-25;
openai/whisper GitHub + HF; "Whisper v4" content in the wild is SEO filler). whisper.cpp latest
release: **v1.9.5, 2026-10-06** (GitHub API).

### GPU variants (NVIDIA)
- large-v3-turbo with CUDA: ~6 GB VRAM (openwhispr table); community reports ~10–130x RTF
  depending on batching (r/LocalLLaMA, 2024-11; promptquorum 2025). WhisperFlow is CPU-first;
  if GPU builds ship, prefer `whisper-bin-win-cuda-12.4.0-x64.zip` (684,913,404 B, release b5454).
- Polish LLM 4B Q4_K_M: ~3–4 GB VRAM total (weights + ctx) → any 6 GB+ GPU.

## 2. Polish LLM (GGUF ≤ 4B, Q4_K_M) — per tier

Judged for: punctuation/filler cleanup fidelity, low hallucination, multilingual, license.

### low tier (model budget ≤ ~1.5 GB, machines ≤ 8 GB RAM)
| Rank | Model | File / size | Why | Source+date |
| --- | --- | --- | --- | --- |
| 1 | **Qwen3.5-2B** (Apache 2.0) | `Qwen3.5-2B-Q4_K_M.gguf`, **1,280,835,840** B | Newest gen (2026-03-02); 201-language support family-wide; clearly above Qwen2.5-1.5B in instruction following; hybrid thinking (run non-thinking for latency) | HF Qwen/Qwen3.5 card 2026-03-02; AA 2026-03-05 |
| 2 | Qwen3.5-0.8B (Apache 2.0) | `Qwen3.5-0.8B-Q4_K_M.gguf`, **532,517,120** B | Ultra-low fallback when 2B is too slow; same family/template | unsloth GGUF repo, sizes via API 2026-10-25 |
| — | (outgoing) Qwen2.5-1.5B | actual size now **1,117,320,736** B (catalog says 1,040,999,104 — stale) | Superseded; keep only if Qwen3.5 arch unsupported by bundled llama.cpp | HF API 2026-10-25 |

### mid tier (≤ 8 GB budget, machines 8–16 GB RAM)
| Rank | Model | File / size | Why | Source+date |
| --- | --- | --- | --- | --- |
| 1 | **Qwen3.5-4B** (Apache 2.0) | `Qwen3.5-4B-Q4_K_M.gguf`, **2,740,937,888** B | "Most intelligent model in its size class" (AA 2026-03-05); IFEval 89.8 / IFBench 59.2; 201 languages; 262K ctx — ideal for cleanup + rewrite | HF model card (2026-03-02); AA (2026-03-05) |
| 2 | Qwen3-4B-Instruct-2507 (Apache 2.0) | `Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf`, **2,497,280,736** B | Fallback if llama.cpp build predates Qwen3.5 support (Mar 2026); Arena-Hard v2 43.4, non-thinking by default | HF card 2025-07 (rel.); size via bartowski mirror API 2026-10-25 |
| 3 | SmolLM3-3B (Apache 2.0) | `SmolLM3-Q4_K_M.gguf` (ggml-org), **1,915,305,312** B | Lighter alternative, dual-mode reasoning, EN+6 langs focus | ggml-org repo API 2026-10-25 |

### high tier (16 GB+)
Same picks as mid (constraint ≤ 4B): **Qwen3.5-4B** default; Qwen3-4B-Instruct-2507 fallback.
Optional: gemma-4-E2B-it Q4_K_M (3,106,738,272 B, Apache 2.0 per HF tag, 2026) — strong multilingual
but E-model raw size ~3 GB Q4 and needs current llama.cpp; keep out of catalog until llama.cpp
gemma-4 support is verified in our bundled build.

**Community sanity check:** cleanup/dictation threads on r/LocalLLaMA (e.g., "local STT + LLM
cleanup", 2025-2026) converge on Qwen3 4B-class / Llama 3.2 3B / Phi-4-mini — Qwen3.5-4B is the
Mar-2026 continuation of that consensus with the best license (Apache 2.0).

**Operational note:** Qwen3.5 thinks by default; soft switch `/no_think` is NOT supported in 3.5.
WhisperFlow must pass `chat_template_kwargs: {"enable_thinking": false}` (or strip `<think>` blocks).
Qwen3-4B-Instruct-2507 is non-thinking only — simpler if we can't set template kwargs.

## 3. VAD

- Shipped artifact `onnx-community/silero-vad` `onnx/model.onnx`: actual **2,243,022** B
  (catalog says 2,261,506 — stale), MIT, repo lastModified 2024-12-15 (v5-era ONNX export).
  sha256 `a4a068cd…c5808` (full hash in catalog-changes.md).
- Upstream `snakers4/silero-vad` is now **v6.2.3** (released 2026-09-23), MIT
  (GitHub API, 2026-10-25). v6 ONNX not in the onnx-community repo yet → **keep the v5 ONNX**;
  no functional change needed.

## 4. Hardware tier mapping

| Tier | Machine | STT | Polish | Disk/RAM for models | Notes |
| --- | --- | --- | --- | --- | --- |
| low | < 8 GB RAM, no GPU | base.en (en) or small (multiling.) | Qwen3.5-2B Q4_K_M (0.8B fallback) | ~0.6–1.8 GB disk / ~1.5–3 GB RAM | ~0.15–0.4 RTF STT; polish ~25–60 tok/s CPU (est.) |
| mid | 8–16 GB RAM | large-v3-turbo-**q5_0** (en-heavy) or small | Qwen3.5-4B Q4_K_M | ~3.3 GB disk / ~4–6 GB RAM | turbo-q5_0 non-English caveat → keep small installed |
| high | 16 GB+ RAM | large-v3-turbo f16 (q8_0 if tight) | Qwen3.5-4B Q4_K_M | ~4.4 GB disk / ~6–8 GB RAM | large-v3 optional on GPU/32 GB; NVIDIA CUDA build available |

## 5. Free API tiers → see [free-tiers.md](free-tiers.md)

Best BYO defaults (details + retention terms there): **Groq `openai/gpt-oss-120b`** (1,000 req/day,
no training), **Gemini 2.5 Flash** (1,500 req/day shared, free tier trains on data),
**OpenRouter free** (50–1,000 req/day, per-endpoint training policies).

## Unverified / open items

- Exact current RPM/RPD **per model** for Gemini free tier (Google stopped publishing the table;
  page last updated 2026-10-15 points into AI Studio, which needs a login).
- Cerebras data-retention/training terms (not covered by the 2026-08-26 census; their rate-limit
  page has no date).
- Mistral free-tier token/month quota (1 B/mo figure is from 2024-era announcements; current docs
  no longer publish numbers).
- Polish decode tok/s are community estimates (llamabench.ai crowd data, Oct 2026), not lab benchmarks.
