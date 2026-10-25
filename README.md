# WhisperFlow

**Open-source, local-first AI voice dictation. Your voice, your models, your machine.**

Hold a key, speak naturally, and get polished text injected into any app — powered entirely
by open models running on **your** hardware. No word caps. No cloud required. No telemetry.

> WhisperFlow is an independent, clean-room project. It is not affiliated with, endorsed by,
> or connected to Wispr Inc. or their Wispr Flow product. All code, UI, and copy here are original.

## Why

Commercial dictation tools put caps on how much you can speak and ship your voice to their
cloud for processing. WhisperFlow takes the other road:

- 🖥️ **Local-first** — transcription (whisper.cpp) and AI polish (llama.cpp) run on your machine. GGUF/GGML models download straight from HuggingFace.
- ♾️ **Unlimited** — no word counts, no tiers for core features, no accounts.
- 🔓 **Freedom** — Apache-2.0 licensed, modular engine, pluggable providers. Swap models, add a BYO cloud endpoint if you want one, or hard-lock to offline with `local-only` mode.
- 🔒 **Private** — zero telemetry. Your voice never leaves the machine unless *you* configure a remote endpoint.

## Features (v1)

- Global push-to-talk hotkey (default `Ctrl+Shift+Space`) with rebindable toggle mode
- Floating overlay: live waveform → streaming partials → polish spinner → insert
- AI polish with tone presets (Neutral / Casual / Professional / Custom instructions)
- Personal dictionary with fuzzy correction and context-aware polish
- Voice commands (ships with "scratch that" — fully configurable)
- Searchable local history (SQLite)
- Hardware-aware model manager with resumable HuggingFace downloads
- Works in any app via clipboard-safe paste injection
- Windows first; macOS/Linux packaging on the roadmap (code kept cross-platform where cheap)

## Quickstart (dev)

Requires Node ≥ 20 (Windows for the desktop app today).

```bash
npm install
npm run dev        # desktop app (electron-vite)
npm run dev:website  # marketing/docs site (astro)
```

First launch walks you through: microphone permission → model download → hotkey test.

Other scripts: `npm run typecheck` · `npm run test` · `npm run build`

## Monorepo layout

| Path                 | What                                            |
| -------------------- | ----------------------------------------------- |
| `apps/desktop`       | Electron app: main process, preload, React UI   |
| `apps/website`       | Astro marketing + docs site                     |
| `packages/shared`    | Typed IPC contract, config schema, entities     |
| `packages/engine`    | The dictation engine — Electron-free, portable  |
| `docs/`              | Architecture, analysis, ADRs                    |

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — it is the binding contract.

## Roadmap

- [ ] v1: Windows stable + installer + auto-update
- [ ] macOS & Linux packaging
- [ ] Whisper streaming server mode for lower latency
- [ ] Per-app injection profiles
- [ ] **WhisperFlow Cloud** (optional hosted inference for weak hardware — the core stays free & unlimited forever)

## Support the project

WhisperFlow is free forever. If it saves you time:

- ⭐ Star the repo
- 💛 [GitHub Sponsors](https://github.com/sponsors) *(link activates on first release)*
- 🏢 Companies: support contracts & priority builds — see `/pricing` on the website

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Clean-room policy: never submit code reverse-engineered
from proprietary products.

## License

[Apache-2.0](LICENSE) © WhisperFlow contributors.

Whisper models are used via whisper.cpp (MIT) and llama.cpp (MIT). This project is not
affiliated with OpenAI, Meta, or the Qwen team.
