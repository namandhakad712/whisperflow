# Free API Tiers for BYO Polish — verified 2026-10-25

All providers below expose an OpenAI-compatible endpoint. Limits change often; each claim is dated.
Data-terms column is what matters most for a dictation app: users speak private text through it.

## Summary table

| Provider | Free tier | Best free model | Limits (dated) | Data retention / training | Base URL (OpenAI-compatible) |
| --- | --- | --- | --- | --- | --- |
| **Groq** | Permanent free tier, no credit card | `openai/gpt-oss-120b` | Large models **30 RPM / 1,000 req/day**; `gpt-oss-20b` is also **1,000 req/day** (the old "14,400 req/day on small models" line was wrong — corrected 2026-10-26). `llama-3.1-8b-instant`, `llama-3.3-70b` and `qwen3-32b` are gone from Groq's table. STT: **only** `whisper-large-v3-turbo` + `whisper-large-v3` — 20 RPM / ~2,000 req/day / 7,200 audio-sec/hr | Inputs are "not retained by default"; abuse logs ≤ 30 days; ZDR available to all customers (console.groq.com/docs/your-data, 2026-10-26). Groq publishes **no explicit "never trains" sentence** — don't over-claim it | `https://api.groq.com/openai/v1` |
| **Google AI Studio (Gemini API)** | Permanent free tier, no credit card | `gemini-2.5-flash` | **No per-model RPD is published any more.** The "1,500 req/day" figure on Google's pricing page is *Search-grounding* RPD, not generation (misread — corrected 2026-10-26); the rate-limits page (upd. 2026-10-15) redirects to the in-console view. Check aistudio.google.com/rate-limit after login | **Free tier data IS used to improve Google products**, incl. human reviewers (terms upd. 2026-04-28). EEA/Switzerland/UK get paid-tier (no-training) terms even on free tier. Paid tier: no training | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| **OpenRouter** | Permanent free-model tier | `poolside/laguna-s-2.1:free` — **verified $0, 262,144 ctx** (2026-10-26). Other `:free` ids rotate constantly: query `GET /api/v1/models` instead of trusting any list, including this one | Free-tier caps are JS-rendered on the docs page and **could not be verified** (audit 2026-10-26). The widely-quoted 20 RPM / 50 req/day → 1,000 req/day at ≥$10 credits is **unconfirmed** — check your account page | Training policy is **per-upstream-provider**, with separate account settings for free vs paid models. Pick endpoints deliberately | `https://openrouter.ai/api/v1` |
| **Cerebras** | **No permanent free tier** — their FAQ: *"Is there a permanently free tier? No."* $5 trial credits expire after 30 days and a **payment method is required** (verified 2026-10-26) | `gpt-oss-120b` | 5 RPM / 30K uncached TPM (90K total TPM) / 1M tokens/day per model on the trial. Fast, but bursty dictation hits the 5 RPM wall immediately — **not a free option; removed from our UI copy** | **Not verified** — no data-terms on their rate-limit page | `https://api.cerebras.ai/v1` |
| **Mistral** | **"Free mode"** — the old "Experiment" plan name is retired; quota is shown **only in the Admin Console**, no published number (audit 2026-10-26) | `mistral-small-latest` | The old "1 req/sec" and "~1B tokens/month" figures are **unverified legacy — removed**. Per-model prices are published: Voxtral Mini Transcribe 3 **$0.0035/min** (~$0.21/hour) | Free mode trains on your data by default; opt out in the admin Privacy menu; paid tier is opted out by default (census 2026-08-26) | `https://api.mistral.ai/v1` |

## Recommendations for WhisperFlow BYO presets

1. **Default BYO preset: Groq.** No-card signup, ZDR available, 1,000 req/day on a 120B-class model
   (strong polish quality), and free Whisper STT (`whisper-large-v3-turbo`) as a bonus for hybrid
   mode. Config: `base_url=https://api.groq.com/openai/v1, model=openai/gpt-oss-120b`.
