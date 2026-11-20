<!-- Thanks for the PR — a short, honest description beats a long generic one. -->

## What and why

<!-- One or two sentences: what changes, and what problem it solves. Link the issue if there is one. -->

## Verification

<!-- Tick what you actually ran. CI runs typecheck + tests on every PR; the desktop build runs on Windows. -->
- [ ] `npm run typecheck` (root — both tsconfigs)
- [ ] `npm test` — all suites pass (shared / engine / desktop)
- [ ] `npm run build -w apps/desktop` (electron-vite) succeeds
- [ ] Booted the built app and checked the affected surface by hand

## Scope check

- [ ] No config-schema or IPC-contract change that would break saved configs (or: migration added + covered by a test)
- [ ] No new dependency without a size justification (the installer is on a sub-100 MB diet)
- [ ] Nothing in this PR is copied from Wispr Flow, Hex, or any other product — WhisperFlow is clean-room, see CONTRIBUTING.md

## Screenshots / captures

<!-- For anything visual — the pill states change rendering subtly, so a frame is worth a paragraph. -->
