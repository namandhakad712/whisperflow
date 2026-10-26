# Free API Tiers for BYO Polish — verified 2026-10-25

All providers below expose an OpenAI-compatible endpoint. Limits change often; each claim is dated.
Data-terms column is what matters most for a dictation app: users speak private text through it.

## Summary table

| Provider | Free tier | Best free model | Limits (dated) | Data retention / training | Base URL (OpenAI-compatible) |
| --- | --- | --- | --- | --- | --- |
| **Groq** | Permanent free tier, no credit card | `openai/gpt-oss-120b` | Large models (gpt-oss-120b, llama-3.3-70b, qwen3-32b): **30 RPM / 1,000 req/day / 8K TPM / 200K tokens/day**. Small models (llama-3.1-8b-instant, gpt-oss-20b): 30 RPM / 14,400 req/day / 6K TPM / 500K tokens/day (article upd. **2026-10-04**). Bonus: `whisper-large-v3-turbo` STT free at 2,000 req/day (console docs, fetched 2026-10-25) | **No training on inputs/outputs**; retention "up to 30 days" only for reliability/abuse logs; ZDR toggle available to ALL customers in Data Controls (console.groq.com/docs/your-data, fetched 2026-10-25) | `https://api.groq.com/openai/v1` |
| **Google AI Studio (Gemini API)** | Permanent free tier, no credit card | `gemini-2.5-flash` | **1,500 req/day free, shared between 2.5 Flash and 2.5 Flash-Lite** (official pricing page, upd. **2026-10-22**). Per-model RPM/RPM table no longer published (rate-limits page upd. 2026-10-15 → check aistudio.google.com/rate-limit after login). Gemini 3 Flash Preview also free-token tier. RPD resets midnight Pacific | **Free tier data IS used to improve Google products**, incl. human reviewers reading prompts/outputs (terms upd. 2026-04-28, census 2026-08-26). EEA/Switzerland/UK users get paid-tier (no-training) terms even on free tier. Paid tier: no training | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| **OpenRouter** | Permanent free-model tier | `nvidia/nemotron-3-ultra:free` (top free by usage, 1M ctx, Oct 2026 collection); alternates: `poolside/laguna-s-2.1:free`, `thinking-machines/inkling:free` | `:free` models: **20 req/min; 50 req/day** if you've never bought credits → **1,000 req/day** once you hold ≥ $10 all-time credits (official docs, fetched **2026-10-25**) | Training policy is **per-upstream-provider** and there are **separate account settings for free vs paid models** (census 2026-08-26). Several free endpoints explicitly train: Poolside/LiquidAI pages say inputs+outputs may be used for training (collection page, Oct 2026). Pick endpoints carefully | `https://openrouter.ai/api/v1` |
| **Cerebras** | "Free Trial" tier + $5 credits (expire after 30 days) | `gpt-oss-120b` or `qwen-3.8-27b` | **5 RPM / 30K uncached TPM (90K total TPM) / 1M tokens/day per model**; "every model in the Shared Inference Model Catalog" available on Free Trial (official docs, fetched **2026-10-25**, page undated). Older articles' "30 RPM / 1M tokens/day" no longer matches the current table | **Not verified** — not covered by the 2026-08-26 free-tier data-terms census; their rate-limit page carries no data-terms. Flag as unknown in UI copy | `https://api.cerebras.ai/v1` |
| **Mistral La Plateforme** | Free "Experiment" tier, requires phone-verified account | `mistral-small-latest` (24B class) | **1 req/sec** global per key (r/MistralAI analysis, 2026); ~1B tokens/month widely reported but **from 2024-era announcements — current docs no longer publish numbers** (docs.mistral.ai usage-limits fetched 2026-10-25: numbers live in admin console) | **Free tier trains on your data by default**; opt out via admin Privacy menu; retention user-configurable (Never…1 yr); paid tier is opted-out by default (census 2026-08-26; one Mistral page contradictorily says API data "isn't used for model training") | `https://api.mistral.ai/v1` |

## Recommendations for WhisperFlow BYO presets

1. **Default BYO preset: Groq.** Best combination: no-card signup, no training, ZDR available,
   1,000 req/day on a 120B-class model (very strong polish quality), and free Whisper STT as a
   bonus for hybrid mode. Config string: `base_url=https://api.groq.com/openai/v1, model=openai/gpt-oss-120b`.
