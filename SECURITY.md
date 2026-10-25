# Security Policy

WhisperFlow's threat model is simple: **your machine is the boundary.**

## Reporting a vulnerability

Open a [security advisory](https://github.com/namandhakad712/whisperflow/security/advisories/new)
rather than a public issue. You'll get credit in the release notes unless you prefer otherwise.

## Guarantees (v0.1)

- **No telemetry.** No analytics, crash reporting, or tracking code exists in the codebase.
- **Local-only lock** (`privacy.localOnly`, default ON): remote providers are refused at the
  construction site — with the lock on, the app cannot make network calls to any endpoint.
- **Audio** is captured, transcribed (whisper.cpp), and discarded locally. It is never written
  to disk or transmitted.
- **Transcripts/history** live in `%APPDATA%/WhisperFlow/` and never leave the machine.
- **Model downloads** go to HuggingFace/whisper.cpp release URLs over HTTPS; hashes are
  verified when the catalog lists them.

## Out of scope (v0.1)

- Hardened memory safety (Electron/Node runtime), sandbox escape of the host OS
- The optional BYO remote endpoint: once you configure one with the lock OFF, that provider's
  policy governs your transcript text

## Verification

Everything above is checkable in source (Apache-2.0). Grep for `fetch(`/`https` in
`packages/engine/src` — the only network calls are model downloads and the explicitly
configured remote polish provider.
