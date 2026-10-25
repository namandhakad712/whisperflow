# Changelog

All notable changes to WhisperFlow. Format: [Keep a Changelog](https://keepachangelog.com), SemVer.

## [Unreleased]

### Added
- Desktop app: full dictation loop — global toggle hotkey, floating overlay (waveform, streaming partials, Esc cancel), clipboard-safe paste injection with snapshot/restore
- Settings hub in the measured reference layout: collapsible 192px rail, cream top-bar pills, 11 sections (Dictation, Audio, Models, Dictionary, Snippets, Style, History, Insights, Scratchpad, Shortcuts, Privacy, Help)
- Three design systems: Nocturne (dark), Dawn (light), Classic (reference-measured) — switchable live
- Engine (`@whisperflow/engine`, Electron-free): RMS VAD with adaptive noise floor, 48k→16k resampling, whisper.cpp sidecar STT, llama.cpp polish + BYO OpenAI-compatible endpoint + offline cleanup fallback, fuzzy personal dictionary, voice commands ("scratch that" built-in), HuggingFace model manager (resumable downloads, hardware tiering), local history store
- Onboarding: skip-ahead card, mic test, full ASR configuration board (language, model w/ RAM suggestion, sensitivity, polish), guided downloads
- Insights: local stats (counts, words today/all-time, 7-day bars)
- Scratchpad: local quick notes
- Website: Nocturne marketing site — home, features, download, pricing, sponsors, docs, 404; deployed to GitHub Pages
- CI: typecheck + tests + website + desktop builds; Pages deploy workflow
- Docs: architecture, parity matrix, reference-app analysis (live CDP evidence), model research brief

### Security
- Zero telemetry, local-only network lock enforced at the provider layer