2. **Quality alternative: Gemini 2.5 Flash** — highest daily cap (1,500) of the no-card tiers, but
   the free tier's data-training terms make it a poor default for voice input; surface that warning
   in the BYO settings UI. EEA/UK/CH users effectively get paid-tier terms.
3. **OpenRouter** is the widest model buffet but 50 req/day without a one-time $10 credit, and
   free-endpoint training policies vary per provider — only recommend specific `:free` models we've
   checked, with the training disclaimer.
4. **Cerebras**: fast, generous tokens/day, but 5 RPM makes bursty dictation hit 429s; data terms
   unverified — de-prioritize.
5. **Mistral**: training-by-default on the free tier — last choice for a dictation app; mention
   opt-out location if we include it.

## Sources

- Groq rate limits: https://console.groq.com/docs/rate-limits (fetched 2026-10-25); free-tier numbers
  cross-checked against https://klymentiev.com/blog/groq-api-free-tier (upd. 2026-10-04).
- Groq data terms: https://console.groq.com/docs/your-data (fetched 2026-10-25).
- Gemini limits: https://ai.google.dev/gemini-api/docs/pricing (upd. 2026-10-22),
  https://ai.google.dev/gemini-api/docs/rate-limits (upd. 2026-10-15).
- OpenRouter limits: https://openrouter.ai/docs/api-reference/limits (fetched 2026-10-25);
  free-model collection https://openrouter.ai/collections/free-models (Oct 2026).
- Cerebras limits: https://inference-docs.cerebras.ai/support/rate-limits (fetched 2026-10-25).
- Mistral: https://docs.mistral.ai/admin/billing-usage/usage-limits/ (fetched 2026-10-25).
- Data-terms census across providers: https://www.digitalapplied.com/blog/free-and-promo-tier-data-terms-census
  (2026-08-26) — used for Google/Mistral/OpenRouter training & retention statements.

---

# Cloud STT (ASR) BYOK — verified 2026-10-26

WhisperFlow supports BYO-key transcription via any OpenAI-compatible
`POST {base}/audio/transcriptions` endpoint (multipart file + `model` + optional
`language`/`prompt`, JSON `{ "text": ... }` response). Config: `stt.provider = "cloud"`,
`stt.cloud.{provider, baseUrl, apiKey, model}` — same local-only lock as polish
(`privacy.localOnly` blocks it hard).

| Provider | Free tier | Models | Limits (dated) | Notes |
| --- | --- | --- | --- | --- |
| **Groq** | Permanent free tier, no credit card | `whisper-large-v3-turbo` (default), `whisper-large-v3`, `distil-whisper-large-v3-en` | ~**2,000 requests/day** and **7,200 audio seconds/hour** for the Whisper models (rate-limits page + GroqDocs speech-to-text, fetched **2026-10-26**) | Same key as polish. Same no-training terms (see polish table above). Fast — transcription typically returns before the segment ends |
| **OpenAI** | Pay-as-you-go (no free tier) | `whisper-1` | — | Listed for completeness; Groq is the free default |

Sources: https://console.groq.com/docs/speech-to-text and https://console.groq.com/docs/rate-limits
(fetched 2026-10-26); free-tier press summary https://grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get (2026-03-27).

## What is NOT a transcription API (honest notes)

- **fish.audio S2.1 Pro** (fish.audio/blog/s2-1-pro-free-api, Jun 2026) is a **text-to-speech**
  model — it synthesizes speech from text (83 languages, free tier, "fair use" unlimited).
  It cannot transcribe. A future version could use it to *read dictation back* for proofing;
  it is not part of the STT path.
- **QwenAudio/SenseVoice** (github.com/QwenAudio/SenseVoice; FunAudioLLM/SenseVoiceSmall on HF)
  — excellent small ASR (Mandarin, Cantonese, English, Japanese, Korean) with emotion + audio
  event detection, but the released model needs funasr/sherpa-onnx runtimes, not whisper.cpp.
  It is the **v0.2 local-STT upgrade** (together with NVIDIA Parakeet via transcribe.cpp — see
  `model-recommender.md`), not a cloud API you can point a key at.

## Why cloud STT is optional, not the default

The whole point of this project is that the machine in front of you is enough. Cloud STT exists
for (a) machines without the RAM/disk for local models, (b) users who already live in a generous
free tier, and (c) multilingual accuracy testing. Everything — including the settings copy —
keeps local-first as the default and never hides that cloud audio leaves the machine (except
when blocked entirely by the local-only lock).
