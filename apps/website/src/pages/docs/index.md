---
layout: ../../layouts/Doc.astro
title: Overview
description: WhisperFlow documentation — open-source, local-first AI voice dictation.
---

WhisperFlow turns your voice into polished text in any app, entirely on your own machine.
This documentation covers everything from your first dictation to swapping models and
hard-locking the app offline.

## The 30-second version

1. Install and allow microphone access.
2. Download a transcription model (and optionally a polish model) in the built-in manager —
   files come straight from HuggingFace.
3. Hold **Ctrl+Shift+Space**, speak, release. Polished text lands at your cursor.

## How it works

```
mic → 16 kHz PCM → VAD segmentation → whisper.cpp (STT)
     → personal dictionary correction → llama.cpp LLM polish (tone, formatting)
     → clipboard-safe paste into the focused app → local history
```

Every stage runs locally by default. The engine defines clean provider interfaces, so each
stage can also point at any OpenAI-compatible endpoint — unless you enable the local-only
lock, which makes network calls impossible.

## Where things live

| What            | Where                                          |
| --------------- | ---------------------------------------------- |
| Config          | `%APPDATA%/WhisperFlow/config.json`            |
| History         | `%APPDATA%/WhisperFlow/history.db` (SQLite)    |
| Models          | `%APPDATA%/WhisperFlow/models/`                |
| whisper.cpp bin | `%APPDATA%/WhisperFlow/bin/`                   |
| Logs            | `%APPDATA%/WhisperFlow/logs/`                  |

## Project

- Source: [github.com/whisperflow/whisperflow](https://github.com/whisperflow/whisperflow)
- License: Apache-2.0
- Status: v0.1 in active development (Windows)

Next: [Getting started](/docs/getting-started/)
