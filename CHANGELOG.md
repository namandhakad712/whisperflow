# Changelog

All notable changes to WhisperFlow. Format: [Keep a Changelog](https://keepachangelog.com), SemVer.

## [0.1.3] — 2026-10-27

### Fixed — the shipped overlay had no styling at all
- **The dictation overlay rendered unstyled in every released build.** The overlay entry never
  imported `styles.css`, so the built `overlay.html` linked no stylesheet — every class was inert.
  Found by screenshotting the actual built page (new `scripts/overlay-shots.cjs` harness that
  captures every state); fixed by importing the stylesheet.

### Changed — overlay redesigned to the reference app's design language
- Extracted from the shipped Wispr Flow bundle: panel geometry **500×420** (min 300×200,
  expandable to 920×660), palette `vast-950 #1a1a1a` / `sand-50 #fcfcfb` with a white accent, and
  the **transcript as the hero element** (19 px, large waveform, status header, footer hint).
  Verified visually in all five states (listening, transcribing, done, error, recording+typing).
- Replicated their settings surface: AI-formatting master toggle + cleanup strength
  (`polish.enabled` / `polish.cleanup` off-light-strong driving the model prompt), a hard
  `audio.maxRecordingLengthMs` dictation cap, and the overlay now actually uses the mic chosen in
  Audio settings (previously silently ignored).
- Per-dictation **app attribution** (`system/foreground.ts`) and **daily config/history backups**
  with 7-day rotation, matching the reference app's data-safety pattern.
- Injection hardened: paste failures surface their stderr (e.g. UIPI "Access is denied"), and when
  a paste cannot be delivered the text stays on the clipboard with an actionable message instead
  of being restored away and lost. The uiohook-based Ctrl+V was tried, verified to deliver nothing,
  and dropped — documented in code.

## [0.1.2] — 2026-10-26

### Added — real hold-to-talk
- **Press and hold to dictate.** Electron's global shortcuts only fire on key-down, so true
  push-to-talk needed an OS-level keyboard hook (`uiohook-napi`, MIT, bundled). Hold the hotkey to
  record, release to finish and polish.
- **Typing detection.** Type a correction mid-dictation and the session holds open; the overlay
  says `⌨ typing — dictation held`. The hook watches the configured combination only — keystrokes
  are counted as booleans, never recorded, stored, or sent.
- **Honest fallback.** If the hook can't load, the setting reports why and the app keeps working in
  toggle mode. No silent breakage.
- **Real Import buttons.** Dictionary imports word lists (`.txt`/`.csv`, one term per line,
  `word → replacement` supported); Snippets import JSON arrays of `{phrase, action, payload}` —
  both report how many landed and survive malformed files.

### Fixed
- **Local transcription returned empty text.** The whisper.cpp sidecar ships both `whisper-cli.exe`
  and the legacy `main.exe`, and the binary picker grabbed `main.exe`, which ignores `-oj` (JSON
  output). Now ranked by preference; caught by the new end-to-end STT verification script, which
  drives the real production path (download sidecar → extract → download model → transcribe the
  jfk.wav sample) and passes.
- **Auto-update was broken in every packaged build**, twice over:
  1. electron-updater exports `autoUpdater` as an `Object.defineProperty` *getter*, invisible to
     Node's ESM named exports — `const { autoUpdater } = await import(...)` destructured `undefined`
     and the updater threw before the first check. Dev builds skip the updater entirely, so only a
     *packaged* run revealed it. Resolved through the CJS default export, with a descriptive error
     if the shape ever changes.
  2. electron-builder writes `resources/app-update.yml` only when it publishes; the releases are
     uploaded separately, so the packaged app had no provider config and the *download* step
     crashed. The release workflow now injects it (two-phase build), and the updater also calls
     `setFeedURL` at runtime as a belt-and-braces fallback.
- **Release pipeline.** The workflow was missing the `electron-vite build` step (empty asar), and
  electron-builder silently dropped the 400 MB installer upload — releases now build with
  `--publish never` and upload assets explicitly with `fail_on_unmatched_files`.
- v0.1.2's first build attempt failed in CI on a UTF-8 BOM + mangled `package.json`; repaired and
  the exact CI build command passes locally.

## [0.1.1] — 2026-10-26

### Added — release pipeline & auto-update
- **Auto-update actually works now.** Releases publish as non-draft GitHub Releases with
  `latest.yml` + `.blockmap`, so installed apps check at launch + every 6 hours and download
  **only the changed blocks** between versions (differential updates), then install on quit.
- **Update banner**: "vX is ready — restart to finish installing" with a one-click restart.
- **Update channel** setting (Stable / Beta) in Privacy — the updater follows it.
- **Release workflow** (`release.yml`): pushing a `v*` tag builds the Windows installer on CI and
  publishes the release + update feed automatically.

### Added — production maturity
- **Backup import** — restore config and merge history from an exported backup (existing entries
  are never duplicated).
- **Native pickers** — Browse… buttons for the overlay backdrop and the recordings folder.
- **Diagnostics** in Help — open the log folder or the whole data folder.
- **Search** on Dictionary and Snippets (parity gap closed).

### Fixed
- Docs pages were unreadable in dark mode (Tailwind prose grays on the near-black Nocturne page).
- Two licence bugs in the shipped catalog: `whisper-base.en` / `whisper-small` said Apache-2.0;
  Whisper is MIT.
- Cloud STT transcribed nothing (the session gated segments on a local model path, which cloud
  adapters never have).

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