2. **Cheapest serious STT: Mistral Voxtral Mini Transcribe 3** — $0.0035/min (~$0.21/hour), 50+
   languages, diarization, context biasing, Public Preview since 2026-10-20. Free-mode quota is
   unpublished (console only). If you see ~$10/month of free usage in your console, that is roughly
   **47 hours** — nice if true, but we do **not** quote it as fact in the product.
3. **Gemini 2.5 Flash** has no published per-model daily cap any more; its free tier trains on your
   data. Poor default for voice input — keep it out of the default presets.
4. **OpenRouter** is the widest model buffet, with `poolside/laguna-s-2.1:free` verified at $0 (262k
   ctx). Per-provider training policies vary; free caps are unverifiable without logging in.
5. **Cerebras** has **no permanent free tier** (trial credits only, card required) — not offered.
6. **Mistral trains on free-mode data by default** — mention the admin opt-out wherever we list it.

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
| **Groq** | Permanent free tier, no credit card | `whisper-large-v3-turbo` (default), `whisper-large-v3` — **only these two exist**; there is no `distil-whisper-large-v3-en` on Groq (corrected 2026-10-26) | 20 RPM, ~**2,000 requests/day**, **7,200 audio-sec/hour**, 28,800 audio-sec/day (console.groq.com/docs/rate-limits, 2026-10-26). Paid: $0.04/audio-hour; 10-second minimum billing | Same key as polish. Inputs not retained by default (≥30-day abuse logs, ZDR available). Truly OpenAI-compatible — multipart, `{text}` reply |
| **Mistral** | Free mode (quota in console only) | `voxtral-mini-transcribe-3-0` (Public Preview v3.0, 2026-10-20; 4B, 50+ languages, diarization, context biasing). Mistral's own docs are inconsistent and also show `voxtral-mini-latest` / `voxtral-mini-transcribe-3` — verify with `GET /v1/models` | **$0.0035/min** (~$0.21/hour) — docs.mistral.ai/inference/pricing, 2026-10-26 | **OpenAI-compatible**: Mistral's own page says the endpoint "follows the same request structure as the OpenAI audio transcriptions API" and the reference marks `file` as an uploaded File (`file=@path`) → multipart. Response `{model, text, language, segments, usage}` |
| **OpenAI** | None — pay-as-you-go | `gpt-transcribe` (current). **`whisper-1` is deprecated with a hard shutdown on 2027-02-26** (along with `gpt-4o-transcribe*` and `/v1/audio/translations`) | — | `gpt-transcribe` takes `languages[]` (not `language`) and returns `{text, languages:[{code}]}` — our adapter sends `language`, so verify before relying on it |

Sources: https://console.groq.com/docs/speech-to-text and https://console.groq.com/docs/rate-limits
(fetched 2026-10-26); https://docs.mistral.ai/inference/pricing and
https://docs.mistral.ai/api/endpoint/audio/transcriptions (2026-10-26);
https://docs.mistral.ai/studio/audio/speech_to_text/offline_transcription (OpenAI-compat statement, 2026-10-26).

## What is NOT a transcription API (honest notes)

- **fish.audio S2.1 Pro** (fish.audio/blog/s2-1-pro-free-api, Jun 2026) is a **text-to-speech**
  model — it synthesizes speech from text (83 languages, free tier, "fair use" unlimited).
  It cannot transcribe. A future version could use it to *read dictation back* for proofing;
  it is not part of the STT path.
- **Poolside** (poolside.ai) is **not** a speech provider, and not a free tier. Laguna XS 2.1 /
  M.1 / S 2.1 are **text→text coding-agent** models (OpenRouter metadata: `modality: "text->text"`,
  `supports_diarization: false`). The weights are released under **OpenMDW-1.1** (not Apache/MIT).
  `poolside/laguna-s-2.1:free` is a real $0 OpenRouter endpoint (262k ctx) usable for *polish*,
  and poolside.ai's own free API access was a "limited time" promo (Apr 2026 blog) — not a tier.
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
