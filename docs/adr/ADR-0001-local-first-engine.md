# ADR-0001: Local-first engine, sidecar STT, optional-dependency natives

Status: accepted · Date: 2026-10-25

## Context

WhisperFlow must run whisper.cpp (STT) and llama.cpp (polish) locally, install cleanly on any
Windows machine without compilers, and stay portable to a future Tauri/Rust host.

## Decision

1. `@whisperflow/engine` is pure TypeScript with **zero Electron imports**; the Electron app
   is just its first host (`createEngine({ dirs })`).
2. STT runs in a **whisper.cpp sidecar binary** downloaded from official releases — no native
   npm builds, no node-gyp, no compiler requirement.
3. `node-llama-cpp` / `onnxruntime-node` are **optionalDependencies**, always loaded via
   dynamic `import()` inside try/catch, with graceful fallbacks (offline cleanup polish,
   energy VAD) when absent.
4. Config/history are zod-validated JSON with atomic writes; the history interface is
   repository-shaped so SQLite (which the reference app uses) is a drop-in upgrade.

## Consequences

- `npm install` cannot fail on native builds — the whole toolchain is optional.
- Slightly higher latency than in-process bindings (sidecar spawn per segment); acceptable for
  v1, revisit with a whisper.cpp server/streaming mode in v0.2.
- Engine can be re-hosted (Tauri/CLI/server) without changes.

## ADR-0002: Clean-room reproduction boundary

Status: accepted · Date: 2026-10-25

We replicate measured structure, layout, metrics, features, and interaction patterns from
competitor products, but never their code, artwork, logos, illustrations, or long-form copy.
Interoperability facts (endpoint URLs, config keys, file formats, short functional labels) are
recorded in `docs/analysis/` as evidence. This keeps the Apache-2.0 repo publicly
distributable and commercially safe.
