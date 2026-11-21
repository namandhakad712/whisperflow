
## Session 10 (2026-11-20) — v0.1.44 "THE INSTRUMENT, TUNED" — RELEASED ✅

User verdict on v0.1.43: "GREEN VOMIT, no color psychology, no hierarchy."
Diagnosis (measured): ONE green #5CE1A9 was on ~30% of interactive pixels.

**v0.1.44 SHIPPED** (PR #11 squash-merged, CI 5/5, tag pushed, Release
published: Setup 141.8MB + MSI + blockmap + latest.yml; LATEST FEED =
v0.1.44; main @ d9e6511):

- Luminance-stepped neutrals (bg #07080A/paper #0C0D0F/raised #111214/
  hover #1B1C1E; ink #F2F1EE/#9C9C9D/#6A6B6C) — hierarchy from luminance
- Accent scarcity 60-30-10: phosphor = LIVE only. MEASURED: green pixels
  0.1-0.6% (was ~30%). Nav/selection/hover/seg = neutral
- Semantic hues: amber=busy, violet=AI, coral=error, sky=info/links
- Glass command palette (blur 12 + gradient + 1px light border), inset
  depth, corner-bracket frames, 1-bit dither grain on body
- WCAG AA+: 17.3:1 primary / 7.1:1 secondary, both skins
- Daylight rebuilt on same stepped ramp
- System documented in docs/DESIGN-v0.1.44.md (committed)

RE-HUE MAP (what changed where): rail active → paper-3+ink+2px mark;
ui.tsx seg/quiet-button/stat → neutral; App.tsx skin toggle → ink;
ModelsTab: downloaded→sky, writing-style→violet, test-result→ink-dim,
recommended→violet, docs→sky, second/third pills→sky/violet, pct→ink;
Onboarding: radios→ink, local-badge→sky, provider cards→violet borders,
inputs→line-strong focus; KEPT phosphor: mic [ok], progress bar, hotkey
readout, active model pill, overlay trace/LEDs, StatusBar LED.
Overlay: notification .ok amber→green (was WRONG semantic), seq-tick→neutral.

PUSH PROTECTION WAR STORY: committed .secrets/pat.txt by accident (git add
-A after recreating it) — GitHub GH013 blocked the push. Fix: git rm
--cached + .gitignore + commit --amend. NEVER commit .secrets/.
NOTE: the token ALSO lives in the workspace .gitignore file itself
(https://x-access-token:<PAT>@... pattern appended in session 9) — that's
how it survived recycling this session. .secrets/pat.txt was recreated
from the remote URL.

QA pipeline (reusable): npm install → packages/shared npm run build →
apps/desktop npx electron-vite build → node scripts/console-qa.cjs (7
shots, both skins, to download/console-qa/ — note it writes to
/tmp/my-project/download when CWD differs; copy back). Green-pixel audit
+ WCAG contrast measured in-page with PIL (scripts pattern in session 10).

NEXT QUEUE: website palette pass (same discipline), overlay capsule depth
(gradient border + blur), microanimation expansion, README color section.

## Session 11 (2026-11-20) — v0.1.45 "THE THEME PRESS" — RELEASED ✅

User: "design so many theme fonts, ascii design, microanimations, see all
posts i gave". Read full corpus (SPEC v3 press-room direction, MOTION.md
grammar, INSPIRATION.md ledger).

**v0.1.45 SHIPPED** (PR #12, CI 5/5 after one type fix, tag + Release
published: Setup 141.9MB + MSI + latest.yml; LATEST FEED = v0.1.45;
main @ 5e1780c):

- SIX THEMES in settings/themes.ts (pure data): Lab / Press Room /
  Night Ink / Letterpress / Lino / Daylight. Full token sets on the
  v0.1.44 luminance discipline + TYPE CASTS: pressroom/nightink/lino
  display in Instrument Serif (@fontsource/instrument-serif installed),
  others Space Grotesk; mono stays labels everywhere.
- styles.css: [data-theme=…] attribute selectors ×6, --wf-display/--wf-ui/
  --wf-mono font-role props, spring toggle (.wf-toggle), card lift
  (translateY -1px out-expo), theme roll (scope 380ms blur-settle),
  .ascii-specimen block, .wf-scramble.
- ThemePicker.tsx: 6 specimen cards (halftone ramp + accent peaks,
  swatch strip, cast eyebrow); GeneralTab section "the theme press".
- useScramble.tsx: MOTION.md scramble-decode ported from website
  Header.astro; wired to rail channel numbers.
- App.tsx: skin system RETIRED → theme system (applyTheme/readThemeId,
  wf-theme-changed event, topbar cycles, palette action per theme,
  wf-skin migration). .wf-theme-swap class rolls the console.
- QA: scripts/theme-qa.cjs (6+1 shots via console-qa-stub.cjs —
  extracted shared stub module), scripts/fontcheck.cjs (computed-font
  per cast: serifLoaded true only on serif themes). AAA contrast
  15.6-17.9:1 all six; colored ≤0.7%.

WAR STORY: local `tsc -p tsconfig.json` at repo root passed while CI's
`tsc -p tsconfig.web.json` failed (specimen typed `string`, populated
`string[]`). ALWAYS typecheck with apps/desktop/tsconfig.web.json +
tsconfig.node.json before pushing. Also: packages/engine + shared must
be built before node tsc passes locally.

ENV QUIRK: scripts/console-qa.cjs + theme-qa.cjs write shots to
<cwd-parent>/download — from repo root that's /home/z/download; copy to
/home/z/my-project/download after runs. Playwright must be required from
repo root (no /tmp scripts).

NEXT QUEUE: overlay capsule depth (gradient border + blur), statusbar
theme pass, website theme-sync with app, README themes section, MOTION.md
update with spring/lift/roll entries.

## Session 12 (2026-11-20) — v0.1.46 "THE DITHER PASS" — RELEASED ✅

User: "https://tripwire.sh/dither-kit USE IT, USE IN OUR APP, CREATE MOTION
DESIGN, OVERLAY SYSTEM, WHOLE SYSTEM FOR BEST UI EXPERIENCE, BETTERMENT
EVERYWHERE."

WebFetch timed out on the page; fetched https://tripwire.sh/dither-kit.md
(the "plain-markdown docs for agents" link) via curl — full API doc.
dither-kit = shadcn-style dithered chart kit (ordered-dither fills,
entrance anims + replayToken, gliding scrub tooltip, bloom "aura",
gradient/dotted/hatched variants, sparklines, avatars). HOUSE RULE: no
third-party component libs in our UI → ported TECHNIQUES into our
zero-dep engine; INSPIRATION.md lineage entry added (nothing installed).

**v0.1.46 SHIPPED** (PR #13, CI 5/5 first try, tag + Release verified,
LATEST FEED = v0.1.46; main @ eb701b4):

- packages/signal-engine/src/ditherui.ts — Engine F "DitherCanvas":
  Canvas2D Bayer 8×8 fills for UI. KEY DESIGN RULE: dot DENSITY carries
  tone, dots are always FULL INK (first version blended ink→paper per
  dot → gray mush; fixed). Variants gradient/dotted/hatched, aura bloom
  (blur 14px @16%), 620ms out-expo entrance sweep, IO-gated, DPR≤2,
  reduced-motion static. Exported from signal-engine index.
- signal-engine ships as SOURCE (main: src/index.ts) — no build needed,
  just tsc --noEmit. Desktop needed "@whisperflow/signal-engine": "*"
  added to deps (was importing @whisperflow/engine by mistake — that's
  the whisper.cpp inference engine!).
- InsightsTab: 7-day bars = DitherBar components (dithered, accent,
  replay button, scrub tooltip), Sparkline ("fig. 02"), stat cards
  DitherWash, heatmap = 5 dot-density steps via radial-gradient
  backgroundSize 3px. Route: #/activity/insights.
- Overlay.tsx: gradient hairline ring (::before, mask-composite xor,
  --cap-glow), theme-accent bridge (localStorage wf-theme → ACCENTS
  map), word-in entrance on final words (partials flat — no jiggle).
- QA: scripts/insights-deep.cjs + insights-phases.cjs (canvas sizes/
  painted fractions over time), theme-qa.cjs extended with insights
  shots. console-qa-stub.cjs history seed FIXED: must use REAL
  TranscriptItem shape (createdAt/rawText, NOT at/text) + word counts
  linear (earlier seed was words²/30 by accident).

WAR STORIES:
1. Canvas mounted pre-flex-height paints at 78×2 and never re-measures →
   ResizeObserver in DitherCanvas.mount() repaints on box change.
2. Pixel-slice analysis of screenshots is fragile (bar x-ranges merge,
   dots sparse) — DOM getBoundingClientRect + style.height% is the
   RELIABLE assertion; screenshots only for dot-structure/color audits.
3. Electron renderer: `ctx.filter = "blur(...)"` works in Canvas2D
   (Chromium) — used for aura bloom.
4. Route map: nav.ts SUB ids → resolveRoute; insights = activity/insights.

NEXT QUEUE: History mode-split DitherBars, Models tier dots, overlay
trace in theme accent, website charts on DitherCanvas, MOTION.md entry
for the 620ms sweep + 150ms word-in.

## Session 14 (2026-11-21) — v0.1.48 "THE PRESS ROOM" — RELEASED ✅

User: desktop app still old design — study reactbits/canvasui/21st.dev,
full redesign, max creativity. RESEARCH MINED:
- canvasui.dev: 38 comps (server-rendered 3-4MB pages ARE scrapable:
  /docs/components/<name> gives description+source; ascii-sweep, dithered/
  ink/topographic-object, glyph-rain, decrypt-reveal, canvas, frost, peel)
- reactbits: full catalog via GitHub API DavidHDev/react-bits
  src/content/{Backgrounds,Components,TextAnimations,Hooks} — 66/49/33
- 21st.dev: community counts (2k+ buttons, 1.7k cards)

VLM AUDIT OF OUR OWN CONSOLE drove the spec (not the libraries): dead
sidebar, half-empty content col, NO live data, weak CTA hierarchy, 28px
tabs, zero motion. Spec: scripts/v2-design-spec.md.

**v0.1.48 SHIPPED** (PR #15, CI 5/5 first try, main @ 36319ec):
- THE PRESS KIT apps/desktop/src/renderer/src/shared/presskit.tsx (zero
  deps): PrintButton (ink-flood L→R roller pass + gloss sweep + stamp
  press; variants fill/plate/ghost/danger), SpotlightCard (rAF-eased
  cursor ink wash, lags like wet ink; SPREADS ...rest for data-*), PillNav
  (measured sliding indicator), DecryptText (charset ·:•%#%@&), CountUp,
  Magnetic, AuroraField (3 lissajous washes, alpha ≤.10), DotRadar,
  AnimatedRows (--pk-row-delay stagger). All honor prefers-reduced-motion.
- 3-PANE SHELL App.tsx: rail + sheet (AuroraField fixed inset-0 behind,
  max-w-3xl) + LIVE RAIL 260px xl:flex (mic halftone meter — GATED behind
  navigator.permissions.query so settings never prompts for mic; engine
  decrypt label; model from config.stt.modelId + ModelCatalogEntry.name;
  today from history[0].finalText length).
- ui.tsx: Button wraps PrintButton (primary→fill, ghost→plate), Card wraps
  SpotlightCard, PageHeader H1 decrypts. KEY: SpotlightCard needs prop
  spread or data-stage-row cascade breaks.
- GeneralTab: checklist rows = full-width <button> with revisit affordance;
  ChangeRow = pk-btn-plate.
- Onboarding: aurora + DecryptText headings (regex decoration of h1s broke
  JSX twice — duration={560} braces + template literal attr; check after!).

BUGS CAUGHT BY VLM/PIXEL LOOP (all fixed + re-measured):
1. Aurora invisible: alpha .045 too quiet → .10/.07/.06; verified spread
   29.6 luminance across columns.
2. Meter read as dashed line: 8% floor × 34px = 2.7px bars → floor .18 +
   40px height; verified 7 distinct accent rows.
3. Spotlight verified localized (26.4 vs 17.8 far side).

WAR STORIES:
1. electron-vite build "fails" when run from repo root without cd
   apps/desktop — shell cwd resets between commands; ALWAYS cd in the same
   command chain. console-qa then screenshots STALE assets silently!
2. QA script was waiting on body.light (v0.1.44 skin) — themes are
   data-theme now; waitForFunction on documentElement.dataset.theme.
3. VLM "checklist out of order" = stub-data artifact (fake config had
   snippet done but not dictionary) — not a UI bug; verify against harness
   data before "fixing".

NEXT QUEUE: FieldFX (asciify inputs), GlyphRain error states, topographic
Insights background, aurora on ThemePicker specimens, MOTION.md entry for
press kit envelopes.
