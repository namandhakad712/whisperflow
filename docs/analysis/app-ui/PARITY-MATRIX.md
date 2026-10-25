# Feature Parity Matrix — Reference App vs WhisperFlow

Source of truth: live CDP captures of app-1.6.1264 (`docs/analysis/app-ui/text-*.md`,
`section-*.md`, `screenshots/wfs-*.png`). Status legend: ✅ shipped · 🟡 partial · ❌ missing ·
⛔ deliberate non-goal (product/legal).

## Rail sections

| Reference section | Ours | Status | Gap to close |
| --- | --- | --- | --- |
| Dictation (landing) | General tab + setup checklist | ✅ | — |
| Notetaker | — | ⛔ | separate product line (meetings recorder); out of scope |
| Insights | Insights tab (stats + 7-day bars) | 🟡 | theirs: heatmap grid, weekly quota, streaks |
| Dictionary | Dictionary tab | 🟡 | theirs: "Shared with team" segment, starred entries, import file |
| Snippets | Snippets tab | 🟡 | theirs: "Shared with team", import, edit-in-place |
| Style | Style tab (contexts + auto cleanup) | 🟡 | theirs: per-app style learning, voice profile training |
| Transforms | folded into Snippets (replace action) | 🟡 | theirs: dedicated transforms list w/ toggles |
| Scratchpad | Scratchpad tab (local notes) | 🟡 | theirs: "Add to Flow Bar", pre-warmed windows, recents rail |
| Invite your team | — | ⛔ | replaced by Sponsors (no team infra) |
| Get a free month | — | ⛔ | nothing to sell — core is unlimited |
| Settings | Shortcuts/Privacy + rows | 🟡 | theirs: General/System/Notetaker/Vibe coding/Connectors/MCP/Account/Team/Plans/Data&Privacy sub-pages |
| Help | About tab | 🟡 | theirs: docs links, support, version changelog |

## General settings rows (measured)

| Reference row | Ours | Status |
| --- | --- | --- |
| Shortcuts — hold <kbd>+X</kbd> and speak [Change] | ✅ same anatomy | |
| Microphone — device value [Change] | ✅ | |
| My languages — value [Change] | ✅ | |
| App Language — dropdown | ❌ | add i18n (v0.2) |
| Theme — Dark dropdown | ✅ 3-skin dropdown | |

## Onboarding / setup

| Reference | Ours | Status |
| --- | --- | --- |
| "Want to skip ahead?" modal | ✅ skip-ahead card | |
| Setup checklist card w/ progress | ✅ wired to real state | |
| Tour steps (mic → model → hotkey) | ✅ 4-step wizard + ASR config | |

## Cards & components

| Reference | Ours | Status |
| --- | --- | --- |
| Cards r24, #1A1A1A, layered shadow | ✅ ported | |
| 0.15s eased motion on controls | ✅ ported | |
| Rail 192px/36px/6px items | ✅ | |
| Top pills (sidebar/account/theme) | ✅ + notifications missing | 🟡 add bell v0.2 |
| Segmented filters (All/Personal/Shared) | ✅ (2 of 3 segments) | |
| Search inputs on Dictionary/Snippets | ❌ | add |
| Beta badges | ❌ | add where honest |

## Engine capabilities behind the UI

| Reference | Ours | Status |
| --- | --- | --- |
| Cloud WSS streaming STT | local whisper.cpp sidecar | ⛔ different by design |
| Opus audio encode | raw PCM 16k | 🟡 |
| Tone/style per app | per-context tones | 🟡 |
| Voice profile training | — | ❌ v0.2+ |
| Local SQLite (176 migrations) | JSON store (SQLite drop-in planned) | 🟡 |
| Team dictionary sync | — | ⛔ no accounts |
| Word caps / billing | — | ⛔ unlimited by design |
| MCP connector | BYO OpenAI-compatible endpoint | 🟡 |
| Telemetry (Sentry/PostHog) | none | ⛔ by design |
