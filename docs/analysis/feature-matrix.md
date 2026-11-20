# Wispr Flow — Product Feature Matrix (with OpenWispr rebuild recommendations)

Researched 2026-10-25 from wisprflow.ai (home, features, pricing, downloads, what's-new) and docs.wisprflow.ai.
Recommendations: `core-parity-v1` (must ship in v1), `v2` (later), `out-of-scope` (not for our rebuild).

## A. Dictation core

| Feature | Wispr Flow behavior | Recommendation |
|---|---|---|
| Push-to-talk hotkey | Global hotkey toggles dictation; keyboard/mouse shortcuts customizable (docs article) | core-parity-v1 |
| System-wide text insertion | Works in any focused text field without per-app plugins | core-parity-v1 |
| Speech-to-text engine | Cloud ASR (proprietary); high accuracy incl. accents, fast/quiet speech (FAQ claims) | core-parity-v1 (local-first engine) |
| Whisper mode | Quiet dictation for open offices (workflow/demo pages) | v2 |
| Speed target | Marketed ~220 wpm vs ~45 wpm typing | core-parity-v1 (perf goal) |
| Pause/resume mid-dictation | Supported | core-parity-v1 |
| Real-time partial transcription | Live text preview during dictation (demo behavior) | v2 |
| Word statistics | Word count, WPM, improvement tracking (downloads page) | v2 |
| Offline/local processing | NOT supported (cloud-only) — our differentiator | core-parity-v1 (as our advantage) |

## B. AI polish / cleanup

| Feature | Wispr Flow behavior | Recommendation |
|---|---|---|
| Filler-word removal | Strips ums/uhs, repetitions automatically | core-parity-v1 |
| Auto punctuation & formatting | Paragraphs, bullets, headings, code blocks | core-parity-v1 (bullets/paragraphs; code blocks v2) |
| Handles self-corrections / rambling | Mid-sentence changes and repeats cleaned | core-parity-v1 |
| Undo last dictation | Undo/edit support (features page "Refine") | core-parity-v1 |
| Tones | Multiple output tones (formal ↔ very casual, excited, friendly); English-only, desktop (whats-new) | v2 |
| Emoji insertion | Via voice command | v2 |
| Universal voice commands (~11) | e.g., paragraph breaks, capitalization, numeral modes (whats-new) | core-parity-v1 (basic set) |
| Command Mode | Separate mode so commands aren't transcribed (docs) | v2 |
| Smart rewrite | Optional stronger rewriting of phrasing (features page) | v2 |
| Auto-formatting rules | Natural-language persistent rules ("always format my emails as…") (whats-new) | v2 |
| Per-app style adaptation | Different style by target app | v2 |

## C. Dictionary, snippets, customization

| Feature | Wispr Flow behavior | Recommendation |
|---|---|---|
| Personal dictionary — manual add | Names, jargon, unique spellings | core-parity-v1 |
| Personal dictionary — auto-learn | Learns from user corrections automatically | core-parity-v1 (manual first, auto-learn close behind) |
| Multi-language dictionary | Dictionary entries per language | v2 |
| Snippets (text expansion) | Short spoken trigger → longer stored text; two-word triggers added recently; desktop + Android | core-parity-v1 (single-word trigger) |
| Per-language snippets | Snippet sets per language | v2 |
| Shared team dictionary/snippets | Team-wide synced dictionary & snippets (Pro for Teams) | v2 |
| Privacy mode ("scramble delete") | Replaces last dictated text with random words | v2 |
| Customizable shortcuts | Keyboard/mouse bindings (docs) | core-parity-v1 (basic hotkey config) |
| Shortcuts integration (iOS) | iOS Shortcuts app setup (docs) | out-of-scope |

## D. Languages

| Feature | Wispr Flow behavior | Recommendation |
|---|---|---|
| Language count | 100+ languages | core-parity-v1 (top ~10 via local model; grow later) |
| Auto language detection | Detects language mid-dictation | v2 |
| Code-switching (mixed languages) | Supported in auto-detect mode | v2 |
| Regional dictation variants | English variants (US/UK/India etc.) | v2 |

## E. Platforms & integrations

| Feature | Wispr Flow behavior | Recommendation |
|---|---|---|
| macOS app | Yes (Apple Silicon + Intel; ARM64 fixes in changelog) | core-parity-v1 |
| Windows app | Yes (x64 installer on S3) | core-parity-v1 |
| Linux | Not supported | v2 (evaluate demand; open-source audience) |
| iOS app + keyboard | Yes (550 words/wk free) | v2 |
| Android app + keyboard | Yes (1,000 words/wk free) | v2 |
| Settings sync across devices | Implied by "syncs across platforms" claims | v2 |
| Local API (localhost) | Exposes dictation to other local apps (developers page) | v2 |
| MCP server | For Notetaker notes access (Mac/Windows) | out-of-scope (until notes exist) |
| Calendar / Slack connections | Mentioned in Free tier docs | out-of-scope |
| Notetaker (meeting recording, speaker ID, summaries, meeting Q&A) | Second product line; Growth+ tiers | out-of-scope |
| Flow Clips (voice memo sharing w/ AI summary) | Windows (changelog) | out-of-scope |
| AI reminder agent | Windows v1.5.5 (changelog) | out-of-scope |

## F. Security, privacy, compliance

| Feature | Wispr Flow behavior | Recommendation |
|---|---|---|
| Data never sold | Stated on site | core-parity-v1 (policy + no telemetry by default) |
| Training opt-out | User setting (Free/Pro); always-off enforced on Growth/Enterprise | core-parity-v1 (we never train — simpler) |
| SOC 2 Type II / ISO 27001 / HIPAA (BAA) | Certified; BAA on Growth+ | out-of-scope (revisit if commercialized) |
| Block dictation in chosen apps | Per-app exclusion (pricing table) | v2 |
| Data controls page / retention settings | Site page + product controls | v2 |
| MDM deployment, SCIM, SAML SSO | Enterprise tiers | out-of-scope |
| Audit logs | Enterprise tier | out-of-scope |

## G. Pricing tiers (observed 2026-10)

| Tier | Price | Limits / notes | OpenWispr analog |
|---|---|---|---|
| Free | $0 | Desktop 2,000 words/wk (5,000 hard); iOS 550 (750); Android 1,000 (1,500); pooled mobile; resets Sun | core-parity-v1: free & unlimited local — our wedge |
| Pro | $15/user/mo ($144/yr, ~$12) | Unlimited dictation; all personal features | core-parity-v1: N/A (free/open) |
| Growth (dictation-only) | $23/user/mo ($216/yr) | SSO, admin, usage reporting; no Notetaker | out-of-scope |
| Growth w/ Notetaker | $33/user/mo ($312/yr) | + Notetaker, meeting Q&A, MCP | out-of-scope |
| Enterprise | Custom | SCIM, MDM, training-off enforced, SLA, DPA/MSA, IT-admin seats | out-of-scope |
| Students | Free + 3 mo Pro, then ~50% off | — | out-of-scope |
| Trials | 14-day standard (30 referral, 90 student) | — | N/A |

## H. Support/help surface (competitive baseline)

| Item | Wispr Flow | Recommendation |
|---|---|---|
| Help center | Pylon-hosted, ~170 articles across 8 collections | core-parity-v1: minimal docs (install, hotkeys, dictionary, troubleshooting) |
| Public changelog | `/whats-new` with email capture | core-parity-v1 (GitHub releases) / v2 (styled page) |
| Status page | Linked from docs | v2 |
| Web demo | `/demo` try-before-install | v2 |
| Bug bounty | Listed in footer | v2 |

## Summary counts
- core-parity-v1: 20 rows (dictation basics, cleanup, dictionary, snippets, mac/win apps, top languages, never-train policy, free tier)
- v2: 21 rows (tones, command mode, auto-detect, per-app styles, mobile apps, shared team assets, stats, offline extras)
- out-of-scope: 15 rows (Notetaker & meeting features, enterprise admin/compliance, clips, agents, calendar/Slack)
