---
layout: ../../layouts/Doc.astro
title: Models & hardware
description: The curated HuggingFace model catalog, hardware tiers, and swapping providers.
---

WhisperFlow ships with a curated model catalog. Everything downloads straight from
HuggingFace (models) and the whisper.cpp project (sidecar binaries) — no accounts, no
bundled multi-GB installer.

## Transcription (whisper.cpp)

| Model                   | Size   | Languages   | Recommended RAM |
| ----------------------- | ------ | ----------- | --------------- |
| `whisper-base.en`       | 148 MB | English     | 4 GB+           |
| `whisper-small`         | 488 MB | Multilingual| 8 GB+           |
| `whisper-large-v3-turbo`| 1.6 GB | Multilingual| 16 GB+          |

Language can be pinned per-dictation or left on auto-detect.

## Polish (llama.cpp, GGUF)

| Model                          | Size   | Notes                        |
| ------------------------------ | ------ | ---------------------------- |
| Qwen 2.5 1.5B Instruct (Q4_K_M)| ~1 GB  | Low-RAM machines             |
| Qwen 2.5 3B Instruct (Q4_K_M)  | ~2 GB  | Default — best speed/quality |

Polish can also be turned off entirely; a lightweight offline cleanup (filler removal,
punctuation) still runs.

## Hardware tiers

The model manager reads your RAM and suggests a tier, but you always override:

- **Low (< 8 GB RAM)** — base.en + Qwen 1.5B, or no polish
- **Mid (8–16 GB)** — small + Qwen 1.5B/3B
- **High (16 GB+)** — large-v3-turbo + Qwen 3B

Models are cached in `%APPDATA%/WhisperFlow/models` — delete from Settings → Models to
reclaim disk.

## Bringing your own endpoint

Settings → Advanced accepts any OpenAI-compatible endpoint (base URL, API key, model) for
polish. This is off by default and blocked entirely when the local-only lock is enabled.

Next: [Privacy & data](/docs/privacy/)
