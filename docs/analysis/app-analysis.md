# Wispr Flow (Windows) — Static Analysis, v1.6.1264

> Clean-room interoperability research on the user's own installed copy. All findings are
> facts extracted from shipped artifacts (file names, dependency lists, endpoint URLs,
> migration names, config keys). Nothing here is copied code, prompts, or assets; free-text
> observations are paraphrases. Method: REA CLI attempted (v6.7.0 — no analysis provider
> bound on this machine), then the skill's sanctioned fallback: `@electron/asar extract` +
> targeted ripgrep over the webpack bundles, plus the unpacked native modules and the
> on-disk Sequelize migration files.
>
> Extracted app: `C:\Users\naman\AppData\Local\WisprFlow\app-1.6.1264\resources\app.asar`
> (137 MB, webpack/electron-forge). Analysis date: 2026-10-25.

## 1. Architecture

| Fact | Evidence |
| --- | --- |
| Electron app built with electron-forge + webpack plugin | `package.json` scripts (`electron-forge package/make`), `main: ".webpack/main"` |
| React renderer: base-ui, floating-ui, Lexical editor, TanStack Query, Zustand, react-i18next, SCSS modules, Storybook, Playwright e2e | dependency list in extracted `package.json` |
| Separate native helper processes: Swift app (macOS) and C# **"Wispr Flow Helper"** (Windows), with quicktype-generated IPC model types shared from a JSON schema | scripts `generate-helper-swift-types` / `generate-helper-csharp-types`, `src/api/helper/schema.json` |
| gRPC + protobuf and msgpack-style serialization in the stack | `@grpc/grpc-js`, `@protobuf-ts/*`, `notepack.io` |
| Native node addons shipped unpacked | `app.asar.unpacked/.../node_sqlite3.node`, `crypt32-x64.node`, `jabra-device-connector.exe` |
| Auto-update via Squirrel; installers published to S3 | `Update.exe`/Squirrel logs at install root; `@electron-forge/publisher-s3` |
| Telemetry: Sentry (crash) + PostHog (product analytics) | `@sentry/electron`, `posthog-node` deps |
| Backend auth/DB via Supabase | `@supabase/supabase-js` |

## 2. Dictation pipeline

- **Audio → Opus → cloud.** The main bundle references `opus` encoding (19 hits; an
  `opusEncoder.worker` jest gate exists for a meeting recorder). No local VAD artifacts
  (silero/rms/sample-rate constants) appear in the main bundle — endpointing and
  segmentation happen **server-side** after streaming.
- **Transport: WebSocket streaming** to `wss://api.wisprflow.ai` and
  `wss://api-east.wisprflow.ai` (east = regional/failover).
- **Push-to-talk is native**: no `globalShortcut` accelerator defaults and no
  `SendKeys`/`clipboard` strings exist in the JS — hotkey capture and text injection are
  done by the C# helper on Windows (the reason a "helper" with generated IPC models exists).
  One accelerator, `Alt+K`, appears in main (likely a secondary/palette shortcut).
- Live transcript application uses the `remend` library (streaming text-diff application).

## 3. Transcription + AI polish backends

- Endpoints: `api.wisprflow.ai` (+ `-east`), `cloud.wisprflow.ai`, `admin.wisprflow.ai`
  (org/billing/usage — B2B plane), `cdn.wisprflow.com`, `dl.wisprflow.com` (S3 installers,
  matches website recon), `docs.wisprflow.ai`, and `api.wisprflow.ai/connect/mcp`
  (an MCP server endpoint; `@modelcontextprotocol/sdk` is a dependency).
- Polish LLM identifiers found in the main bundle: `claude-sonnet-4-5`, `claude-opus-4-6`,
  `claude-haiku-4-5`, `gpt-4o-mini`, `gpt-oss-120b`, `gemini`, plus `claude-agent-sdk`.
