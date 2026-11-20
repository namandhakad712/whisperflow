# Per-Spec Model Recommender — researched 2026-10-25

Extends [findings.md](findings.md) + [MODEL-RESEARCH.md](MODEL-RESEARCH.md). Goal: given a
user's {RAM, optional NVIDIA GPU/VRAM, CPU cores}, recommend an exact STT + polish + VAD set
with expected latency. All WER = LibriSpeech test-clean (English) unless noted; "×RT" =
speedup over realtime measured by the model publisher (higher = faster; RTF = 1/×RT).

## Headline: the STT game changed in 2026 — transcribe.cpp

**[`handy-computer/transcribe.cpp`](https://github.com/handy-computer/transcribe.cpp)** (MIT,
created 2026-04-07, v0.4.1 released 2026-10-22, active as of 2026-10-25) is a ggml-family
sibling of whisper.cpp that runs **16+ STT model families as GGUF** with the same sidecar
pattern we already use: a single Windows binary (`transcribe-native-*-windows-x86_64-cpu-vulkan`,
~18 MB; CUDA build ~203 MB), CPU/Vulkan/CUDA backends, and numerically-verified ports with
published WER + dual-machine benchmarks (Apple M4 Max + AMD Ryzen 7 PRO 4750U, dated
2026-09-14). It also runs plain Whisper and **Silero VAD v6.2** — i.e. it can replace all
three of our sidecar roles (STT engine + VAD) while keeping our existing whisper GGML files.

Same-harness, same-CPU comparison (Ryzen 7 4750U, CPU backend, 11 s clip / 35 s clip):

| Model (Q8_0) | ×RT CPU (Ryzen 4750U) | WER en test-clean | Languages |
| --- | ---: | ---: | --- |
| whisper-large-v3-turbo (transcribe.cpp GGUF) | 1.12× / 1.74× | 2.01% | 99 |
| **parakeet-tdt-0.6b-v3** | **15.1× / 12.2×** | **1.94%** | 25 (EU) |
| **parakeet-unified-en-0.6b** | **15.5× / 12.5×** | **1.60%** | en |
| qwen3-asr-0.6b | 5.9× / 4.7× | 2.11% | 30 (incl. zh/ja/ko) |
| moonshine-streaming-tiny | 75.3× / 37.3× | 4.52% | en |

