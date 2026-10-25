---
layout: ../../layouts/Doc.astro
title: Getting started
description: Install WhisperFlow from source, download models, and make your first dictation.
---

## Requirements

- Windows 10/11 (x64) — macOS/Linux packaging is on the roadmap
- [Node.js](https://nodejs.org) ≥ 20
- A microphone
- ~1–4 GB disk for models, depending on the tier you pick

## Run from source

```bash
git clone https://github.com/namandhakad712/whisperflow.git
cd whisperflow
npm install
npm run dev
```

The app starts in the system tray. First launch opens the onboarding wizard:

1. **Microphone** — pick your input device and say a test phrase.
2. **Models** — the manager recommends a tier based on your RAM. Accept it or choose
   manually; downloads are resumable and cached in `%APPDATA%/WhisperFlow/models`.
3. **Hotkey** — confirm the default **Ctrl+Shift+Space** works, or rebind it now.

## Your first dictation

1. Click into any text field — Notepad works fine.
2. Hold the hotkey, speak a couple of sentences naturally, release.
3. The overlay shows the transcript while you speak, then a brief polish spinner, then the
   final text is pasted at your cursor.

Press **Esc** while the overlay is up to cancel — nothing gets pasted.

## Troubleshooting

- **No text pasted** — some elevated/admin apps block synthetic input. Run WhisperFlow and
  the target app at the same privilege level.
- **Words run together** — raise VAD silence timeout in Settings → Audio.
- **Names misheard** — add them in Settings → Dictionary; correction applies on the next
  dictation.
- **Slow first response** — the first run loads the model into RAM; subsequent dictations
  reuse it.

Next: [Hotkeys & overlay](/docs/hotkeys/)
