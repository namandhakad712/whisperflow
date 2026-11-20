# Model & Provider Research — Protocol + Baseline

> Goal: pick the best FREE models per hardware tier for WhisperFlow's STT + polish, and the
> best free tiers of OpenAI-compatible APIs for BYO users. This doc is the brief + baseline;
> the research agent updates it with verified, dated findings.

## Research questions

1. **STT (local, whisper.cpp-compatible GGML/GGUF):** current best per tier — speed (RTF on
   CPU), accuracy (WER on common benchmarks), language coverage. Candidates: base.en, small,
   large-v3-turbo, distil-large-v3, quantized variants (Q5/Q8).
2. **Polish LLM (local GGUF for llama.cpp):** best instruct models ≤ 4B at Q4_K_M for
   text-cleanup quality (not chat flashiness). Candidates: Qwen 2.5/3 1.5B–4B, Llama 3.2 1B/3B,
   Gemma 2 2B, Phi-3.5-mini, SmolLM2. Judge: punctuation/filler cleanup fidelity, low
   hallucination, multilingual.
3. **VAD:** silero-vad vs energy baseline — memory cost, latency.
4. **Free cloud tiers (BYO polish):** Groq, Google AI Studio (Gemini), OpenRouter free models,
   Cerebras, Mistral La Plateforme — rate limits, data-retention terms, model quality.
5. **Hardware tiers:** map RAM/CPU/GPU → recommended set. Verify with real RTF numbers where
   published (whisper.cpp bench, llama.cpp perf tables).

## Baseline (shipped in catalog today — to verify/replace)

| Role | Model | Size | Tier | Notes |
| --- | --- | --- | --- | --- |
| STT | whisper-base.en | 148 MB | low | English only, fast |
| STT | whisper-small | 488 MB | mid | multilingual default |
| STT | whisper-large-v3-turbo | 1.6 GB | high | best accuracy |
| Polish | Qwen 2.5 1.5B Instruct Q4_K_M | ~1 GB | low | |
| Polish | Qwen 2.5 3B Instruct Q4_K_M | ~2.2 GB | mid/high | default |
| VAD | silero-vad ONNX | 2 MB | optional | |

## Sources to check (agent)

- whisper.cpp releases + bench discussions (github.com/ggml-org/whisper.cpp)
- HuggingFace model cards + downloads/likes for GGUF repos (Qwen, bartowski, lmstudio-community)
- llama.cpp performance discussions (CPU/GPU RTF tables)
- Groq/Gemini/OpenRouter/Cerebras/Mistral pricing + free-tier docs (rate limits change often — DATE EVERYTHING)
- r/LocalLLaMA recent comparisons for polish-quality anecdotes

## Output format (agent fills)

- `docs/research/findings.md` — dated table per tier: recommended STT + polish + why (numbers)
- Catalog changes as PR-sized notes: exact repo/file/size/sha256 to swap into
  `packages/engine/src/models/catalog.ts`
- Free-tier table: provider / model / limits / retention / BYO config string
