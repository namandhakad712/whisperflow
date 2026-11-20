# Wispr Flow Hub — Measured Design System (live CDP evidence)

Source: app-1.6.1264 running with `--remote-debugging-port=9222`, DOM + computed styles
queried in the live renderer (their own installed copy, user's machine). All values below
are measured facts. This is the reference for WhisperFlow's **"Classic" theme**; layout
structure and metrics are mirrored 1:1, copy and icons are original.

## Tokens (measured)

| Token | Value | Evidence |
| --- | --- | --- |
| Content background | `#FFFFFF` (body), cards `#FCFCFB` | body computed style |
| Sidebar (rail) | items `#202020`, active `#30302F`, text `#E9E8E1` | nav buttons computed |
| Top-bar pills | `#E9E8E1` bg, ink text, 32px tall, radius 8px | "Toggle sidebar / Account / Theme / Notifications" |
| Primary button | `#30302F` (or `#1A1A1A`), cream text, radius 8px, ~170×37 | "Start now", "Show me everything" |
| Secondary button | `#FCFCFB` bg, radius 8px, ~143×36 | "Skip onboarding" |
| Nav item | 192×36, radius 6px, Figtree 15px/550, icon + label | all 12 nav buttons |
| Headings | H1 24px/600, H2 ~20px/600, H3 section labels | "Welcome back, {name}" |
| Font | Figtree everywhere (body + UI), no display serif in-app | computed font-family |

## Layout (measured)

- Window main area 1134×754 + 192px left rail (collapsible — "Toggle sidebar" pill)
- Rail: icon+label items in two groups (main product + secondary/meta), 12 items total
- Top-right pill row: `Toggle sidebar | Account | Theme | Notifications`
- Onboarding lives INSIDE the hub as a modal/card ("Want to skip ahead?" + skip vs full)

## Rail sections (their labels → WhisperFlow equivalents)

| Their nav item | WhisperFlow tab | Note |
| --- | --- | --- |
| Dictation | Dictation (General) | default landing |
| Notetaker | — | separate product line, out of scope |
| Insights | History (stats view v2) | |
| Dictionary | Dictionary | 1:1 |
| Snippets | Snippets (voice commands w/ payloads) | |
| Style | Style (tone + polish config) | |
| Transforms | — (merge into Snippets) | text transforms = replace commands |
| Scratchpad | — v2 | floating notes window |
| Invite your team | Sponsors (ours) | |
| Get a free month | — (no caps to sell) | deliberately absent |
| Settings | Shortcuts / Privacy / Advanced | |
| Help | Help (About) | |

## Onboarding card (measured)

- H2 24/600 heading + one body line, two buttons side by side:
  primary ink `#1A1A1A`/`#30302F` ("Show me everything" 170×37 r8), secondary `#FCFCFB`
  ("Skip onboarding" 143×36 r8)
- Post-skip landing: H1 "Welcome back, {user}" + H2 "Make Flow sound like you" (style card)
