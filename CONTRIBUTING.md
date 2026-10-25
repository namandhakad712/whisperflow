# Contributing to WhisperFlow

Thanks for helping build free voice dictation for everyone.

## Setup

```bash
git clone <your-fork>
cd whisperflow
npm install
npm run typecheck && npm run test
```

- Desktop app: `npm run dev`
- Website: `npm run dev:website`

## Ground rules

1. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the contract.** If your change
   breaks it, update the doc in the same PR.
2. **Clean-room only.** Never submit code, assets, prompts, or copy derived from
   proprietary products (including Wispr Flow). Interoperability facts (public API
   shapes, file formats) are fine; their implementation is not.
3. **The engine stays Electron-free.** `packages/engine` must not import `electron`.
4. TypeScript strict; no `any`. Public engine APIs get JSDoc.
5. Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
6. New engine logic needs unit tests (vitest). UI changes need a smoke test or screenshot.

## Where to help

- `good-first-issue` labels
- macOS/Linux packaging
- Translations of the website & UI
- Model catalog curation (HuggingFace GGUF/GGML quality testing)
