# WhisperFlow Architecture

This document is the **binding contract** for all code in this monorepo. Agents and
contributors must follow it. When reality changes, update this file in the same PR.

## Monorepo layout

```
whisperflow/
├── apps/
│   ├── desktop/                 # Electron app (main + preload + renderer)
│   │   ├── electron.vite.config.ts
│   │   ├── electron-builder.yml
│   │   ├── package.json
│   │   ├── resources/           # app icon, tray icons
│   │   └── src/
│   │       ├── main/            # MAIN PROCESS ONLY (node)
│   │       │   ├── index.ts     # app bootstrap, single-instance lock
│   │       │   ├── windows/     # WindowManager: overlay, settings, onboarding, capture
│   │       │   ├── tray/        # tray icon + menu
│   │       ├── hotkeys/         # global shortcut registration/rebinding
│   │       ├── ipc/             # typed IPC bridge (channels from @whisperflow/shared)
│   │       ├── audio/           # PCM relay: renderer capture → engine
│   │       ├── injection/       # Windows text injector (clipboard + SendInput)
│   │       └── lifecycle/       # autostart, updater wiring
│   │       └── renderer/        # React UI (see below)
│   └── website/                 # Astro static site
├── packages/
│   ├── shared/                  # @whisperflow/shared — pure types, zero deps (zod only)
│   │   └── src/
│   │       ├── ipc.ts           # channel names + payload types (THE IPC contract)
│   │       ├── config.ts        # WhisperFlowConfig zod schema + defaults
│   │       ├── models.ts        # ModelCatalogEntry, HardwareTier
│   │       ├── entities.ts      # TranscriptItem, DictionaryEntry, VoiceCommand…
│   │       └── events.ts        # DictationState machine types
│   └── engine/                  # @whisperflow/engine — the modular dictation engine
│       └── src/                 # PURE TS (node), ZERO electron imports — see below
└── docs/
```

## The engine package (the heart — keep it Electron-free)

`@whisperflow/engine` must never import `electron`. It runs inside the Electron main
process today; a future Tauri/Rust host can re-implement its contracts 1:1.

```
packages/engine/src/
├── orchestrator/DictationSession.ts   # state machine: idle→listening→transcribing→polishing→injecting→done|cancelled
├── audio/
│   ├── resampler.ts                   # 48k float → 16k float PCM
│   ├── vad/rms-vad.ts                 # energy VAD + endpointing (always available)
│   └── vad/silero-vad.ts              # optional onnxruntime-node upgrade (lazy import)
├── providers/
│   ├── stt/TranscriptionProvider.ts   # interface
│   ├── stt/WhisperCppProvider.ts      # sidecar process manager (whisper-cli)
│   ├── stt/OpenAICompatSttProvider.ts # v2 stub (BYO endpoint)
│   ├── polish/PolishProvider.ts       # interface
│   ├── polish/LocalLlamaProvider.ts   # node-llama-cpp
│   └── polish/RemoteOpenAIProvider.ts # BYO OpenAI-compatible endpoint
├── models/
│   ├── catalog.ts                     # curated HuggingFace catalog (see below)
│   ├── download.ts                    # resumable HF downloads + progress events
│   ├── tiering.ts                     # RAM/VRAM detection → recommended tier
│   └── paths.ts                       # userData/models layout
├── text/
│   ├── dictionary.ts                  # fuzzy post-STT correction (Levenshtein ≤ 2, tokens ≥ 4 chars)
│   ├── cleanup.ts                     # offline filler/punctuation fallback when polish disabled
│   ├── commands.ts                    # spoken phrase → action matching
│   └── promptBuilder.ts               # builds polish prompts (tone presets, app context, dictionary)
├── history/HistoryRepository.ts       # better-sqlite3, schema below
├── config/ConfigStore.ts              # zod-validated JSON persistence (path injected by host)
└── index.ts                           # createEngine({dirs, config, providers}) — public factory
```

### Provider interfaces (exact shapes)

```ts
interface TranscriptionProvider {
  readonly id: string; // "whispercpp-local" | "openai-compat"
  transcribe(audio: Float32Array /*16k mono*/, opts: TranscribeOpts): Promise<TranscriptResult>;
  partial?(audio: Float32Array): Promise<TranscriptResult | null>; // optional streaming
  dispose(): void;
}

interface PolishProvider {
  readonly id: string; // "llama-local" | "openai-compat"
  polish(input: PolishInput): AsyncIterable<PolishChunk>; // streams tokens
  dispose(): void;
}

interface PolishInput {
  raw: string; tone: ToneId; app?: string; language?: string;
  dictionary: string[]; instructions?: string; // custom user instructions
}
```

### Curated model catalog (HuggingFace)

| role | repo | file | size ≈ | tier |
|---|---|---|---|---|
| stt | `ggerganov/whisper.cpp` | `ggml-base.en.bin` | 148 MB | low (English) |
| stt | `ggerganov/whisper.cpp` | `ggml-small.bin` | 488 MB | mid (multilingual) |
| stt | `ggerganov/whisper.cpp` | `ggml-large-v3-turbo.bin` | 1.62 GB | high |
| polish | `Qwen/Qwen2.5-3B-Instruct-GGUF` | `qwen2.5-3b-instruct-q4_k_m.gguf` | ~2.0 GB | mid/high |
| polish | `Qwen/Qwen2.5-1.5B-Instruct-GGUF` | `qwen2.5-1.5b-instruct-q4_k_m.gguf` | ~1.0 GB | low |
| vad | `onnx-community/silero-vad` | `silero_vad.onnx` | ~2 MB | optional |

whisper.cpp **binaries** (sidecar) come from the official whisper.cpp GitHub release
`whisper-bin-x64.zip` (also downloaded on demand into `userData/bin/`). All URLs live in
`catalog.ts`; verify sizes/hashes at download time when the catalog lists them.

