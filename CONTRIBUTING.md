# Contributing to WhisperFlow

Free, local-first voice dictation for everyone. Thanks for helping build it — this guide is the
shortest path from "I have an idea" to a merged PR. It mirrors exactly what the maintainers run;
if a step doesn't work for you, that's a bug in this file.

## Setup (≈5 minutes)

```bash
git clone <your-fork> && cd whisperflow
npm install              # npm workspaces: installs shared + engine + desktop + website
npm run typecheck        # both tsconfigs (node + web)
npm test                 # shared + engine + desktop suites
```

Node 24 is what CI runs. Dev mode: `npm run dev` (desktop), `npm run dev:website`.

### The golden rule of the workspaces — read before you edit `shared`

`packages/shared` holds the **Zod config schema** and the **IPC contract**. Both `packages/engine`
and `apps/desktop` compile against its *built* `dist/`, not its source. After changing shared:

```bash
npm run build -w packages/shared     # BEFORE building/testing anything else
```

Symptoms of skipping this: the engine's tests collect 0 files, or the desktop app silently runs
against the old schema. Add the shared rebuild to every PR that touches `packages/shared/**`.

### The verification loop (run this before pushing)

```bash
npm run build -w packages/shared          # if shared changed
npm run build -w packages/engine          # if engine changed
cd apps/desktop && npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json && cd ../..
npm test                                   # all suites: shared, engine, desktop
cd apps/desktop && npx electron-vite build # apps/desktop/out must build
```

You can't run the packaged build locally without Visual Studio (electron-builder rebuilds
`uiohook-napi`) — CI and the release workflow do that on `windows-latest`. That's why CI exists.

## Ground rules

1. **Clean-room only.** Never submit code, assets, prompts, or copy derived from proprietary
   products (Wispr Flow included). Public interop facts — API shapes, file formats, documented
   behavior — are fine; their implementation is not. When in doubt, write the behavior you'd want
   if the competitor didn't exist, and cite public sources for any factual claim you reuse.
2. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the contract.** If your change breaks it,
   update the doc in the same PR.
3. **The engine stays Electron-free.** `packages/engine` must not import `electron`. The engine is
   what makes a server/portable future possible — keep it pure Node.
4. **TypeScript strict, no `any`.** Public engine APIs get JSDoc. Edit JSON config in your editor,
   never via PowerShell (BOM/`-replace` precedence break UTF-8 files).
5. **Conventional commits:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
6. **New engine logic needs a unit test.** UI changes need a smoke boot (see below) and, for
   anything visual, a frame in the PR description.

## How the app is put together

- `packages/shared` — the Zod config schema (the source of truth for every knob) + the typed IPC
  contract used by preload.
- `packages/engine` — the pure-Node pipeline: mic capture → resample → VAD → STT (whisper.cpp /
  cloud) → dictionary → commands → polish (local LLM / cloud) → result, orchestrated by
  `DictationSession`. Every stage is unit-testable without a microphone.
- `apps/desktop` — Electron 45, electron-vite, React 19, Tailwind v4. Main process: windows
  (overlay / rest-dash / settings / status / lens / system-audio), hotkeys (uiohook-napi), tray,
  updater, injection. Renderer: the pill (`overlay/`), the settings app, the lens.
- `apps/website` — the marketing/docs site (GitHub Pages via `deploy-website.yml`).

Deep dives: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/EXTENDING.md`](docs/EXTENDING.md) (every user-facing knob),
[`docs/ROADMAP.md`](docs/ROADMAP.md), and `docs/research/` (competitor studies, model research).

## Testing without a microphone

The engine has no microphone on CI. `WF_STT_MOCK=1` makes the pipeline produce a synthetic
transcript; tests drive `DictationSession` directly with PCM frames (`speechFrame()` /
`silenceFrame()` helpers). UI is verified by harness: a standalone script loads
`out/renderer/*.html` + the preload, posts IPC events, and dumps DOM/geometry — see the existing
harnesses under `apps/desktop/scripts/` for the pattern. **A smoke boot of the built app is the
only real check of the main process** (single-instance lock, tray, overlay); the log lives at
`%APPDATA%\WhisperFlow\logs\YYYY-MM-DD.log` on Windows.

## Config schema changes (the most common way to break users)

Saved configs are real files on real disks. The schema is their migration: **never narrow a field
in a way that rejects a saved value**. When you must, add a `.prefault(...)` or a preprocess
migration (see `overlayRestBar` in `packages/shared/src/config.ts` for the pattern), cover it with
a test, and note it in the CHANGELOG as a migration.

## Releasing

Releases are tags: bump `apps/desktop/package.json` version, add a CHANGELOG entry, commit,
`git tag vX.Y.Z`, push the tag. `release.yml` builds + signs + publishes the NSIS installer;
**the tag name and the version must match** (a mismatch once shipped the wrong installer). Verify
with `gh release view vX.Y.Z` after ~12 minutes. Anyone can release; nobody releases in a hurry.

## Where to help

- `good-first-issue` — labeled entries, no context needed beyond this file
- **macOS/Linux packaging** — the engine and renderer are portable; the shell work isn't done
- **Translations** — UI + website strings (plain TSX; no extraction step yet)
- **Model curation** — verify a HuggingFace GGUF/ONNX model's real quality-speed-size and add it to
  `packages/engine/src/models/catalog.ts` with measured numbers, not marketing numbers
- **Community** — triage issues, answer config questions ([docs/EXTENDING.md](docs/EXTENDING.md) is
  the reference), write recipes

## Asking for help

Open a Discussion (not an issue) for design questions, or ask in the PR — a messy first draft with
good questions beats a silent week. For security, see [SECURITY.md](SECURITY.md), never a public
issue.