whisper-turbo on this harness lands at RTF ~0.6–0.9 on CPU — matching our findings.md
estimate. **Parakeet 0.6B is ~10× faster than whisper-turbo on the same CPU while being
more accurate in English.** Source: transcribe.cpp docs/models/*.md (fetched 2026-10-25;
benchmarks dated 2026-09-14, commit 77b0c93/cd0ea568).

## 1. STT options beyond vanilla whisper GGML

### Recommended candidates (all ship as GGUF for transcribe.cpp; Windows-native)

| Model | Params | Best quant (size) | WER en | ×RT CPU (Ryzen 4750U) | Languages | Streaming | License | Notes |
| --- | ---: | --- | ---: | ---: | --- | --- | --- | --- |
| **parakeet-unified-en-0.6b** (NVIDIA, port pinned 2026-05-10) | 0.6B | Q4_K_M 477 MB / Q8 731 MB | **1.62% / 1.60%** | 14–15.5× | en | **yes** (offline + buffered streaming, same weights; 2.08 s lookahead default) | NVIDIA Open Model License (commercial OK, attribution) | **Outputs cased + punctuated text** — cuts polish-LLM work; word timestamps; GGUF repo has 2.0 M downloads |
| **parakeet-tdt-0.6b-v3** (NVIDIA, pinned 2026-04-16) | 0.6B | Q4_K_M 485 MB / Q8 740 MB | 1.98% / 1.94% | 12–15× | **25 European** (de 5.2%, es 3.7%, fr 5.3%, it 3.0%, pt 5.0%, ru 6.5%, uk 6.8% FLEURS) | no | **CC-BY-4.0** | No PnC (needs polish for casing); lang auto-detect; token timestamps |
| **qwen3-asr-0.6b** (Alibaba, pinned 2026-04-19) | 0.6B | Q4_K_M 590 MB / Q8 850 MB | 2.26% / 2.11% | 4.7–6.6× | **30 incl. zh/ja/ko/hi/vi** | no | **Apache-2.0** | **Vocabulary/hotword prompting** (`--vocabulary`) — dictation gold; audio-LLM decode is slower; 1.7B sibling (Q4 1.32 GB) for max quality |
| **moonshine-streaming-small** (Useful Sensors, 2026-05-06) | ~90M | Q8 199 MB | 2.53–2.54% | (tiny sibling: 37–75×) | en | **yes** (purpose-built streaming) | **MIT** | No timestamps; Q4/Q6 not shipped |
| **moonshine-streaming-tiny** (Useful Sensors) | ~27M | Q8 **50 MB** | 4.52% | **37–75×** | en | **yes** | **MIT** | Fastest option here; WER ≈ whisper-base.en class (4.3%) at 1/3 the size and ~10× the speed |
| sensevoice-small (FunAudioLLM, 2026-05-06) | ~200M | Q8 ~240 MB | 2.56% (ITN off) | fast CTC | zh/yue/en/ja/ko | no | FunASR Model License (permissive, attribution, Alibaba 2023–2028; **not OSI — legal review before shipping**) | Built-in ITN = casing/punctuation/digits; 30 s cap per call; emotion/event tags |
| voxtral-mini-3b (Mistral, 2026-06-06) | 3B | Q4 2.98 GB | 1.88% | **1.8–2.4× (too slow CPU)** | en/fr/de/es/it/pt/nl/hi | no | **Apache-2.0** | Also speech→text translation; GPU-only in practice |
| canary-qwen-2.5b (NVIDIA, 2026-05-15) | 2.5B | Q4 ~2.7 GB | 1.63% | audio-LLM class (slow CPU) | en | no | CC-BY-4.0 | Implicit PnC; 54-min context; GPU tier |
| whisper-large-v3-turbo (baseline) | 809M | Q8 886 MB (transcribe.cpp GGUF) | 2.01% | 1.1–1.7× | **99** | no | MIT | Keep for long-tail languages; our existing GGML files also work |

### Ruled out / legacy

- **distil-whisper**: official GGML deleted (findings.md, 2026-10-25). New life as ONNX:
  `distil-whisper/distil-large-v3.5-ONNX` (MIT, lastModified 2025-03-25, verified via HF API
  2026-10-25) — runnable via transformers.js/ONNX Runtime in Node, but English-only and
  superseded by parakeet-unified (faster + more accurate + smaller). CTranslate2
  (faster-whisper) distil is Python-only → wrong shape for our Node sidecar.
- **Vosk** (alphacephei.com/vosk, accessed 2026-10-25): small-en-us-0.15 is ~50 MB /
  ~300 MB RAM, true streaming, Apache-2.0 — but **WER 16.26% (open_stt, official models
  page)**, ~2–4× worse than everything above. Kaldi-era stack; only wins on Raspberry-Pi-class
  hardware. Not recommended.
- **"Vesper"**: exists but is a speech *emotion* recognition model (arXiv:2307.10757, 2023,
  WavLM-based) — **not an ASR model**; no ASR project by that name found (searched 2026-10-25).
- **wav2vec2 CTC** (facebook/wav2vec2-large-960h etc.): English-only, no punctuation,
  2021-era accuracy; obsolete for dictation vs parakeet CTC/TDT. Skip.

## 2. Polish / cleanup LLMs ≤ 8B (GGUF, ranked for TEXT-CLEANUP fidelity)

Cleanup ranking criteria: instruction-following on short rewrites (IFEval-class), low
hallucination on verbatim-preserving tasks, multilingual, CPU tok/s at Q4, license.
Sizes/sha256 via HF API 2026-10-25; capability evidence from findings.md (Qwen3.5:
AA 2026-03-05, IFEval 89.8 @4B, 201 languages).

| Rank | Model | Q4_K_M size | License | Verdict for cleanup |
| --- | --- | ---: | --- | --- |
| **1** | **Qwen3.5-4B** | 2,740,937,888 B (2.74 GB) | Apache-2.0 | Best fidelity-per-GB; 201 langs; 262K ctx; default for 16 GB+ (and 8 GB with GPU). `enable_thinking:false` required |
| **2** | **Qwen3.5-2B** | 1,280,835,840 B (1.28 GB) | Apache-2.0 | Default 8 GB CPU tier; ~2× decode speed of 4B |
| **3** | **Qwen3.5-0.8B** | 532,517,120 B (0.53 GB) | Apache-2.0 | 4 GB tier; adequate for punctuate/filler-delete; degrades on reformat instructions |
| 4 | OLMo-3-7B-Instruct (Nov 2025 rel.) | 4,471,602,048 B (4.47 GB) | Apache-2.0 | Fully-open data lineage; strong EN; weaker multilingual polish than Qwen; 16 GB+ CPU or 8 GB VRAM |
| 5 | SmolLM3-3B (Jul 2025) | 1,915,305,512 B | Apache-2.0 | EN + 6 langs; fine but outclassed by Qwen3.5-2B at nearly the same size |
| 6 | Phi-4-mini-instruct (3.8B, Feb 2025) | 2,491,874,272 B (2.49 GB) | **MIT** | Good reasoning, compact; multilingual cleanup weaker than Qwen3.5-4B; strong license |
| — | *Qwen3.5-9B* (just >8B budget) | 5,680,522,464 B | Apache-2.0 | Optional max-fidelity on 8 GB VRAM / 32 GB RAM |
| — | *Qwen3.5-35B-A3B* MoE | 22,016,023,168 B | Apache-2.0 | 32 GB special: only 3B active → 4B-class CPU speed with near-9B quality; 22 GB at Q4_K_M is tight vs 32 GB RAM (needs mmap; verify before shipping) |
| ✗ | Gemma 3 1B / 4B (Mar 2025) | 806,058,240 / 2,489,757,856 B | **"gemma" custom ToU** | Commercial use allowed with restrictions (naming/use policy), but **not Apache/MIT** → excluded per policy; 1B is the best non-Apache 1B-class otherwise |
| ✗ | Llama 3.2 3B (Sep 2024) | 2,019,377,696 B | **"llama3.2" community** | Same: commercial OK (<700 M MAU) but not Apache/MIT → excluded; no Llama 4 exists ≤ 8B (Scout is 109B MoE) |
| ✗ | Qwen2.5-3B (current default until v1 fix ships) | 1,117,320,736 B | Qwen Research License (non-commercial) | Remove per catalog-changes.md §3.1 |

CPU viability at Q4 (dense, llama.cpp, community estimates — llamabench.ai crowd data,
Oct 2026; same caveat as findings.md §"Unverified"): 0.8B ≈ 40–60 tok/s, 2B ≈ 25–40,
4B ≈ 15–25, 7B ≈ 8–15 on a modern 8-core laptop CPU. A 60–100 token cleanup rewrite costs
roughly 1.5–2.5 s / 2–4 s / 4–7 s / 7–12 s respectively. On any NVIDIA ≥ 4 GB VRAM all of
these go to 60–150+ tok/s (partial offload) — polish latency stops mattering.

## 3. "llm-api" and "pi-harness" — verified against npm registry 2026-10-25

- **`llm-api` EXISTS but is stale.** npm `llm-api` v1.6.0 (published **2024-04-26**,
  unchanged since; ~5,241 downloads/month). By David Zhang (dzhng), MIT, repo
  github.com/dzhng/llm-api. "Fully typed chat APIs for OpenAI and Azure chat models, with
  token checking and retries"; deps: openai, @anthropic-ai/sdk, groq-sdk,
  @aws-sdk/client-bedrock-runtime. It predates modern reasoning/streaming APIs — **not
  recommended as a dependency in 2026**.
- **`pi-harness` EXISTS but is the wrong tool.** npm `pi-harness` v0.1.1 (published
  **2026-04-26**, ~51 downloads/month), Apache-2.0, part of `zosmaai/openzosma`
  (github, 19 stars, last push 2026-06-20): "Run pi-coding-agent and other Pi packages
  headlessly as a background HTTP/SSE server." It is a **coding-agent harness**, not an
  LLM API compatibility layer. Do not use for BYOK.
- **Recommended BYOK clients** (registry-verified 2026-10-25):
  1. **`openai` v7.43.0** (published 2026-10-22, Apache-2.0) — official SDK; `baseURL`
     override covers every OpenAI-compatible endpoint (Groq, OpenRouter, Together,
     Fireworks, LM Studio, llama.cpp server, llamafile, vLLM). Smallest surface, matches
     our existing "BYO OpenAI-compatible endpoint" design.
  2. **Vercel AI SDK `ai` v7.0.153** (published 2026-10-24, Apache-2.0) — if we later want
     provider-native features (Anthropic/Google) beyond OpenAI-compatible shape.
- `llm-api-adapter` (seen in a dev.to article): **does not exist on npm** (registry 404,
  2026-10-25) — the article's package name is wrong/renamed.

## 4. Per-spec recommendation matrix

VRAM column = NVIDIA 4–8 GB. "Latency" = wall time for a typical 10 s dictation utterance
(STT) plus a ~80-token cleanup (polish), estimated from the benchmarks above scaled to
hardware class. Disk = models only. Multilingual fallbacks noted where the primary is en-only.

### 4 GB RAM (low-end laptops; assume ≤4 cores)

| GPU | STT | Polish | VAD | Disk | Expected latency |
| --- | --- | --- | --- | --- | --- |
| none | **moonshine-streaming-tiny Q8** (50 MB, en, streaming → text appears as you speak; fallback whisper-base.en GGML for robustness) | **Qwen3.5-0.8B Q4** | Silero v5 ONNX (2.2 MB) or transcribe.cpp silero-v6.2 | ~0.6 GB | STT: near-instant streaming; polish ~1.5–2.5 s (or skip polish — output raw) |
| NVIDIA 4–8 GB | **parakeet-tdt-0.6b-v3 Q8** on GPU (740 MB; system RAM stays ~1 GB for polish via mmap) | Qwen3.5-2B Q4, GPU offload (1.3 GB) | Silero (CPU) | ~2.1 GB | STT < 0.5 s; polish ~1 s |

### 8 GB RAM (mainstream laptop)

| GPU | STT | Polish | VAD | Disk | Expected latency |
| --- | --- | --- | --- | --- | --- |
| none | **parakeet-unified-en-0.6b Q8** (en; 731 MB, 1.60% WER, PnC built in) or **qwen3-asr-0.6b Q8** (multiling. incl. CJK; 850 MB) or whisper-small GGML (99 langs) | **Qwen3.5-2B Q4** (Qwen3.5-4B only if browser/apps light) | Silero v5 | ~2–3.6 GB | STT ~0.8–1.2 s (14×RT class); polish 2–4 s → total ~3–5 s |
| NVIDIA 4–8 GB | **parakeet-tdt-0.6b-v3 Q8** (multiling. 25) / parakeet-unified Q8 (en) on GPU | **Qwen3.5-4B Q4** on GPU (2.7 GB + ctx fits 6 GB) | Silero | ~3.5 GB | STT < 0.5 s; polish ~1–1.5 s → total < 2 s |

### 16 GB RAM

| GPU | STT | Polish | VAD | Disk | Expected latency |
| --- | --- | --- | --- | --- | --- |
| none | **parakeet-unified-en Q8** + keep **whisper-large-v3-turbo-q8 GGML** (874 MB) for 99-language coverage; qwen3-asr-0.6b Q8 as CJK alternative | **Qwen3.5-4B Q4** | Silero v5 | ~4.3–5 GB | STT ~0.8–1.2 s; polish 4–7 s (CPU 15–25 tok/s) |
| NVIDIA 4–8 GB | Same STT choices on GPU; whisper-turbo CUDA becomes comfortable (~6 GB VRAM) | Qwen3.5-4B Q4 GPU (or **9B Q4, 5.7 GB** on 8 GB VRAM) | Silero | ~5–7.5 GB | STT < 0.5 s; polish ≤ 1.5 s |

### 32 GB+ RAM

| GPU | STT | Polish | VAD | Disk | Expected latency |
| --- | --- | --- | --- | --- | --- |
| none | parakeet-unified-en Q8 (en) + parakeet-tdt-v3 Q8/F16 (25 langs) + whisper-turbo f16 GGML (99 langs); optional voxtral-mini Q4 for speech-translation | Qwen3.5-4B Q4 default; **Qwen3.5-35B-A3B Q4 (22 GB, 3B-active MoE)** for max fidelity — CPU speed ≈ 4B class | Silero v5/v6 | ~7–25 GB | STT ~1 s; polish 4–7 s (dense 4B) or ~5–8 s (MoE) |
| NVIDIA 4–8 GB | canary-qwen-2.5b Q4 (~2.7 GB, 1.63% WER, implicit PnC) on GPU; or parakeet family | Qwen3.5-9B Q4 on 8 GB VRAM; 4B on 4 GB VRAM | Silero | ~6–9 GB | STT < 1 s; polish ≤ 2 s |

### VAD
Unchanged from findings.md: keep `onnx-community/silero-vad` v5 ONNX (2,243,022 B, MIT).
If we adopt transcribe.cpp, `silero-vad-v6.2` is built into the same binary/catalog — one
less artifact to manage.

## 5. Architectural recommendation

Adopt **transcribe.cpp v0.4.1 as a second/primary STT sidecar** (MIT; same spawn-a-process
shape as whisper.cpp; Windows cpu-vulkan ~18 MB + optional CUDA ~203 MB builds) while
keeping whisper.cpp for 99-language GGML compat. Recommended catalog additions and exact
bytes are in [catalog-changes-v2.md](catalog-changes-v2.md). Decision needed before PR:
shipping two engines vs. migrating fully (transcribe.cpp runs Whisper too, but our
existing GGML files would need re-download in GGUF form — sizes differ, e.g. turbo Q8
874 MB GGML vs 886 MB GGUF).

## Unverified / open items

- Qwen3.5-35B-A3B on 32 GB RAM via mmap: no lab benchmark found for CPU tok/s (claim of
  "4B-class speed" follows from 3B active params; measure before committing the tier).
- Polish tok/s figures remain community estimates (see findings.md caveat).
- NVIDIA Open Model License (parakeet-unified) and FunASR Model License (sensevoice):
  both appear commercial-friendly but are custom texts — **get legal sign-off** before
  making either a default. CC-BY-4.0 (parakeet v3, canary-qwen) is standard commercial-OK
  with attribution.
- transcribe.cpp is young (Apr 2026); pin exact release tags (v0.4.1 verified 2026-10-25)
  and re-verify asset names per release — its release assets carry no published sha256
  except `catalog.db.sha256`.

## Sources (all accessed 2026-10-25)

- transcribe.cpp repo/docs/releases: github.com/handy-computer/transcribe.cpp (v0.4.1,
  2026-10-22; model docs with WER/×RT tables dated 2026-09-14)
- HF API: handy-computer/{parakeet-tdt-0.6b-v3,parakeet-unified-en-0.6b,moonshine-streaming-tiny,
  moonshine-streaming-small,Qwen3-ASR-0.6B,Qwen3-ASR-1.7B}-gguf; unsloth/{Qwen3.5-*,Olmo-3-7B-Instruct,
  Phi-4-mini-instruct}-GGUF; ggml-org/{gemma-3-1b/4b-it-GGUF}; bartowski/Llama-3.2-3B-Instruct-GGUF;
  distil-whisper/distil-large-v3.5-ONNX; nvidia/* model cards (licenses)
- npm registry API: llm-api, pi-harness, openai, ai, llm-api-adapter; GitHub API:
  zosmaai/openzosma
- Vosk: alphacephei.com/vosk + /vosk/models (small-en-us-0.15 WER 16.26% open_stt)
- "Vesper": arxiv.org/abs/2307.10757 (emotion recognition, not ASR)
