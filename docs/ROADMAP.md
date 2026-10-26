# Roadmap

## v0.1 — shipped
Windows desktop app (Nocturne/Classic/Dawn), local STT+polish engine, model manager,
onboarding with ASR config board, Insights, Scratchpad, website on GitHub Pages.

## v0.1.1 — shipped (release pipeline + production maturity)
- [x] Working auto-update: GitHub Releases feed (non-draft), blockmap delta downloads,
  stable/beta channel setting, in-app update banner with restart-to-install
- [x] Release workflow: `git tag v0.1.1` → Windows build + published release + latest.yml
- [x] Backup import (config restore + history merge, no duplicates)
- [x] Native file/folder pickers for the overlay backdrop and recordings folder
- [x] Diagnostics in Help: open logs / config folder
- [x] Search on Dictionary and Snippets (parity gap closed)
- [x] Meeting mode + recorder + per-utterance insertion, custom model lifecycle, model
      deletion + disk cleanup, best-practices card, cloud STT BYOK (Groq / Mistral Voxtral /
      OpenAI-compatible) with explicit fallback chain

## v0.2 — next
- [ ] End-to-end mic→text verification harness on a clean machine (CI-adjacent)
- [] Catalog upgrade from model research: Parakeet TDT via transcribe.cpp (12–15× realtime,
      1.94% WER — `docs/research/model-recommender.md`), SenseVoice via sherpa-onnx
- [ ] SQLite history upgrade (drop-in behind the repository interface)
- [ ] Whisper.cpp streaming server mode for lower first-token latency
- [ ] Hold-to-talk + typing detection via optional native hook (Electron lacks key-up events)
- [ ] macOS + Linux packaging (injection + hotkeys need per-OS ports)
- [ ] i18n (App Language setting), starting with the site's existing locales list
- [ ] Insights heatmap + notifications pill (remaining 🟡 parity items)

## v0.3+ — exploring
- [ ] Voice profile learning (tone-match pairs, local-only)
- [ ] Per-app style contexts (detect focused app, apply its tone)
- [ ] Optional WhisperFlow Cloud relay for weak hardware — core stays free & unlimited, local-only lock always available
