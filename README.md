<p align="center">
  <img src="docs/assets/logo-animated.svg" alt="WhisperFlow" width="300" />
</p>

<h1 align="center">WhisperFlow</h1>

<p align="center">
  <img src="docs/assets/voice-line.svg" alt="hold · speak · polished text" width="560" />
</p>

<p align="center">
  <strong>Open-source, local-first voice dictation.<br />Your voice, your models, your machine.</strong>
</p>

<p align="center">
  <a href="#license"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-2952E3?style=flat-square"></a>
  <a href="https://namandhakad712.github.io/whisperflow/"><img alt="Site" src="https://img.shields.io/badge/site-live-8FB0FF?style=flat-square"></a>
  <img alt="Telemetry" src="https://img.shields.io/badge/telemetry-none-1a1a1a?style=flat-square">
  <img alt="Word caps" src="https://img.shields.io/badge/word%20caps-none-DB704C?style=flat-square">
</p>

---

WhisperFlow turns your voice into typed text in **any** app — email, chat, documents, browser
boxes, editors. Press a hotkey, speak naturally, and the words appear where your cursor is.
A small floating pill shows your text as it comes in, and optional polish cleans up the "ums"
and the punctuation before the text lands.

It runs on your machine by default: transcription through [whisper.cpp](https://github.com/ggml-org/whisper.cpp),
text cleanup through a small local model. No accounts, no word caps, no telemetry. If you'd
rather use a cloud engine, you can — with your own key, from your own provider, and only if
you turn the local-only lock off. Your API key is stored on your machine and nowhere else.

> WhisperFlow is an independent, clean-room project. Not affiliated with Wispr Inc., OpenAI,
> Meta, or the Qwen team. All code, art, and copy here are original.

## Screenshots

| Home (Nocturne — dark) | Nocturne Dawn (light) |
| --- | --- |
| ![Home](docs/assets/hero.png) | ![Dawn](docs/assets/dawn.png) |

| Snippets board | Live docs |
| --- | --- |
| ![Snippets](docs/assets/snippets.png) | [Live docs →](https://namandhakad712.github.io/whisperflow/docs/) |

## What it does

- **Voice dictation anywhere** — one global hotkey. A floating pill shows a live waveform and
  your words as you speak; the finished text is typed into whatever field has focus.
- **Local-first speech-to-text** — whisper.cpp runs on your hardware. Models download once from
  HuggingFace and work offline forever. Or flip the engine to **cloud STT** with your own key
  (see [Settings tour](#a-quick-tour-of-settings) below).
- **Optional AI polish** — a small local model removes fillers, fixes punctuation, and formats
  the text. Prefer a cloud model for that? Any OpenAI-compatible endpoint works. Five cleanup
  levels, four output formats, and a tone per context (personal / work / email).
- **A dictionary that learns from your edits** — after each dictation, the app watches the text
  box; words you correct are added to your personal dictionary automatically, and every
  auto-added entry records what the engine originally heard. (You can turn this off.)
- **Voice commands** — "scratch that" is built in; add your own insert / replace / undo phrases.
- **Meeting mode** — the session stays open across pauses and each utterance is inserted the
  moment it's transcribed. Handy for meetings, lectures, and interviews. You can also save the
  audio of every dictation next to its transcript.
- **History, insights, scratchpad** — everything stored locally, on your machine, and history
  can be switched off entirely. Backups (config + history) export to one JSON file.
- **A resting dock, if you want one** — a small dash parked on a screen edge that morphs into
  the dictation pill when you hover it; click to dictate. Off by default.
- **Three themes** — Nocturne (dark), Dawn (light), Classic — switchable live.

## Installing

### Windows installer (recommended)

Grab `WhisperFlow-Setup-x.y.z.exe` from
[Releases](https://github.com/namandhakad712/whisperflow/releases). The installer is unsigned,
so Windows SmartScreen will ask you to confirm ("More info → Run anyway").

**Updates are automatic:** the app checks GitHub Releases at launch and every 6 hours,
downloads only the changed blocks (delta updates via blockmap), and installs on quit —
your settings, history, and models are untouched. A banner in Settings offers
"Restart now". A *major* version (1.x → 2.x) is never auto-installed: breaking changes
go through the release notes. Pick **Beta** in Settings → Privacy to live on the edge.

### From source

Requires Node ≥ 20 (Windows today; macOS/Linux packaging is on the roadmap).

```bash
git clone https://github.com/namandhakad712/whisperflow.git
cd whisperflow
npm install
npm run dev        # desktop app — onboarding walks you through the mic and the models
```

First launch: allow the mic → configure your speech engine → download models (resumable) →
press the hotkey and speak. Model downloads are a few hundred MB for the recommended set; the
Models page ranks a set for your PC and downloads it in one click.

## The hotkeys

| Action | Default shortcut |
| --- | --- |
| Start / finish a dictation | `Ctrl+Shift+Space` |
| Cancel a dictation (text is **not** pasted) | `Esc` |
| Paste your last dictation again | `Shift+Alt+Z` |
| Copy your last dictation to the clipboard | `Shift+Alt+X` |

A few things worth knowing:

- **Default mode:** press once to start, and the session finishes by itself when you fall
  silent. Prefer a press-to-start / press-to-stop rhythm? Turn on **Toggle mode**. Prefer
  **hold-to-talk** (release to finish)? Turn that on — it needs the global keyboard hook, and
  the Settings page will tell you plainly if the hook isn't available, with the app staying in
  toggle mode. Hold-to-talk also detects typing mid-dictation and keeps the session open while
  you correct something.
- **Esc cancels cleanly** — nothing is pasted, nothing is kept.
- **Paste last** re-types your most recent dictation wherever the cursor is; **Copy last** puts
  the same text on the clipboard without typing.
- **Every shortcut above can be rebound** in Settings → Shortcuts: press *Rebind*, hit your
  combination, done. If another app already owns that combination, the page says so.
- A single dictation caps at 20 minutes by default (with a one-minute warning) so a sat-on
  hotkey can't fill your disk. Change it in Settings → Audio.

## A quick tour of Settings

The Settings window has a rail of sections. The ones people touch first:

- **Models** — your PC's hardware (CPU / RAM / GPU, with a tier), a recommended model set for
  it, and one-click downloads. This is also where you switch the **transcription engine**:
  *Local* (whisper.cpp, offline) or *BYOK cloud*. Cloud STT is provider-based — pick a
  provider, pick one of its models, paste your key, hit **Test connection**. (Groq, Mistral,
  OpenAI, or any custom OpenAI-compatible endpoint.) If you want a safety net, you can set an
  explicit fallback engine — it's off by default, so audio never goes anywhere in surprise.
- **Advanced** — the polish engine: local llama.cpp, a remote OpenAI-compatible endpoint, or
  none. The remote picker works the same as cloud STT — pick a provider, pick a model, paste
  your key, hit **Test connection** (Groq, OpenRouter, OpenAI, Mistral, Ollama, or any custom
  endpoint; Ollama is self-hosted, so nothing leaves your machine even when it's "remote").
  Also here: cleanup strength, transcription format, email signature, and per-context tone
  ("make it sound like you").
- **Audio** — microphone choice, voice-activity detection (kind, sensitivity, trailing
  silence), the 20-minute cap, and **your languages**: a 16-language chip picker plus an
  auto-detect toggle. One language selected + auto-detect off = that language is used
  explicitly, no guessing.
- **Overlay** — the pill's shape (pill / rect / blob) and position (near cursor, floating,
  pinned corners, top/bottom center), a custom backdrop, meeting mode, and audio saving, with
  a live preview.
- **Shortcuts** — everything in the table above.
- **Privacy** — the **local-only lock**: when it's on (the default), remote providers are
  impossible — the app cannot send transcript text anywhere, even if an endpoint is
  configured. Also history on/off, the data folder, backup export/import, and the update
  channel.

The rest: **Dictionary** (with word-list import and fuzzy matching), **Snippets** (with JSON
import), **Commands**, **History** (with optional audio playback), **Insights**, **Scratchpad**,
**Style** (themes), **Help** (logs and diagnostics).

## Troubleshooting

**The dictation is silent / the mic isn't picked up.**
Microphone device names appear only after the mic permission is granted (during onboarding or
the first dictation). Check **Windows Settings → Privacy → Microphone**, make sure WhisperFlow
is allowed, then pick the right device in Settings → Audio and make sure the input isn't muted
in Windows. When Models shows the engine running but no text, try a short test in Notepad —
that exercises the whole chain (mic → STT → polish → paste).

**The hotkey does nothing.**
Another app probably owns that combination. Go to Settings → Shortcuts, press *Rebind* next to
the dictation hotkey, and press your combination — if it's taken, the page tells you so. Some
apps release global shortcuts only when they quit, so a restart of the other app may help.

**Cloud STT / polish "Test connection" fails.**
The probe shows the endpoint's own answer (HTTP status and body), which usually points at the
cause: a wrong key, a typo'd model id, or a base URL that shouldn't have a path suffix. Also
check the **local-only lock** in Settings → Privacy — when it's on, every cloud provider is
hard-blocked by design; turn it off knowingly. If the endpoint keeps failing mid-dictation and
you've enabled a fallback, the failing segment is retried there; with polish, a failing remote
endpoint falls back to the local model when one is downloaded.

**Text lands in the wrong place, or a paste fails.**
The target needs to be a text field with focus. If a paste cannot be delivered at all (some
elevated apps refuse injection), the text stays on your clipboard with an actionable message
instead of being lost — just paste it yourself.

## For developers

### Workspace layout

| Path | What |
| --- | --- |
| `apps/desktop` | Electron app: main process, preload, and the React surfaces — Settings (13 sections), the dictation overlay, and the resting status bar |
| `apps/website` | Astro marketing + docs site (GitHub Pages) |
| `packages/shared` | Typed IPC contract, zod config schema — **the single source of every default** (hotkeys, cleanup levels, formats, dock edges, model presets) |
| `packages/engine` | The dictation engine — host-agnostic, pure TS, zero Electron imports |
| `docs/` | Architecture, ADRs, parity matrix, reference-app research |

### Commands

```bash
npm install
npm run dev            # desktop app (electron-vite dev)
npm run dev:website    # marketing/docs site
npm run build          # build every workspace
npm run typecheck      # typecheck every workspace
npm run test           # vitest across workspaces
npm run format         # prettier
```

To package a Windows installer locally:

```bash
npm run package -w apps/desktop    # electron-vite build + electron-builder --win
```

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the binding contract — and
[`docs/analysis/app-ui/PARITY-MATRIX.md`](docs/analysis/app-ui/PARITY-MATRIX.md) for the
verified feature scoreboard.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [ADRs](docs/adr/)
- [Security policy](SECURITY.md) · [Changelog](CHANGELOG.md) ([web view](https://namandhakad712.github.io/whisperflow/changelog/)) · [Code of Conduct](CODE_OF_CONDUCT.md)
- [Live docs on the site](https://namandhakad712.github.io/whisperflow/docs/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Clean-room policy: never submit code, assets, or copy
derived from proprietary products.

## Support the project

⭐ Star the repo · 💛 GitHub Sponsors · 🏢 see
[Pricing](https://namandhakad712.github.io/whisperflow/pricing/) for support tiers

## License

[Apache-2.0](LICENSE) © WhisperFlow contributors. Whisper models are used via whisper.cpp (MIT)
and llama.cpp (MIT). This project is not affiliated with OpenAI, Meta, or the Qwen team.
