# Wispr Flow 1.6.1264 — reverse-engineering corpus

Eight parallel extraction passes over the user's own installed build
(`C:\Users\naman\AppData\Local\WisprFlow\app-1.6.1264\`, tree unpacked at
`C:\Users\naman\AppData\Local\Temp\wf-re\`), all read-only. Every claim is
grounded in the shipped artifacts: the 9.7 MB main bundle, ten renderer
bundles, 177 readable Sequelize migrations (the complete schema history), the
readable `resources/ax-inspect-*.mjs` dev tools, Squirrel update logs, and the
live `flow.sqlite` (72 MB, at `C:\Users\naman\AppData\Roaming\Wispr Flow\`).

| # | Subsystem | File | What we learned |
|---|-----------|------|-----------------|
| 01 | App/context detection | [01-app-detection.md](01-app-detection.md) | Native helper IPC (`GetActiveAppInfo`/`GetTextBoxInfo`), the `AppType` taxonomy, the verbatim WINDOWS_*_PROCESS_NAME lists, and every per-app behavior (email signature, messaging period-stripping, AI-app cleanup skip) |
| 02 | Overlay + status windows | [02-overlay-status-windows.md](02-overlay-status-windows.md) | Exact `BrowserWindow` flags, the 18-state Flow Bar state machine, timer constants (150/400/600/2000/6000/6e5), dock-edge + drag, click-through via measured alpha rects (≤512), framer-motion springs |
| 03 | Data model | [03-data-model.md](03-data-model.md) | All 27 tables reconstructed from 176 migrations: History's 60+ columns, Notes/Versions/Images, Dictionary+Snippets, Meetings/Todos/Automations, Links, Polish, InstructHistory, UsageOutbox, retention enums |
| 04 | Meetings/notetaker | [04-meetings-notetaker.md](04-meetings-notetaker.md) | Detection (calendar + process/URL classifier), two-leg PCM capture, `setDisplayMediaRequestHandler({audio:"loopback"})`, speaker attribution enums/UIA polling, Soniox refine, local-vs-cloud split |
| 05 | Updater + persistence | [05-updater-persistence.md](05-updater-persistence.md) | Squirrel chain against `dl.wisprflow.com`, poll cadence and backoff constants, the 3-hour "A new version is ready" ceiling, shortcut/Startup handling, daily-noon SQLite backup, PostHog flags |
| 06 | Injection + learning loop | [06-injection-learning.md](06-injection-learning.md) | The `roots.exe` paste pipeline, `PasteOutcome`/`PasteAnalytics`, verification verdicts, keystroke trace, normalized edit distance, the dictionary auto-learn pipeline (`parseAlignmentSteps`, 4-candidate cap, undo tokens) |
| 07 | Settings + formatting | [07-settings-formatting.md](07-settings-formatting.md) | All 187 settings keys with defaults, the language model, the 4-name transcription-format enum, the 5-level cleanup enum, command mode + wake words, the full default shortcut map, the userVoices/Styles model |
| 08 | Audio + input | [08-audio-input.md](08-audio-input.md) | 16 kHz mono AEC/NS/AGC-off capture, worklet chunking (640 samples), WebCodecs opus vs libopus/OGG workers, device ranked resolution, silence thresholds, 20-min cap, PTT/POPO/mouse-flow state machines |

## Cross-cutting facts that shaped what we built

- **The "dictation bubble" IS the status window.** The window named "overlay"
  in their build is an *extension-panel host*. Their visible Flow Bar is a
  docked, click-through, framer-motion-animated status window with an 18-state
  machine. (We replicated the panel geometry and flags before we knew this; the
  state machine is the next port.)
- **Everything text-related is native-IPC'd through `roots.exe`** — clipboard
  write + keystroke synthesis + UIA textbox reads all live in one 82 KB binary
  with a JSON-over-stdio contract (`PasteText`, `SimulateKeyPress`,
  `GetTextBoxInfo`, `DictatedTextVerification`). The bundles expose only the
  contract, not the primitives. That is the single biggest gap between us and
  them: our paste is SendKeys+clipboard, our textbox reads are PowerShell
  window-title only.
- **The learning loop is real and local-ish.** They watch the target field for
  60 s after each paste, extract the edited text, keep a normalized Levenshtein
  to the dictated text, bump dictionary `frequencyUsed`, and auto-learn up to 4
  candidate corrections per dictation (`shouldAutoLearnWords`, default **true**),
  with an undo token map (max 50).
- **Their settings store has 187 keys**, mirrored byte-identically across main
  and every renderer. The meaningful deltas vs ours: transcription **format
  enum** ("Apply AI formatting" / "No AI formatting" / "Casual messaging" /
  "All lowercase"), cleanup levels **none/light/medium/high/full**, per-app
  **styles** (userVoices), language model (selected vs effective vs used),
  `localDataPolicy` retention, and ~40 notetaker prefs.
- **Their dictation audio path is deliberately raw**: 16 kHz mono with all
  browser DSP off, 640-sample worklet chunks, WebCodecs opus at 64 kbps, and a
  hard 20-minute cap with a 19-minute warning.
- **What we cannot replicate (and won't fake)**: the Soniox/wispr-chorus
  meeting transcription and diarization, the server classifier behind
  word-learning and instruct routing, calendar connectors, share/automations,
  and `roots.exe`'s exact primitives. See each report's "cannot determine".

## What this drove in WhisperFlow

Implemented from this corpus (see CHANGELOG):
- app-type classification with their verbatim process-name lists, feeding
  per-app formatting (email signature, messaging trailing-period, AI-app
  cleanup skip) — [01] + [07]
- app classification now uses the **real browser URL** via a resident UIA
  probe (`system/uia.ts`, their `GetActiveAppInfo`/`GetTextBoxInfo` contracts) — [01]
- meeting-platform detection from process names and window titles — [01]/[04]
- dictation capture switched to 16 kHz mono with AEC/NS/AGC off — [08]
- transcription **format enum** + **5-level cleanup** + 20-minute cap with a
  one-minute warning — [07]/[08]
- the **post-paste learning loop**: observe the box for 60 s,
  `editDistanceToDictated` (normalized Levenshtein), anchored-region
  extraction, dictionary **auto-learn** (`shouldAutoLearnWords`), phrase
  frequency counts, email-signature eligibility — [06]
- the **language model** (`selectedLanguages` + auto-detect toggle +
  `effectiveLanguages` override, their exact resolution rule) — [07]
- the **unresponsive-surface recovery ladder** (invalidate → hide+show →
  rebuild, their backoff and dictation deferral) on the overlay and settings
  windows — [02]
- the **per-action shortcut map**: `paste_last_text` / `copy_last_text` with
  their Windows defaults (Shift+Alt+Z / Shift+Alt+X), rebindable in Settings —
  [07]
- the **persistent docked resting bar** (their flow-bar rest dash): a 30×6
  edge-docked click-through dash that morphs into the mini dictation pill on
  hover (their exact rest/mini geometry and spring easing), driven by
  `general.dockEdge` (none/left/right/bottom) — [02]. Meeting mode itself is
  shipped (session held across pauses, per-utterance insertion), but the
  overlay has no dedicated meeting-state pill yet — see the backlog.
- daily backups, per-dictation app attribution, paste failure surfacing —
  [03]/[05]/[06]

Remaining backlog (in priority order):

1. **The 18-state Flow Bar state machine, as such** [02] — our overlay covers
   the equivalent states (rest/mini/card/l4, generating shimmer), but their
   full state names and transition tables aren't ported 1:1. Port the names
   and the timer constants (150/400/600/2000/6000/6e5) so behavior — not just
   geometry — matches.
2. **The meeting-mode pill** [02]/[04] — their state machine has dedicated
   meeting/recording pill states; ours runs meeting mode through the ordinary
   dictation pill.
3. **A native UIA paste write-path** [06] — moving the paste itself from
   SendKeys+clipboard onto a UIA insertion path, analogous to their
   `roots.exe`. Verification is already ported (`matchesBeforePasteAndAfter`
   in `editDistance.ts`); the write is what's missing.

In flight (parallel work, not from this corpus): slimming the ~400 MB Windows
installer, and a re-audit of the cloud STT/polish presets in
`packages/shared/src/config.ts` (per-provider limits re-verified 2026-10-29,
dead ids and unverifiable marketing numbers dropped).