- "Aria" subsystem (`aria-web`, `ariaWebRequest`, web-context results) — their web search /
  context feature for agent-style actions, including referencing `claude.ai` and
  `gemini.google.com` as web targets.
- Tone system includes at least `casual` and `excited` presets (renderer strings).

## 4. Storage — `flow.sqlite` (Sequelize + umzug migrations)

The migration file names in `resources/migrations/` narrate the schema's growth
(2024-05 → 2024-10+): `dictionary`, `history`, then columns for `e2e-latency`,
`edited-text-status` + `edited-text-attempts` (did the user edit the AI output, and how
many tries), `tone-matched-text` + `tone-match-pairs` (learning the user's personal
rewriting style from raw→edited pairs), `textbox-contents` (capturing pre-existing text in
the target field as context), `pasted-text-and-divergence-score`, `feedback`,
`language`, `duration`/`numWords`/`timestamp` indexes, `archive`, `mic-device`,
`conversation-id`, `fallback-monitoring`, `language-and-logprobs`, `history-revert-ai`,
plus `sharing`/`sharetype` (shareable transcript links) and `stats`.

## 5. Product surface

- Personal dictionary ✓ (table + settings), voice command **"scratch that"** ✓ (renderer
  string), tone presets ✓, transcript sharing ✓, meeting recorder / notetaker (separate
  product line; Opus worker + `notetaker-real` e2e project) ✓, Jabra headset button
  integration ✓ (native connector exe), i18n (react-i18next) ✓.
- Entitlements/plan gating: free tier caps (2,000 words/week per public pricing) are
  enforced server-side via their API + Supabase identity; the admin plane
  (`admin.wisprflow.ai/app/usage|billing|organization`) is the B2B dashboard.

## 6. Privacy observations

Audio leaves the machine by design (Opus over WSS), transcripts + behavioral metrics
(edits, divergence, feedback) are stored in their cloud account, and Sentry/PostHog
telemetry is embedded. This is the structural difference WhisperFlow exists to remove.

## 7. WhisperFlow parity check (v1 built in this repo)

| Their finding | WhisperFlow v1 | Note |
| --- | --- | --- |
| Push-to-talk via native helper | ✅ toggle hotkey + silence auto-finish (`globalShortcut`; no key-up in Electron) | hold-to-talk on v0.2 roadmap (optional native hook) |
| Overlay with live partials | ✅ overlay window + streaming partials | |
| Cloud WSS streaming STT (Opus) | ✅ **local** whisper.cpp sidecar, VAD segmentation | our key differentiator |
| Claude/GPT polish + tones (casual/excited) | ✅ local Qwen GGUF + tones (neutral/casual/professional/custom) | "excited" preset: trivial to add |
| Personal dictionary | ✅ fuzzy post-STT + prompt injection | |
| "scratch that" command | ✅ built-in + custom commands | |
| SQLite history w/ edit tracking | ◐ JSON history store v1 (function parity) | SQLite + edit-learning: v0.2 |
| Tone-match pair learning | ❌ v0.2 candidate | strong idea, worth copying conceptually |
| Textbox-contents context | ❌ v0.2 candidate | |
| Transcript sharing | ❌ deliberate non-goal for local-first v1 | |
| Notetaker / meeting recorder | ❌ out of scope (separate product line) | |
| MCP agent endpoint | ❌ v0.2+ | we have BYO OpenAI-compat instead |
| Jabra hardware buttons | ❌ niche; roadmap | |
| Word caps / accounts / cloud | ✅ none — unlimited, offline, accountless | the wedge |
| Auto-update (Squirrel→S3) | ✅ NSIS + GitHub Releases wiring (inert until repo public) | |
| Sentry + PostHog | ✅ zero telemetry | |

## 8. Unknowns / lower confidence

- Exact default hotkey string (lives in helper/settings service, not in plaintext JS).
- Precise WSS message schema (would require runtime capture; not attempted).
- Whether `WHISPER` (1 hit) refers to a fallback engine or an export format.
