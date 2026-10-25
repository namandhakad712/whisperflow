# Roadmap

## v0.1 — shipped
Windows desktop app (Nocturne/Classic/Dawn), local STT+polish engine, model manager,
onboarding with ASR config board, Insights, Scratchpad, website on GitHub Pages.

## v0.2 — next
- [ ] Close the 🟡 parity list (see `docs/analysis/app-ui/PARITY-MATRIX.md`): search on Dictionary/Snippets, notifications pill, Insights heatmap
- [ ] Catalog upgrade from model research (`docs/research/`) — distil/turbo variants, best ≤4B polish GGUFs
- [ ] SQLite history upgrade (drop-in behind the repository interface)
- [ ] Whisper.cpp streaming server mode for lower first-token latency
- [ ] macOS + Linux packaging (injection + hotkeys need per-OS ports)
- [ ] i18n (App Language setting), starting with the site's existing locales list

## v0.3+ — exploring
- [ ] Voice profile learning (tone-match pairs, local-only)
- [ ] Per-app style contexts (detect focused app, apply its tone)
- [ ] Hold-to-talk via optional native hook (Electron lacks key-up events)
- [ ] Optional WhisperFlow Cloud relay for weak hardware — core stays free & unlimited, local-only lock always available
