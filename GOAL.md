# WhisperFlow — Project Goal & Locked Decisions

> Open-source, local-first AI voice dictation. Your voice, your models, your machine.
> An independent, clean-room alternative in the spirit of Wispr Flow — but free (as in freedom AND as in beer), offline-capable, and running on open models from HuggingFace.

## Mission

Wispr Flow proved the category: push a key, speak, get polished text in any app.
It also proved the pain points: cloud-only audio processing, word-count caps on the
free tier (2,000 words/week), closed source. WhisperFlow removes all three:

- **Local-first** — transcription and AI polish run on your machine (whisper.cpp + llama.cpp, GGUF models from HuggingFace).
- **No caps, ever** — unlimited words; your hardware is the limit.
- **Freedom** — Apache-2.0, modular engine, pluggable providers. Bring your own models, or your own cloud endpoint if you want one.

## Locked decisions (2026-10-25, by repo owner)

| Decision            | Choice                                              |
| ------------------- | --------------------------------------------------- |
| Product name        | **WhisperFlow**                                      |
| Type                | Desktop app (Windows first) + marketing/docs website |
| Desktop stack       | **Electron** (latest stable) + strictly modular TS engine, future Tauri port stays open |
| STT                 | whisper.cpp sidecar (prebuilt binaries, GGML models from HuggingFace) |
| LLM polish          | node-llama-cpp with GGUF from HuggingFace (default: Qwen 2.5 3B Instruct); optional BYO OpenAI-compatible endpoint |
| VAD                 | RMS energy (pure TS, always works) + optional Silero ONNX upgrade |
| Audio capture       | Renderer-side `getUserMedia` + AudioWorklet → PCM over IPC (zero native deps) |
| Text injection      | Clipboard + synthesized paste (PowerShell SendInput), clipboard restore |
| Storage             | JSON config (zod-validated) + SQLite history (better-sqlite3) |
| Website             | Astro, static, original design                       |
| License             | Apache-2.0                                           |
| Monetization model  | Open-core: free core forever; future optional hosted "WhisperFlow Cloud", GitHub Sponsors, Pro builds — no word caps in the core, ever |
| Telemetry           | **None.** No telemetry code ships in v1.             |

## v1 scope (this build)

**In:**
- Global push-to-talk hotkey (default `Control+Shift+Space`, rebindable) + optional toggle mode
- Floating dictation overlay (waveform → partial transcript → polish spinner → insert)
- Streaming transcription with silence endpointing (VAD), partial results in overlay
- AI polish: filler removal, punctuation, formatting; tone presets (Neutral / Casual / Professional / Custom)
- Personal dictionary with fuzzy post-STT correction + LLM context injection
- Voice commands (configurable phrase → action; ships with "scratch that" undo)
- Transcript history with search, delete, clear (local SQLite)
- Model manager: curated HuggingFace catalog, hardware-tiered recommendation, download with progress/resume, delete, active model switching
- App-integration: works in any app via global paste; per-app settings (v1: remember last app; special-casing v2)
- Onboarding wizard (mic permission → model download → hotkey test)
- Settings app: General / Shortcuts / Audio / Models / Dictionary / Commands / Privacy / Advanced / About
- Privacy: "local-only" mode hard-blocks all network providers
- Website: home, features, download, docs, pricing (Free + Cloud-coming-soon), sponsors
- CI: typecheck + unit tests + website build + Windows desktop build
- Packaging: NSIS installer + auto-update wiring (activates when a public repo exists)

**Out of v1 (roadmap):**
- macOS/Linux builds (code is written cross-platform where cheap; packaging later)
- Notetaker-style features, mobile apps
- Whisper streaming server mode, per-app injection profiles, cloud sync
- FTS5 full-text search over history

## Definition of done

1. `npm install` at root; `npm run typecheck`, `npm run test`, `npm run build` all green.
2. Desktop app launches (`npm run dev` in `apps/desktop`): tray icon, hotkey opens overlay, mic captures, engine transcribes (once a model is downloaded), polish runs, text injects into Notepad.
3. Website builds and renders all pages.
4. Every analysis doc lives in `docs/analysis/`; architecture doc matches reality.
5. Git history: clean conventional commits; repo pushes cleanly to any remote.

## Legal posture

- Clean-room: no Wispr Flow code, assets, prompts, or marketing copy. Analysis docs contain facts (endpoints, config shapes, behavior) for interoperability understanding only — paraphrased, not copied.
- Not affiliated with, endorsed by, or connected to Wispr Inc.
- "WhisperFlow" = two generic English words; we run open Whisper-family models. Distinct brand, original identity.