### Hardware tiering

- RAM < 8 GB → base.en + Qwen 1.5B (or polish disabled)
- 8–16 GB → small + Qwen 1.5B/3B
- \> 16 GB → large-v3-turbo + Qwen 3B

Tiering recommends; the user always overrides in Settings → Models.

## IPC contract (`@whisperflow/shared/src/ipc.ts`)

Channels (invoke unless marked **emit**):

- `dictation/toggle`, `dictation/start`, `dictation/stop`
- **emit** `dictation/state` — `{ state, partial?, error? }` (`DictationState` from events.ts)
- `settings/get` → `WhisperFlowConfig`, `settings/set(patch)` → config
- `history/list({query?, limit?})`, `history/delete(id)`, `history/clear()`
- `dictionary/list|add|update|delete`, `commands/list|add|update|delete`
- `models/catalog()`, `models/status()`, `models/download(id)` , **emit** `models/progress`, `models/delete(id)`, `models/setActive(role, id)`
- `audio/devices()` — enumerate input devices (renderer mediaDevices passthrough)
- `app/openSettings(tab?)`, `app/quit()`, `app/version()`
- **emit** `capture/pcm` — renderer → main Float32Array chunks (transferable)

Preload exposes a single typed `window.whisperflow` API via `contextBridge`; renderer
never calls `ipcRenderer` directly.

## Dictation data flow

```
[hotkey] → main: DictationSession.start()
renderer capture window (hidden): getUserMedia(48k) → AudioWorklet → 16k PCM
      → ipc capture/pcm → engine VAD (segment buffering, silence endpoint 700ms)
      → WhisperCppProvider.transcribe(segment)   → partial → overlay (emit dictation/state)
[silence or hotkey release] → final transcript
      → dictionary.fuzzyCorrect → PolishProvider.polish (or text/cleanup fallback)
      → final text → history saved → WindowsInjector.inject (clipboard + Ctrl+V + restore)
```

Overlay window: frameless, transparent, alwaysOnTop (screen-saver level), skipTaskbar,
hidden when idle; positioned near caret/cursor; states: `listening` (waveform + partials),
`transcribing`, `polishing`, `error`, `dismissed` (Esc cancels without injecting).

## Config schema (zod, `shared/src/config.ts`)

```ts
{
  hotkey: { pushToTalk: "Control+Shift+Space", toggleMode: false },
  audio: { deviceId: "default", vad: { kind: "rms" | "silero", sensitivity: 0.5, silenceMs: 700 } },
  stt: { provider: "whispercpp-local", modelId: "whisper-small", language: "auto" },
  polish: { provider: "llama-local" | "openai-compat" | "none", modelId: "qwen2.5-3b-instruct-q4",
            temperature: 0.2, tone: "neutral", customInstructions: "",
            remote: { baseUrl: "", apiKey: "", model: "" } },
  dictionary: [ { id, term, pronunciation?, hint? } ],
  commands: [ { id, phrase, action: "undo" | "insert" | "replace", payload? } ],
  privacy: { localOnly: true },   // true ⇒ remote providers hard-blocked
  general: { launchAtLogin: true, historyEnabled: true, overlayFollowsCursor: true },
  updates: { channel: "stable" }
}
```

## Storage

`userData` = `%APPDATA%/WhisperFlow` (Electron `app.getPath("userData")`, overridden in
dev + tests via engine factory injection):

- `config.json` — ConfigStore
- `history.db` — SQLite:
  `transcripts(id TEXT PK, created_at INTEGER, app TEXT, raw_text TEXT, final_text TEXT, duration_ms INTEGER, stt_model TEXT, polish_model TEXT)`
- `models/` — GGML/GGUF downloads (`<repo-slug>/<file>`)
- `bin/` — whisper.cpp sidecar binaries
- `logs/` — rotating daily logs (electron-log or minimal pino; keep deps lean)

## Desktop app (apps/desktop)

- electron-vite + electron-builder (NSIS, x64). productName `WhisperFlow`, appId `dev.whisperflow.desktop`, artifact `WhisperFlow-Setup-<v>.exe`.
- Renderer: React 19 + TypeScript + Tailwind CSS 4 + Zustand. Two HTML entries: `settings.html` (settings + history + onboarding routes) and `overlay.html` (overlay + hidden capture logic).
- Auto-update: electron-updater wired but **inert** until `publish` config points at a real GitHub repo (placeholder `whisperflow/whisperflow`).
- Native-adjacent things done WITHOUT native modules: hotkeys (`globalShortcut`), injection (PowerShell SendInput child process + Electron clipboard with clipboard save/restore), audio (renderer WebAudio).

## Website (apps/website)

Astro static output. Original design system (dark, minimal, one accent), pages:
`/` (hero: local-first pitch + download CTA), `/features`, `/download`, `/docs`
(index + getting-started + hotkeys + models + privacy), `/pricing` (Free forever core;
"WhisperFlow Cloud — coming soon"), `/sponsors`. No copied copy, no copied assets.

## Testing & quality gates

- vitest everywhere. Engine units required: VAD segmentation, resampler, dictionary
  fuzzy matcher, command parser, prompt builder, config schema round-trip, catalog
  integrity. Renderer: component smoke tests for overlay + settings tabs.
- `npm run typecheck` strict-clean across all workspaces.
- CI (`.github/workflows/ci.yml`): quality (typecheck+test, ubuntu), website build,
  desktop Windows build (artifact upload).

## Coding standards

- TypeScript strict, ESM, no `any`. Named exports. JSDoc on public engine APIs.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Every workspace: `typecheck` + `test` + `build` npm scripts (no-op allowed where
  meaningless, e.g. shared's build = `tsc`).
