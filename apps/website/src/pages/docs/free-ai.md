---
layout: ../../layouts/Doc.astro
title: Free AI for polish and transcription — your options
description: Use free API tiers or tiny local models for WhisperFlow's polish and STT stages. Big models are not required.
---

**TL;DR: you do NOT need a large model.** The polish stage only fixes filler words,
punctuation, and tone — a small, fast model does this *better* than a big one (faster, cheaper,
less likely to rewrite your meaning). Any free tier below is more than enough. The same free
tiers can even power **transcription** itself.

> **Disclaimer:** No affiliation with, sponsorship by, or endorsement from any company named
> here. These are personal opinions for informational purposes — free tiers and terms change
> constantly; verify on each provider's own site and use your own judgment and discretion.

## Free transcription (STT) — cloud, BYO key

Prefer not to download models? Point WhisperFlow at a cloud transcription endpoint:
**Settings → Models → Transcription engine → BYO cloud**.

| Provider | Price / limits (check their site — changes often) | Notes |
| --- | --- | --- |
| **Groq** | Free tier: 20 RPM, ~2,000 requests/day, 7,200 audio-sec/hour | Runs `whisper-large-v3-turbo` (or `whisper-large-v3` — those are the only two). Same key works for polish. Truly OpenAI-compatible |
| **Mistral (Voxtral)** | **$0.0035/min ≈ $0.21/hour**; free-mode quota is not published (it shows in your Mistral console) | `voxtral-mini-transcribe-3-0` — 50+ languages, diarization, context biasing, timestamps. If your console really shows ~$10/month of free usage, that is about **47 hours** — check yours rather than trusting a blog |
| **OpenAI** | Pay per minute, no free tier | `whisper-1` is deprecated (shutdown 2027-02-26); use `gpt-transcribe` |

A couple of honest notes on things that get recommended to us but aren't STT:
**fish.audio S2.1 Pro** is *text-to-speech* (it turns text into audio — useful later for reading
dictation back, not for transcribing it); **Poolside** is a text→text coding-model provider
(fine for polish via OpenRouter's free Laguna endpoint, no transcription at all); and
**QwenAudio SenseVoice** is a genuinely good small ASR but needs its own runtime — it's on the
roadmap as a *local* option, not a cloud API.

## Option 1 — free API tiers for polish (zero setup on your machine)

Plug any OpenAI-compatible endpoint into **Settings → Style → Remote**:

| Provider | Free tier (check their site — changes often) | Why people like it |
| --- | --- | --- |
| **Groq** | 1,000 requests/day on large models | Extremely fast; inputs not retained by default, zero-data-retention available |
| **OpenRouter** | `:free` endpoints, e.g. `poolside/laguna-s-2.1:free` | One key, many providers; per-provider training policies vary |
| **Google AI Studio (Gemini)** | Free tier exists; no published per-model daily cap | ⚠️ free-tier data may be used to improve Google products |
| **Mistral** | "Free mode", quota shown in your console | ⚠️ free mode trains on your data by default — opt out in the admin panel |

Pick a small model on any of them (7B-class or below) — speed beats size for this job.

## Option 2 — a tiny model runs on your own PC

WhisperFlow's default is exactly this: a 1–3 GB GGUF (Qwen3.5 2B/4B) running locally via
llama.cpp. No key, no limits, fully offline. If your machine has 8 GB+ RAM, this is the
simplest path — it's already configured out of the box.

## Option 3 — turn polish off entirely

Settings → Style → Auto cleanup **off**: a built-in offline cleanup (filler removal,
punctuation, capitals) still runs. Zero models, zero keys, zero network — forever.

## Bringing your own key

- Your key is stored **only** in your local `config.json` — never sent anywhere except the
  endpoint you configure.
- The **local-only lock** (Settings → Privacy) overrides everything: with it on, the app
  physically cannot call any endpoint.
- Generic multi-provider adapters (e.g. `@earendil-works/pi-ai` on npm) can bridge providers
  that don't speak the OpenAI format — WhisperFlow loads it automatically if installed.

See [models & hardware](/whisperflow/docs/models/) for the local catalog.
