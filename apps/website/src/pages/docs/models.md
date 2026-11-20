---
layout: ../../layouts/Doc.astro
title: Models & hardware
description: The curated HuggingFace model catalog, hardware tiers, cloud STT, and custom models.
---

WhisperFlow ships with a curated model catalog. Everything downloads straight from
HuggingFace (models) and the whisper.cpp project (sidecar binaries) — no accounts, no
bundled multi-GB installer. The Models tab shows your exact CPU, RAM, and GPU and ranks
the catalog for your machine.

## Transcription (local whisper.cpp)

| Model                        | Size   | Languages    | Recommended RAM |
| ---------------------------- | ------ | ------------ | --------------- |
| `whisper-base.en`            | 148 MB | English      | 4 GB+           |
| `whisper-small`              | 488 MB | Multilingual | 8 GB+           |
| `whisper-large-v3-turbo-q5_0`| 574 MB | Multilingual | 8 GB+           |
| `whisper-large-v3-turbo`     | 1.6 GB | Multilingual | 16 GB+          |

Language can be pinned per-dictation or left on auto-detect.

## Transcription (cloud, BYO key)

Prefer zero downloads? Point transcription at a cloud endpoint instead:
**Settings → Models → Transcription engine → BYO cloud**. Then pick a provider:

- **Groq** — free tier, `whisper-large-v3-turbo` (20 RPM, ~2,000 req/day, 7,200 audio-sec/hour)
- **Mistral** — `voxtral-mini-transcribe-3-0` at **$0.0035/min** (~$0.21/hour); free-mode quota is
  only visible in your Mistral console
- **OpenAI** — `gpt-transcribe` (`whisper-1` is deprecated, shutdown 2027-02-26)
- **Custom** — anything that speaks `POST /audio/transcriptions` and returns `{ text }`

See [free AI options](/whisperflow/docs/free-ai/) for the dated limits. Blocked when the local-only
lock is on. You can also set a **fallback engine** (Models → "If the engine fails") so a cloud
outage retries on local whisper.cpp — or leave it off so nothing ever leaves the machine by surprise.

## Polish (llama.cpp, GGUF)

| Model                        | Size   | Notes                              |
| ---------------------------- | ------ | ---------------------------------- |
| Qwen 3.5 2B (Q4_K_M)         | 1.3 GB | Low-RAM machines                   |
| Qwen 3.5 4B (Q4_K_M)         | 2.7 GB | Default — best speed/quality       |

Polish can also be turned off entirely; a lightweight offline cleanup (filler removal,
punctuation) still runs.

## Hardware tiers

The model manager reads your RAM and suggests a tier, but you always override:

- **Light (< 8 GB RAM)** — base.en + Qwen 3.5 2B, or no polish
- **Standard (8–16 GB)** — small + Qwen 3.5 4B
- **Power (16 GB+)** — large-v3-turbo + Qwen 3.5 4B

Models are cached in `%APPDATA%/WhisperFlow/models` — delete from Settings → Models to
reclaim disk.

## Custom models

Any HuggingFace GGML (transcription) or GGUF (polish) file can be added:
**Settings → Models → “+ Add a custom model from HuggingFace”**. Give it a repo + file name
and it downloads, appears in the catalog, and behaves exactly like the built-ins.

## Bringing your own endpoint (polish)

Settings → Style accepts any OpenAI-compatible endpoint (base URL, API key, model) for
polish. This is off by default and blocked entirely when the local-only lock is enabled.

Next: [Privacy & data](/whisperflow/docs/privacy/)
