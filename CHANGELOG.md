# Changelog

All notable changes to WhisperFlow. Format: [Keep a Changelog](https://keepachangelog.com), SemVer.

## [Unreleased]

### Added
- **Mistral Voxtral in the cloud STT presets** — `voxtral-mini-transcribe-3-0` at $0.0035/min
  (~$0.21/hour), 50+ languages, diarization/context-biasing capable; free-mode quota is
  explicitly marked "check your console" because Mistral publishes none.
- **Explicit STT fallback chain** (`stt.fallback`: none | local | cloud). Off by default so audio
  never leaves the machine by surprise; when enabled, a failed segment is retried on the other
  engine and the fallback is logged.
- **Polish fallback** (`polish.fallbackToLocal`) — a failing remote endpoint retries on the local
  GGUF before dropping to offline cleanup.
- **Model lifecycle**: deleting a custom model also removes it from the catalog, plus a
  "Remove unused" disk-cleanup action that deletes downloaded models nothing points at.
- **Best-practices card** on the Models page (model sizing, one-per-role, local-only lock, warm-up
  latency, post-switch test, dictionary size).
- Per-provider verified metadata (`freeNote`, `verified` date, docs link) shown in the cloud STT
  card so limits read as dated facts rather than evergreen claims.

### Fixed
- **Cloud STT transcribed nothing**: the session skipped every segment whose `modelPathFor()` was
  null, which is exactly what cloud adapters return. Adapters now declare readiness explicitly.
- **Docs were unreadable in dark mode** — Tailwind Typography's light-mode grays are now bound to
  the site's own Nocturne/Dawn tokens (body, headings, links, code, tables, quotes).
- **Licence errors in the shipped catalog**: `whisper-base-en` and `whisper-small` said Apache-2.0;
  Whisper is **MIT** (Whisper large v3 turbo was already correct, so the file contradicted itself).
- Dead provider ids removed after the 2026-10-26 audit: Groq's `distil-whisper-large-v3-en` (does
  not exist), OpenAI's `whisper-1` deprecated in favour of `gpt-transcribe` (shutdown 2027-02-26).
- Unverifiable marketing numbers dropped: Qwen3.5 IFEval/language claims, Gemini's "1,500 req/day"
  (that figure is Search-grounding RPD), Cerebras listed as free (their FAQ says it has no
  permanent free tier), Mistral's "$10/month free credit" (no official source — now described as
  reported-and-unconfirmed, ~47 hours if it holds).
- **Cloud STT (BYOK)** — Groq (generous free tier, ~2,000 req/day), OpenAI, or any
  OpenAI-compatible `/audio/transcriptions` endpoint; onboarding offers it as an engine choice,
  Models tab has provider/model/key config with a "Test key" probe. Blocked by the local-only
  lock like every network provider.
- **Meeting mode** — keeps the session open across pauses and pastes each utterance the moment
  it's transcribed (meetings, lectures, interviews). Overlay → Overlay tab or Settings.
- **Recorder** — "Start recorder…" in the tray runs meeting mode and saves the WAV next to the
  transcript; `Save dictation audio` saves every turn. History entries get a ▶ Play button.
- **Dedicated Overlay tab** — shape (pill/rect/blob), position (cursor/top/bottom), custom
  backdrop, meeting mode, audio saving, with a live preview; overlay re-reads config the moment
  it changes (no relaunch).
- **Models tab rebuild** — PC hardware card (CPU/cores/RAM/GPU + tier), "Recommended for this
  PC" set ranked by tier, one-click "Download recommended set", decluttered list with "Show all",
  custom-model form (any HF GGML/GGUF), auto-set-active after the first download of each role.
- **Setup checklist live-ticks** — bound to download progress events; engine and model are now
  separate steps; switching to cloud STT satisfies both.
- Desktop app: full dictation loop — global toggle hotkey, floating overlay (waveform, streaming partials, Esc cancel), clipboard-safe paste injection with snapshot/restore
- Settings hub in the measured reference layout: collapsible 192px rail, cream top-bar pills, 12 sections (Dictation, Audio, Models, Overlay, Dictionary, Snippets, Style, History, Insights, Scratchpad, Shortcuts, Privacy, Help)
- Three design systems: Nocturne (dark), Dawn (light), Classic (reference-measured) — switchable live
- Engine (`@whisperflow/engine`, Electron-free): RMS VAD with adaptive noise floor, 48k→16k resampling, whisper.cpp sidecar STT, llama.cpp polish + BYO OpenAI-compatible endpoint + offline cleanup fallback, fuzzy personal dictionary, voice commands ("scratch that" built-in), HuggingFace model manager (resumable downloads, hardware tiering, custom catalog), local history store with optional audio paths
- Onboarding: skip-ahead card, mic test, full ASR configuration board (engine source, language, model w/ RAM suggestion, sensitivity, polish), guided downloads
- Insights: local stats (counts, words today/all-time, 7-day bars)
- Scratchpad: local quick notes
- Website: Nocturne marketing site — home, features, download, pricing, sponsors, docs, 404; deployed to GitHub Pages
- CI: typecheck + tests + website + desktop builds; Pages deploy workflow
- Docs: architecture, parity matrix, reference-app analysis (live CDP evidence), model research, free-tier census (polish + STT)

### Fixed
- Toggle switches: knob could escape the track and vanished on the Classic ink track —
  repositioned with explicit offsets and a theme-proof knob.
- Model downloads: aria2 fast-path reported progress correctly (pass totalBytes through);
  first download of each role now auto-activates instead of requiring a manual "Set active".

### Security
- Zero telemetry, local-only network lock enforced at the provider layer (now covers STT too)
