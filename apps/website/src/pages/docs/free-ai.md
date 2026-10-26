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
**Settings → Models → Transcription engine → Cloud (BYO API key)**.

| Provider | Free tier (check their site — changes often) | Notes |
| --- | --- | --- |
| **Groq** | ~2,000 requests/day, ~7,200 audio seconds/hour | Runs `whisper-large-v3-turbo`; same key works for polish; no training on your data |
| **OpenAI** | Paid only | `whisper-1` — listed for completeness |

A couple of honest notes: **fish.audio S2.1 Pro** is a *text-to-speech* model (it makes speech
from text — useful later for reading dictation back, not for transcription), and
**QwenAudio SenseVoice** is a superb small ASR but needs its own runtime — it's on the roadmap
as a local option, not a cloud API. Groq is the practical free default today.

## Option 1 — free API tiers for polish (zero setup on your machine)

Plug any OpenAI-compatible endpoint into **Settings → Style → Remote**:

| Provider | Free tier (check their site — changes often) | Why people like it |
| --- | --- | --- |
| **Groq** | ~1,000 requests/day | Extremely fast small LLMs; no training on your data |
| **Google AI Studio (Gemini)** | ~1,500 requests/day | Generous limits; ⚠️ free-tier data may be used for training |
| **OpenRouter** | ~50–1,000 requests/day across free models | One key, many providers |
| **Cerebras** | ~1M tokens/day | Very fast inference |
| **Mistral** | Free tier (check terms) | ⚠️ training on by default — opt out |

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
