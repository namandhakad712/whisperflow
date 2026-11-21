# Changelog

All notable changes to WhisperFlow. Format: [Keep a Changelog](https://keepachangelog.com), SemVer.

## [0.1.49] — 2026-11-21

### Added — the front page: console v3 (home, live previews, your press)
- **THE FRONT PAGE (HomeTab, new default route `#/home/front`)**: hero
  with the halftone plate (ink rings + bayer core, breathing), 56px+
  display with italic accent word ("speak. *it writes.*"), decrypting
  greeting + live engine state, jumbo pill CTA that fires a REAL
  dictation (window.whisperflow.dictation.start) with the hotkey chip
  inside, micro-meta line (model · chars-today countup). Below: 4-cell
  bento — recent print runs (fanned rows), press status (engine/model/
  dictionary with [ok] states), today's print run (runs/chars/secs
  countups, honest empty state), the six prints (live swatch sheets,
  one-click apply). Patterns from the bestdesignsonx wall study
  (INSPIRATION.md lineage).
- **THE OVERLAY STAGE (OverlayTab)**: users finally SEE the capsule
  before ever pressing the hotkey — a chrome-framed "desktop" with a
  faithful capsule replica (same geometry + scope easing) cycling
  rest/listening/printing/transcript, with a live mic trace, Engine G
  mood inks (calm/bright/storm bloom pads), and a voice on/off toggle.
- **YOUR PRESS (PressPrefsCard, GeneralTab)**: density (compact/
  regular/roomy), motion (full/calm/still), paper grain (off/subtle/
  full) — data-attrs on <html>, localStorage-persisted like themes,
  zero IPC/config change.
- **Print loaders**: Spinner is now the PressLoader (5-dot halftone
  warm-up); PlateSweep (bayer-dot comet on a 2px rule) rides the model
  download rows.
- **Fluid responsive**: live rail folds to a horizontal strip <1100px;
  rail collapses to a 64px icon rail <900px; hero title clamp(40→62px);
  press grid + bento collapse; plate scales down.
- Nav: Home is channel 00 (House icon); DEFAULT_ROUTE now home/front.
- QA: console-qa now shoots home/stage/l4/your-press (20-23); stub
  history fixed to the real TranscriptItem shape (createdAt + raw/final
  — was rendering Invalid Date). VLM loop closed: hero spacing, empty
  states, bloom visibility (hairline rings → filled radial ink pads).

## [0.1.48] — 2026-11-21

### Added — the press room: console v2 (full redesign)
- **The press kit** (shared/presskit.tsx, zero deps): PrintButton (ink
  floods the label L→R — a roller pass — plus specular sweep and stamp
  press), SpotlightCard (cursor-tracking ink wash, rAF-eased, lags like
  wet ink), PillNav (40px tabs, layout-measured sliding indicator),
  DecryptText (printer's charset ·:•%#%@&), CountUp (odometer), Magnetic
  (2px lean), AuroraField (two-ink lissajous wash at wash-level alpha),
  DotRadar (dot grid that grows near the cursor), AnimatedRows (40ms
  staggered settle). Grammar studied from reactbits / canvasui / 21st.dev
  (browsed Nov 2026, NOTHING installed — every component authored
  in-house in our print language; lineage in INSPIRATION.md).
- **Three-pane shell**: rail + sheet + LIVE rail (mic halftone meter,
  engine state with decrypt label, model + ready count, hotkey, today's
  chars via CountUp). Live rail hidden < 1100px. The mic meter never
  prompts — it only runs when permission is already granted.
- **The sheet breathes**: content max-w up, AuroraField behind it,
  cards are all SpotlightCards, page H1 + hints decrypt per route.
- **SetupChecklist rebuilt**: full-row interactive (click navigates,
  completed rows show "revisit →" on hover), progress integrated,
  spotlight card. ChangeRow buttons are ink-flood plates.
- **Onboarding**: aurora backdrop + decrypt headings on every step.
- Sub-nav is the PillNav; breadcrumb deduped; rail microcopy contrast
  bumped; tab underline strengthened.
- QA: console-qa harness v2 (12 shots: press-room wide, ink-flood
  hover, spotlight, daylight, onboarding) + theme-qa 6+1 prints. VLM
  audit loop: aurora verified painting (luminance spread 29.6), meter
  = 7 distinct bars, spotlight localized (26.4 vs 17.8 far side),
  ink-flood confirmed on hover.

## [0.1.47] — 2026-11-21

### Added — the inkbloom pass: the voice, printed (Engine G)
- **InkBloom** (signal-engine, zero-dep Canvas2D): a halftone ink field
  that rises with the voice along the capsule's bottom edge. Louder =
  bigger dots climbing higher; tone pools at the base like a tide mark.
  Bayer micro-variation keeps the crest granular; idle shimmer breathes
  at ~2Hz. An "emotion print" (calm/intent/bright/urgent) is derived
  from the level stream's mean + variance and tunes ink mix, rise and
  sweep speed. While the model works, a press-roller sweep crosses the
  field left→right.
- **Overlay**: the bloom strip replaces nothing — it layers under the
  glyph wave and live text, over the glass. Capsule hover micro-pass:
  hairline leans into the accent, glass lifts (120ms), press sets into
  the sheet. Attach via callback ref (the overlay returns null while
  idle — the mount-once effect never saw the canvas; found by the new
  overlay QA harness).
- **Website CTA — the nocturne**: SCENE_NOCTURNE closes the page — night
  dunes with contour striations, a sparse star field, one glowing
  horizon arc in accent ink; two-ink print in light and dark. Replaces
  the re-used orchid at the CTA.
- **Settings cards**: press state (scale 0.997, 80ms) — print
  discipline, no bounce.
- Technique lineage: Voice Glow (libraries.dev, browsed Nov 2026) for
  the audio-reactive rising-field + thinking-sweep grammar; Odyssey's
  generative nocturnes for the CTA mood. Everything implemented
  in-house — nothing installed. See INSPIRATION.md.
- QA: new overlay-qa harness (state machine + fake mic + engine drive
  hook) and website-qa harness (CTA screenshots, both modes). Bloom
  verified painted in all states; tide-mark gradient confirmed by band
  analysis; nocturne confirmed by pixel + VLM audit.

### Fixed
- InkBloom depth formula was inverted twice during tuning (flame
  instead of tide) — the QA band analysis caught both.

## [0.1.46] — 2026-11-20

### Added — the dither pass: data printed as dots (Engine F)
- **DitherCanvas** (signal-engine, zero-dep Canvas2D): ordered Bayer 8×8
  fill surfaces for UI — bar fills, washes, heatmap ramps — with
  gradient/dotted/hatched variants, "aura" bloom underlay, a 620ms
  out-expo entrance sweep, IntersectionObserver gating, DPR cap 2, and a
  ResizeObserver so a canvas laid out mid-animation still paints
  (the collapsed-flex bug this release fixes). Dot DENSITY carries the
  tone; every dot stays full ink — that's what makes it read as print.
- **Insights, dithered**: the 7-day words chart is now seven dithered
  bars in the theme accent with aura bloom, a replay button (re-sweeps
  the entrance), a gliding scrub tooltip, and a one-line sparkline
  ("the week, one line — fig. 02"). Stat cards carry a quiet dotted
  wash; the 12-week heatmap renders as five dot-density steps of the
  accent — a press ramp, not flat alpha.
- **Overlay depth pass**: the capsule gains a gradient hairline ring
  (top-lit, mask-composited, theme-accented), and it follows the
  console theme's accent — press green capsule on Press Room, cobalt on
  Night Ink. Final words land with a 150ms word-in rise; partials stay
  flat so live text never jiggles.
- Technique lineage: dither-kit (tripwire.sh) studied for the
  interaction grammar (entrance/scrub/bloom/variants); everything
  implemented in-house. Nothing installed — see INSPIRATION.md.

### Fixed
- Dither canvases mounted before their flex parents granted height
  painted once at 2px and never re-measured. ResizeObserver repaints on
  layout change; verified per-bar heights match word counts exactly.
- Typecheck failures under the strict project configs (undefined-safe
  palette lookups in glyph/painted engines).
## [0.1.45] — 2026-11-20

### Added — the Theme Press: six themes, each a print process
- **Six full themes** in settings → Dictation → "the theme press":
  Lab (dark instrument, phosphor), Press Room (warm cream, print green,
  serif display), Night Ink (deep ink-blue sheet, cobalt signal, serif),
  Letterpress (cold press, vermilion ink), Lino (ochre sun on proofing
  white, serif), Daylight (studio white, LED green). Each is a complete
  token set — neutrals ramp, accent, semantic hues — on the v0.1.44
  luminance discipline (hierarchy from luminance steps, accent scarce).
- **Type casts, not just colors**: the serif-cast themes hand the display
  role to Instrument Serif (the website's editorial register); grotesk
  themes keep Space Grotesk. JetBrains Mono stays labels/eyebrows
  everywhere. The theme decides the casting (`themes.ts`).
- **ASCII specimens in the picker**: every theme card carries its mark
  rendered in the halftone ramp ` ·∙•⦁●` with the accent in the peaks —
  the print-shop DNA of the website, now in the app.
- **Scramble-decode** (MOTION.md signature) on rail channel numbers:
  hover cycles the glyph ramp ` .·:;=+x%#@`, settles left→right at
  42ms/frame. Reduced motion settles instantly.
- **Spring toggles**: toggle knobs travel on the `spring` curve (200ms)
  with the accent fill reserved for ON.
- **Card lift**: cards rise 1px on out-expo (150ms) with a stronger
  hairline — a print sheet leaving the bed.
- **Theme swap motion**: the console rolls over on `scope` (380ms) —
  a soft blur-settle, not an instant flip.
- **Theme everywhere**: topbar button cycles the press; Ctrl/Cmd+K
  palette lists all six ("theme: Press Room — …"); choice persists and
  migrates the old lab/daylight skins.
- QA: 6-theme screenshot harness (`scripts/theme-qa.cjs`), computed-font
  verification per cast, contrast 15.6-17.9:1 (AAA) on every theme,
  colored-pixel coverage ≤0.7%.

## [0.1.44] — 2026-11-20

### Changed — the instrument, tuned (color discipline overhaul)
- **Luminance-stepped neutrals** replace the flat dark theme (bg #07080A →
  paper #0C0D0F → raised #111214 → hover #1B1C1E): hierarchy now comes from
  2-4% luminance steps, not hue — the Raycast/Linear discipline.
- **Accent scarcity (60-30-10)**: phosphor green is now reserved for LIVE
  signal only (recording, active LED, the hotkey readout, primary CTA).
  Measured coverage dropped from ~30% to under 1% of pixels.
- **Semantic color system**: amber = busy/processing, violet = AI/polish
  surfaces, coral = errors/destructive, sky = info/links/downloaded.
  Every hue means exactly one thing (color psychology).
- Navigation, selection, hover and segmented controls are NEUTRAL now —
  the rail active state is paper-3 + ink text + one 2px phosphor mark.
- **Depth via insets + translucency**: cards get inner top-light, the
  command palette is real glass (backdrop blur 12px + gradient fill +
  1px light border), no outer shadows below 24px elevation.
- **WCAG AA+**: primary text 17.3:1, secondary 7.1:1 on both skins.
- Print-grain body texture (1-bit SVG dither, 5% whisper), corner-bracket
  card frames (neutral, phosphor on hover), Daylight skin retuned to the
  same stepped ramp.

## [0.1.43] — 2026-11-19

### Added — the ASCII revolution
- **Engine E: GlyphScene** (`packages/signal-engine/src/glyph.ts`) — the TRUE
  ASCII renderer: tone → glyph ramp (Bayer-dithered), scene color INSIDE the
  glyphs (truecolor), living lattice re-raster, pointer parallax, mode-reactive
  paper. Canvas2D fallback included.
- **GLYPH_SCENE_BLOOM** — the orchid hero printed as real `x X # @` glyphs,
  plum/violet ink, green lip, whisper plate for the copy.
- **GLYPH_SCENE_GARDEN** — seven procedural ASCII tulips on swaying stems
  over a dithered soil band; station 3 in accent green, station 5 in coral.
- **Website**: hero now prints in ASCII glyphs (was halftone dots); the
  privacy specimen band is now the ASCII garden; CTA prints the orchid.
- **Desktop overlay**: the voice trace is now an ASCII GLYPH WAVE — mic
  level maps through ` .:=+x#@`, bright #8CFFC7 peaks, so the capsule
  literally shows voice becoming text.
- Desktop settings rail nameplate gets `printed in ascii` mark.

### Fixed
- Glyph atlas now rebuilds when webfonts finish loading (boot race left the
  hero printing ghost glyphs when the mono font arrived late).
- Photo textures no longer set `crossOrigin=anonymous` on same-origin URLs
  (blocked the orchid on hosts without ACAO headers) and are decoded before
  upload (`img.decode()`), fixing empty boot renders.
- All texture uploads bind an explicit unit — no more atlas/image clobbering.

## [0.1.42] — 2026-11-19

### Added — the console, refined (desktop settings overhaul)
- **Command palette (Ctrl/⌘+K)** — "the patch bay": jump to any of the 18
  settings screens by fuzzy match, plus live actions (switch skin, replay
  onboarding). Keyboard-first (↑↓ + Enter, Esc), LED state per row, phosphor
  selection rail, mono route hints. Replaces the plain search dropdown.
- **Channel-numbered rail** — the five pages now carry instrument channel
  numbers (01-05) that light phosphor on hover and on the active channel.
- **Screen staging** — every route change lays the screen on with a 260ms
  out-expo rise; cards inside cascade 30ms apart. Full `prefers-reduced-motion`
  path (no animation).
- **`///` channel readout** above each screen body (page - route), matching
  the website's section eyebrows.
- **Onboarding rebuilt to the Signal Standard** — `///` step marks (signal
  check / input / engine / downloads / live), LED `[ok]` states, square
  step markers, mono metadata, phosphor hotkey readout on the finish card.

### Fixed
- **Theme picker desync** — Settings - Dictation - General still offered the
  retired "Nocturne / Dawn / Classic" skins; choosing one wrote a value the
  new skin reader ignores, silently reverting to Lab on relaunch. Now offers
  Lab / Daylight and migrates legacy values (`nocturne`/`dawn`).

### Changed — website
- **Mobile navigation** — a real full-bleed menu sheet (the old header showed
  no nav links at all below 768px): serif index rows with mono channel
  numbers, staggered lay-on, theme toggle and download inside the sheet.
- **Scramble-decode nav hover** on desktop — links cycle the glyph ramp
  ` .·:;=+x%#@` and settle left-to-right, the signature motion documented in
  MOTION.md. Instant under reduced motion.
- **README fully rewritten** — new "The Signal Standard" section, the console
  tour (palette hotkey in the table), signal-engine in the workspace map,
  MOTION.md / AGENTS.md as the design-contribution contracts, honest
  screenshots section.

## [0.1.41] — 2026-11-19

### Added — the Signal Standard (brand + visual identity)
- **The entire product now speaks one visual language.** A zero-dependency
  WebGL engine (`packages/signal-engine`) renders the brand: an ordered-dither
  field that breathes, ASCII oscilloscopes drawn from your voice, halftone
  reveals and scramble-decode typography — on the website, and in the app's
  overlay, toggles and status rail.
- **The overlay capsule** now draws a live phosphor trace of your voice while
  you speak, with afterglow decay when you stop. Standby is a single breathing
  dot; speaking expands to the 384x56 capsule. Every behavior (hold-to-talk,
  toggle modes, escape) is unchanged.
- **LED state system** in Settings: every toggle is an instrument switch with
  a lit state line, not a generic checkbox.
- Website rebuilt on the same tokens (13 pages), with `MOTION.md` (authored
  timings) and `INSPIRATION.md` (technique lineage) as governance docs, and an
  `origin-check.yml` CI gate that fails the build if retired borrowed values
  reappear.

### Changed
- `apps/desktop/package.json`: bumped to 0.1.41.

## [0.1.40] — 2026-11-18

### Added — sequential dictation (experiment)
- **Keep talking while the last sentence is still processing.** With sequential
  dictation on, a pause no longer ends your turn: the mic stays open, each
  finished utterance is transcribed and polished on its own, and the text is
  pasted in order the moment it is ready. A slow AI polish never blocks your
  next thought.
- The pill shows how many utterances are already in, with the last one it
  delivered, so you can see the queue draining while you keep speaking.
- Turn it on in **Settings → System → Experiments**.
- The turn ends only when you stop it (hotkey / second press / Escape) — silence
  never cuts you off in this mode.

### Changed
- `apps/desktop/package.json`: bumped to 0.1.40.

## [0.1.39] — 2026-11-17

### Added — settings search and tray health
- **Settings search**: press Ctrl+K (or Cmd+K) anywhere in Settings and type to jump straight to the screen you want — "health", "hook", "scratch", "privacy". Matches show with their page; Enter takes you there instantly.
- **Tray → Health**: the tray menu now has a Health item that opens Settings directly on System → Health, so "I spoke and nothing happened" is one click away from a diagnosis.

### Changed
- `apps/desktop/package.json`: bumped to 0.1.39.

## [0.1.38] — 2026-11-16

### Added — settings overhaul, health checks, and the end of option-clutter
- **Settings restructured into five pages**: Dictation, Models, Personalize, Activity, System — each with its own sub-nav. Every one of the 16 previous screens still exists; nothing was deleted, only grouped by intent so the "wall of options" is gone.
- **Duplicate control removed**: cloud polish was configurable from both Advanced and Models; it now lives only on the Writing style screen.
- **Health tab (System → Health)**: the answer to "I spoke and nothing happened". Runs setup checks — hotkey, transcription engine, AI polish, microphone, cloud-lock, personal dictionary — and every failing check shows the fix plus a deep-link to the screen that resolves it.
- **Overlay position fixed**: the pill now opens at your configured anchor on the first frame instead of opening at the cursor then sliding away.

### Changed
- `apps/desktop/package.json`: bumped to 0.1.38.

## [0.1.37] — 2026-11-14

### Added — profiles, spring physics, and cloud-first transcription
- **Config profiles (work/home)**: `Settings → Profiles` keeps named layers over your base config.
  Switch a profile and dictation behaves differently (tone, models, dictionary) without touching
  your global settings — the layer is merged on top at the start of each dictation, so the base
  config is never mutated. Stored as `profiles.layers` + `profiles.active`.
- **Spring-physics pill**: the overlay's state morphs now run on a real spring (`stiffness 320`,
  `damping 26`) instead of a CSS bezier, and window repositioning no longer fights the animation —
  a same-position resize is applied instantly so the renderer owns the motion. This is the
  "snappy" feel: the pill overshoots a hair and settles, rather than easing linearly.
- **Cloud-only dictation is first-class**: you can run WhisperFlow with **no local model at all**.
  Groq's free tier alone is 28,800 audio-seconds/day — **8 hours of talking, free, no card** — and
  the Models tab now renders each provider's limits as chips so the trade-off is visible before
  you commit. STT and polish are independent: local STT + cloud polish, cloud STT + local polish,
  or all-cloud all work.
- **Clear failure when the engine isn't usable**: selecting cloud without a key (or a local model
  that isn't downloaded) used to drop the audio silently — "I spoke and nothing happened". The pill
  now says exactly what's wrong, once per turn: "Cloud transcription isn't set up — add an API key
  in Settings → Models".
- **MSI installer**: Windows releases now ship both NSIS (`.exe`, per-user, auto-updating) and MSI
  (per-machine, silent, for Group Policy / SCCM deployment).
- Model cards for cloud STT re-verified against provider docs on 2026-11-14 (Groq's whisper models
  are 20 RPM / 2,000 requests/day / 7,200 audio-sec/hour / 28,800 audio-sec/day each).

## [0.1.36] — 2026-11-09

### Added — hooks JSON format + repo hardening
- **Hooks can now send JSON**: the Hooks editor gained a "Transcript format" selector. `text`
  (default) keeps the raw transcript on STDIN / as the body; `json` sends
  `{"text": "…", "timestamp": …}` on STDIN for commands (webhooks keep the documented
  `{app, event, text, timestamp}` contract). The argv safety contract never changes — the
  transcript is never interpolated into the command line, in either format.
- **Repo hardening (not a release feature):** `main` now requires a PR review + passing CI, blocks
  force-push and deletions, and enforces admins. The installer build documents the optional
  signing secrets (`WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`) — unsigned builds stay the default,
  but a signing key can be dropped in without code changes.
- **MSI Support for Enterprise Deployment**: Windows builds now include an MSI installer target
  alongside the default NSIS installer, facilitating silent deployments via Group Policy or SCCM
  in managed environments.

## [0.1.35] — 2026-11-09

### Added — sync through YOUR cloud (P2 from IMPROVEMENT-PLAN)
- **Settings → General → "Sync between machines"**: pick a OneDrive/Dropbox folder and
  WhisperFlow writes `whisperflow-sync.json` there on every config change — config + dictionary +
  scratchpad, **never audio or history**. The file is watched for remote updates (3 s poll, since
  OneDrive/Dropbox don't send FS events reliably), and the conflict policy is last-writer-wins
  per top-level key: two machines editing different settings never clobber each other. There is
  NO server of ours — the folder is the user's, so the privacy story holds.

## [0.1.34] — 2026-11-09

### Added — audit log (the enterprise checkbox)
- **`logs/audit-YYYY-MM-DD.log`**: append-only, one-line-JSON-per-event. Records what was
  **pasted** (text length + target app) and **cancelled**, local-only, rotated daily with the app
  log. It never contains audio, transcripts, or keys — the honest answer to "what leaves this
  machine": nothing does by default (`privacy.localOnly` hard-blocks every network provider), and
  the paste trail is right there for a security team to parse.

## [0.1.33] — 2026-11-09

### Added — per-mode STT model + language (P1 from IMPROVEMENT-PLAN)
- A Mode can now override **which speech-to-text model and which language** its app uses. The
  editor gained "STT model" and "Language" selects; an empty value keeps the global settings.
  `ModeProfile.stt` applies through `applyModeOverrides` exactly like the polish overrides — so a
  developer can have a fast small model for Slack and a big accurate one for Gmail, and a
  bilingual user can force `en` in the IDE and `de` in email. The mode card badges the overrides.
  Resolver test added (model + language merge; empty strings keep the global).

## [0.1.31] — 2026-11-07

### Added — post-dictation hooks
- **Settings → Hooks**: fire-and-forget automation on every completed dictation. Two kinds:
  - **Command** — an executable + args, spawned WITHOUT a shell; the transcript arrives on
    STDIN, never interpolated into the command line, so a transcript can never become an
    injection. Example: append every dictation to a notes file or pipe it into a script.
  - **Webhook** — POSTs `{ app, event, text, timestamp }` JSON to any URL.
- Hooks are non-blocking by contract: they never slow a dictation, never see a cancelled turn,
  and a 10-second watchdog kills a stuck command. Failures land in the log only — a broken
  webhook can never break your typing. This is the biggest remaining team ask from the personas
  study (a pipeline hook turns WhisperFlow from an input method into a tool). 4 runner tests.

## [0.1.30] — 2026-11-06

### Added — vocabulary packs (shareable dictionaries)
- **Settings → Dictionary → Export pack** writes your whole dictionary as one JSON file —
  pronunciation and hints included — and **Import** accepts both packs and the plain word lists it
  always did. A pack merge never duplicates: existing terms (case-insensitive) are *enriched* with
  the pack's metadata, never overwritten; new ones are appended with generated ids. This is the P0
  team feature from the personas study: a clinic, a team, or a study group can share one vocabulary
  as a file — no server, no account, nothing to sync. docs/EXTENDING.md updated.

## [0.1.29] — 2026-11-06

### Added — community + docs day
- **`docs/EXTENDING.md`** — the complete customization reference: every knob (UI tab *and* config
  key) with defaults, 7 copy-paste config.json recipes (meeting notes, developer, non-native
  speaker, accessibility, privacy-paranoid, cheapest-cloud, email), and an honest ranked gap list
  of what you *can't* configure yet.
- **`docs/research/personas-and-positioning.md`** — the personal→corporate ladder: 5 personas with
  their real pains, the psychology of adoption/retention for voice products, where local-first
  structurally wins/loses, and a P0/P1/P2 12-month ladder with tier mapping.
- **Issue templates** (bug / feature / config question), a **PR template** with the verification
  checklist + size justification, and **dependabot** (grouped minor/patch, Electron its own group,
  native-module majors held for human review).
- **CONTRIBUTING rewritten** — the workspace golden rule (rebuild `packages/shared` first), the full
  verification loop, config-schema migration policy, and the release flow.

### Changed — the updater tells you what's coming
- The update banner now shows **what's new**: release notes ride along on both "downloading…" and
  "ready to restart", HTML-stripped and clipped to the first sentence. No more installing a
  background download blind.

## [0.1.28] — 2026-11-05

### Changed — the sub-100 MB push
- **Local polish's CUDA backend no longer ships (−174 MB unpacked).** `ggml-cuda.dll` only loads on
  machines with the full CUDA *toolkit* runtime (cudart + cuBLAS system DLLs) — an NVIDIA driver
  alone is not enough, so outside ML workstations it never loaded. node-llama-cpp resolves backends
  in priority order and falls back to **Vulkan** through the driver's own `vulkan-1.dll`: NVIDIA
  users keep GPU-accelerated local polish, everyone else was never on CUDA. Power users can
  `npm i @node-llama-cpp/win-x64-cuda` into the app folder to restore the path.
- **Two never-imported font packages dropped** (`@fontsource-variable/figtree`,
  `@fontsource/eb-garamond`): no CSS ever imported either; the "Figtree" names in font-family chains
  were already falling through, so nothing changes visually.

### Fixed
- **Escape in meeting mode leaked the system-audio capture** — `cancel()` never released the hidden
  loopback window, leaving a live desktop-audio capture running after its turn (leak + privacy bug).
- **The app boots tray-only** once onboarding is complete: the full Settings React window used to be
  created at every boot and live all day (~100–175 MB of idle footprint). First-run users still get
  onboarding; tray click / menu / re-launch surface the window any time.

## [0.1.27] — 2026-11-05

### Added — per-app corrections
- **Modes now carry their own dictionary.** A mode can spell terms one way for one app and another
  way elsewhere — add the term under "Corrections for this app" in the mode editor (one per line) and
  the fuzzy matcher applies it only while dictating into that app, matched ahead of the global
  dictionary. The mode card shows the count as a badge.

## [0.1.26] — 2026-11-05

### Fixed
- **Backups now include Scratchpad notes.** The notes live in the settings app's localStorage, so
  "Export backup" (config + history) silently dropped every note, and restoring from a backup lost
  them all. The export reads `wf-scratchpad-notes` out of the settings window's storage and packs it
  into the backup file; the import writes it back. When the settings window hasn't been opened in the
  session the notes can't be read — the export says so in the log instead of pretending it saved
  them.

## [0.1.25] — 2026-11-05

### Added
- **Deepgram Nova-3 as a cloud STT provider** (Settings → Models). Deepgram is not
  OpenAI-compatible, so it gets its own request path: the model rides in the query string
  (`/v1/listen?model=nova-3&smart_format=true`), the audio is the raw WAV body, and the transcript
  comes back out of `results.channels[0].alternatives[0]`. $200 free credit with no card; Smart
  Formatting (dates, numbers, punctuation) is included with the model. The key check uses
  `GET /v1/projects` (Deepgram has no `/models`) so verifying a key never spends transcription
  credit. 2 new request-shape tests.

## [0.1.24] — 2026-11-04

### Added — live partial transcript
- **Words now appear on the pill WHILE you talk.** A long utterance used to be a wall of silence
  until the 700 ms silence closed the segment. Now, the moment speech opens a segment, the
  accumulated audio is transcribed every ~1.2 s and broadcast as the live partial — the pill fills
  with text as you speak. LOCAL STT only (partial audio is never uploaded to a cloud provider, so
  a BYOK key is never billed for interims), at least a second of speech before the first interim,
  interims serialize through the same whisper queue as the final transcribe, and the tokens are
  stripped by the same `[BLANK_AUDIO]` filter. Toggle: `audio.vad.livePartial` (default on).

## [0.1.23] — 2026-11-04

### Added
- **Dictation chimes** — a soft rising chime when a dictation starts and a falling one when you
  cancel (the same affordance Hex ships; it's how you know the hotkey registered without looking).
  The WAVs are generated by a script (two-tone chimes, no licensed assets), played at 50 % volume
  in the overlay renderer from a data URL, and toggleable under Audio → Dictation chimes (on by
  default). A chime never blocks or fails a dictation.
- **Qwen3 8B polish tier** — the heavier-rewrite local model (non-thinking mode so rewrites stay
  quick, Apache-2.0, ~4.9 GB), repo verified live on HuggingFace. The 4B's copy now points at it
  as the middle tier.

## [0.1.22] — 2026-11-04

### Added — meeting capture
- **Meeting mode now records the call, not just you.** Turning it on captures the Windows system
  audio loopback (everyone on the call) via Electron's desktop capturer — no WASAPI sidecar, no
  native build — through a hidden capture page whose PCM feeds the session exactly like mic chunks.
  Transcription still runs locally. The capture window is torn down with the session so a live
  desktop capture never outlives it, and the mic capture stays off in meeting mode so the two
  sources never interleave in one stream. The Overlay tab's hint now says what meeting mode does.

## [0.1.21] — 2026-11-04

### Added — Modes
- **Per-app formatting profiles.** Add a Mode in Settings → Modes with a match pattern ("slack",
  "gmail", "code"…) and the overrides you want for that target. The first enabled mode whose
  pattern matches the app you're dictating into — matched against the app name, the window title,
  **and the browser URL**, so "gmail" covers both the Gmail app and gmail.com — wins over the
  global polish settings. Tone, cleanup level, format, email signature, and extra instructions are
  all overridable; anything left on Auto falls back to global. 8 new engine tests, and the match is
  logged per dictation so you can see which mode fired.

## [0.1.20] — 2026-11-04

### Added
- **Model cards.** The Models tab shows every model as a card with the three things people actually
  compare — Speed · Size · quality — plus recommendation badges, ACTIVE/on-disk pills, the license,
  inline download progress, and a one-click primary action. The horizontal scrollbar is gone
  (rows wrap, nothing overflows the panel), and "Graphics: unknown" renders as "Not available".
- **Tray model switch:** right-click the tray → Model → any downloaded STT model. The active model
  is checked; un-downloaded entries are disabled; the list refreshes after every switch.

### Fixed
- **A lens press with nothing selected now opens the bar** with a "nothing selected — highlight the
  text to edit, then press the hotkey again" hint instead of silently doing nothing (a shortcut
  press that does nothing is the worst response).

## [0.1.19] — 2026-11-03

### Changed — one position model, the overlay and the rest pill are the same thing
- **The resting dash now lives inside the overlay window.** There is no separate docked status
  window and no `dockEdge` anymore: the dash parks wherever the overlay is positioned and morphs
  in place at the end of each turn (`overlayRestBar`). Old configs migrate — `dockEdge` maps to the
  nearest anchor and turns the resting bar on. Hover the dash and it expands to the mini pill with
  the hotkey hint; click it to start a dictation; drag it to move it.
- **Cloud presets repaired:** Groq's `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` went
  Enterprise-only, so a free key silently couldn't use the polish models — replaced with
  `qwen/qwen3.8-27b` (verified against Groq's live model list, 2026-11-03).
- **Settings got a design pass:** premium switch control, one shared focus-ring system, grouped and
  labelled rail, quiet secondary buttons instead of five primaries on the General page, segmented
  choices where a toggle was wrong, and the wall-of-text hints shortened. The Privacy tab now
  states the failure contract: if cloud polish fails, your local transcript is what gets pasted.
- **Paste reliability:** the SendKeys timeout went 1.5 s → 5 s — .NET's cold start beat the old cap,
  which was itself the "SendKeys timed out" failure that dropped real pastes to the clipboard
  fallback.

## [0.1.18] — 2026-10-31

### Fixed — human-reviewer pass (blockers)
- **Hold-to-talk can no longer get stuck.** Releasing the key during the ~5 s cold-start window used
  to leave the dictation permanently armed: `finish()` saw no session yet and no-oped, so the mic
  stayed live and the keyboard hook counted every keystroke for 40+ minutes (reproduced from logs).
  `finish()` now flags a pending release and the session finishes the instant it exists.
- **Rapid hotkey presses can no longer interleave sessions.** `start()`'s guard only checked
  `this.session`, which is assigned after the async work — double-presses spawned parallel sessions
  (leaked mic, one session's collapse hiding the other's pill). A `starting` gate plus a
  mode-aware `toggle()` close the race.

### Fixed — reviewer majors
- **A listening indicator in the default config.** The voice meter and the pill's state were gated on
  the audio-saving mode, so a normal dictation showed *no* sign of listening — and the placeholder
  literally read "Press the hotkey and speak" after you'd just pressed it. The meter now shows
  whenever the app is listening (until words arrive) and the copy says "Listening…".
- **The resting dash is visible on dark desktops.** Pure black-on-black left zero non-black pixels
  over a dark window; it's now a mid-gray pill with a light inner ring (pixel-checked: ~300
  non-black pixels where there were ~0). The false "hover it to see the hotkey" hint now describes
  what the hover capsule actually does.
- **Foreground-app attribution failures are logged** instead of vanishing (per-app stats and history
  filters silently lost data).

## [0.1.17] — 2026-10-31

### Fixed — hold-to-talk was unusable
- **The pill now appears the INSTANT the hotkey registers.** `start()` only showed the overlay after
  the UIA classification probe finished — which cold-starts PowerShell for seconds on first use —
  so in hold mode you held the combo, saw nothing, released, and watched the pill flash in and die.
  The pill now shows cursor-anchored before any `await` and repositions once config loads.
- **Hold vs toggle is now ONE mode, not two flags.** Settings shows a single segmented control
  ("Hold to talk" / "Press to toggle") backed by a new `hotkey.mode` field; the legacy
  `holdMode`/`toggleMode` booleans are derived from it (mutually consistent by construction, old
  configs migrate with tests). Also fixed: rebinding the hotkey silently force-set `toggleMode`
  and kicked you out of hold-to-talk — it now only persists the binding.
- **`[BLANK_AUDIO]` no longer gets pasted into your document.** whisper.cpp prints bracketed
  pseudo-tags on silent segments; every tag is now stripped at the engine choke point (local,
  cloud and mock STT all pass through it) and a segment left empty is dropped instead of stored —
  nothing tag-shaped can reach polish, paste, or history. 8 new engine tests.

### Changed
- **The avatar is a mic icon now**, not the letter "W" (it doubles as the drag handle — drag it to
  move the pill anywhere).

## [0.1.16] — 2026-10-30

### Fixed — the resting pill was invisible/misplaced (two root causes)
- **The status window painted an opaque settings-theme background**: the status bundle imported
  `styles.css` (the settings app's sheet), which fills `body` and covered the whole transparent
  window — the dash and capsule were hidden behind it. The status renderer now ships only its own
  inline CSS. (Captured: an opaque light bar where the dash should be → centered dash after the fix.)
- **The dash sat at the top of the window, not the middle**: `#root` had no height, so the zone's
  `height:100%` collapsed. `#root { width:100%; height:100% }` added; the dash and the hover
  capsule now center exactly.

## [0.1.15] — 2026-10-30

### Fixed — second live-UI pass
- **Card state no longer clips its headings**: the transcribing/polishing card is 80px tall; its content (36px status row + 18px transcript line + 10px padding) now fits inside (was ~102px in an 80px box). Verified with a DOM probe + capture.
- **Theme sync works for real now**: the OS light/dark signal comes from `nativeTheme` in main and is pushed to the overlay (the old `matchMedia` path lagged the OS in Electron and never fired).
- **Top anchors grow downward**: for "top"/"top-left"/"top-right" positions, the window tells the renderer which edge it hangs from (`overlay/align`) and the pill + notification card flip to top-anchored. The 400px window no longer parks the pill 400px below a top anchor.
- **Resting pill capsule stops clipping**: the status hit window widened 56→80px (the hover capsule grows to 54 CSS px, which overflowed at 125% DPI — the "cut-off animation").
- **Notification card's white-glow shadow removed** (same reason as the pill's: reads as a harsh rectangle on the transparent window).

### Changed
- **The speaking meter is a real voice bar now**: while recording with no transcript yet (the hold-to-talk moment), a row of green bars spans the pill tracking live mic levels; once words arrive, the transcript takes over the space.

## [0.1.14] — 2026-10-30

### Added — Lens: AI-edit any selection (their signature feature)
- **Highlight text in any app → `Ctrl+Super+Alt+L` → type what you want** ("make it shorter",
  "translate to French", "fix the tone") — the active polish engine rewrites it and the result is
  pasted back over your selection. Rebindable in Settings → Shortcuts. Their binding is
  Ctrl+Win+Alt (modifier-only, which Electron can't register), so ours is that combo + L.
- **Free-float overlay positioning**: drag the pill's avatar to place it anywhere — the position
  persists and a new "Free float" anchor keeps it there. The docked resting pill drags the same way.
- **Speaking indicator**: a green waveform across the pill bottom tracks mic levels while you talk.

### Fixed — live UI findings
- **The pill no longer clips**: the overlay window is now tall enough for every state (mini 48 /
  card 80 / l4 322), bottom-anchored so it grows upward; the drop shadow (which read as a hard
  clipped rectangle on the transparent window) is gone.
- **Hotkey registration can never crash the app**: `globalShortcut.register` throws on
  modifier-only accelerators (it killed boot once); registration is now guarded and reports
  failures as "taken/invalid" instead of raising.
- **Settings hub regrouped** into Essentials / Your stuff / System so the wall of 13 options reads
  as the five things you touch, then your collections, then system tools.

## [0.1.13] — 2026-10-29

### Added
- **Their exact paste-failure notification card** — when injection falls back to the clipboard, the
  pill is replaced by their 400×200 shade-black card (radius 11, vast-900 border, dual white glow,
  10px slide-in) with the Ctrl+V rescue message in keycaps. The overlay grows to fit it and holds
  the card 6 s before collapsing.

## [0.1.12] — 2026-10-29

### Fixed
- **Their exact typing-dots indicator** (1.4s ease-in-out, .2s stagger, −4px bounce) replaces the
  "typing…" text; the rec dot is plain as in the reference (our pulse animation was invented).

## [0.1.11] — 2026-10-29

### Fixed — exactness pass on the pill (every deviation from their compiled CSS)
- **The pill morph now uses their root spring curve** (`linear(0, 0.005, 0.019 1.8%, … 1)`) at 0.42s — the capsule curve we had was a different widget's, at 0.2s.
- **Zone geometry** is their 428×54 bottom-center strip with the `rgba(0,0,0,.004)` hit area (was invented).
- **Mini-row gating** matches theirs: base hidden with `opacity:0; pointer-events:none`, shown only under `[data-state=mini]` with the `.18s/.1s` fade, plus the `[data-peek=true]` rule.
- **card-content** `gap:0`, stays in flow (opacity-toggled, no `display:none` — keeps their fade).
- **Shimmer** is theirs: 220% travel, 4s ease-in-out, italic, −0.01em.
- **Focus ring** (`2px #10b981`, offset 3px) and the **l4 transcript body** (28px top padding, 4px #30302f scrollbar, 12.5px/18 weight, heading/list/marker rules) ported verbatim.
- Font stack: **Figtree first**, with `font-feature-settings: "salt" on`.

## [0.1.10] — 2026-10-29

### Fixed — live-test findings
- **Empty dictations no longer pollute history** — `recordHistory` drops turns where nothing was said.
- **The overlay can never get stuck again**: the collapse-to-rest-dash and window release now run in a `finally` for every outcome, the pending hide is cancelled if a new dictation starts inside its 900 ms window, and the overlay window is destroyed (not hidden-resident) between turns.
- **Double-trigger bug fixed**: toggling hold-to-talk at runtime used to leave BOTH the global shortcut and the keyboard hook armed on the same combo (paired "dictation: started" lines ~200 ms apart — the source of the background CPU spikes). `applyHotkeyConfig` now owns both bindings exclusively.
- **Injection retries once**: a paste can lose a focus race right after the pill dismisses; a 300 ms-spaced second attempt recovers the common transient failure before falling back to the clipboard.
- **Add buttons work**: Dictionary / Commands / Scratchpad Add buttons are no longer greyed-out-until-typed — always clickable, validate on click with visible feedback, and the dictionary now parses its promised `word → replacement` syntax into term + pronunciation.
- **The resting bar's hover is their actual capsule** (30→54px vast-950 circle + chevron on the 0.2s capsule spring) — the invented 416px "Dictate + hotkey" pill (and its clipped text) is gone.
- **No more debug text on done**: the pill collapses to the rest dash instead of flashing "✓ Text inserted".

### Added
- **Cloud polish models in the Models tab** — the same provider → model → key → Test picker as cloud STT, with an honest per-provider note. Picking a provider activates the remote polish engine.
- **Custom overlay color + system theme sync** (Overlay tab): a color picker/text field for the pill (`--pill-*` variables, reference look by default) and a toggle that follows the OS light/dark mode.

### Performance (measured, before → after)
- **Installer 407.41 MB → 261.94 MB (−35.7%)**: dropped the 370 MB cuda-ext *fallback* binary (CUDA primary + Vulkan + CPU all still ship), win-arm64 prebuilds, .lib/.exp link artifacts, 34 MB of llama.cpp source, and 48 MB of unused Chromium locales (en-US only). Two-phase release flow re-proven end-to-end with the blockmap still generating.
- **Idle footprint**: the resident PowerShell UIA probe (~60 MB) and the loaded local GGUF context now unload after 5 min idle; the overlay BrowserWindow is no longer resident between dictations. Warm idle is ~285 MB / 0.25–0.34% CPU — the Electron process-model floor.

## [0.1.9] — 2026-10-28

### Changed — the dictation overlay is now the reference pill, rebuilt from their CSS
- **The dictation surface is a pixel-faithful port of their compiled status-pill CSS**
  (extracted verbatim from their shipped bundle):
  - **mini** (listening): `416×48`, `border-radius:16px`, `background:#1f1f1f`, `1.5px border #30302f`,
    `box-shadow:0 8px 32px rgba(0,0,0,.38)`. Row: `8px gap`, `12px` padding — green `6×6 #10b981`
    record dot → frosted 24px avatar → live text (`15px/20px weight 500 #fcfcfb` with their 20px
    right-edge fade mask) → meta (`12px/18px #71716e` duration).
  - **card** (transcribing/polishing): `416×80`, column layout, status line.
  - **l4**: `416×322` for long transcripts.
  - Every size morph runs on **their exact spring easing** (`linear()` 21-stop curve) at `0.42s`;
    the generating state uses **their shimmer sweep** (`#6f6f76→#fff`, 150% travel).
- Window geometry hugs the bar (`440×120`); the overlay capture harness verifies all states.

## [0.1.8] — 2026-10-28

### Changed — cloud polish gets the cloud-STT treatment
- **Cloud polish now has the same setup experience as cloud STT:** pick a **provider**
  (Groq / OpenRouter / OpenAI / Mistral / Ollama / custom) → pick one of that provider's
  **models from a dropdown** → base URL (blank = default) → API key → **Test connection**
  with a one-token probe. Former free-text-only setup is unchanged for existing configs
  (`provider` defaults to `custom` so saved baseUrl/model pairs keep working). Groq and
  OpenRouter free endpoints are still the inline recommendation.
- Polish probe surfaces real endpoint errors (HTTP status + body) and respects the local-only
  privacy lock.
- History records `triggerSource` (their `transcriptCommand`: ptt / popo), and cleanup **none**
  now forces "No AI formatting" exactly like their effective-format rule.

## [0.1.7] — 2026-10-28

### Added — their per-action shortcut map
- **Paste last dictation** (`Shift+Alt+Z`) and **Copy last dictation** (`Shift+Alt+X`) — their
  `paste_last_text` / `copy_last_text` actions with their Windows defaults. Paste re-types the most
  recent dictation wherever the cursor is; copy puts it on the clipboard. Both are rebindable in
  Settings → Shortcuts through the same capture flow as the main hotkey, and the bindings are
  re-registered on every settings save (idempotent `bindActions`).

## [0.1.6] — 2026-10-28

### Added — language model + surface recovery
- **Their language model**: `stt.languages` (the set of languages you speak, their
  `selectedLanguages`), `stt.autoDetect` ("Automatic language detection"), and
  `resolveSttLanguage` implementing their exact rule — **one selected language with auto-detect
  off is sent as the explicit ASR parameter (no guessing)**; several selected act as detection
  hints; the runtime `effectiveLanguages` override wins. Settings shows their widget copy with a
  16-language chip picker; onboarding picks one language explicitly.
- **Unresponsive-surface recovery** — their StatusSurface ladder: on `unresponsive`, escalate
  `invalidate` (+150 ms content-bounds pulse) → hide+show → full window rebuild, with backoff
  `min(10 min·2^(n−1), 60 min)`, deferred (3 s poll) while a dictation is mid-flight. Attached to
  the overlay and the settings window — directly hardening the "app is invisible" class.

## [0.1.5] — 2026-10-28

### Added — the post-paste learning loop
- **The app now learns from your edits.** The reference app's biggest documented gap, ported:
  after each paste, the target text box is watched (their 60 s window), the edited text is
  aligned against what you dictated, and corrected words are added to your dictionary
  automatically — their `shouldAutoLearnWords`, default true (`dictionaryAutoLearn` in Settings
  → Advanced). Substitution pairs keep their `observedSource` so every auto-added entry says
  what the STT originally heard.
- **Focused-element reads via UI Automation** (`system/uia.ts`) — their `GetTextBoxInfo`
  contract (contents / isEditable) plus the browser document URL, which feeds app
  classification with the *real* URL. Verified live against a Chrome document and Notepad.
  The probe is a resident PowerShell child because `Add-Type UIAutomationClient` costs
  seconds cold.
- `editDistanceToDictated` (their column): normalized Levenshtein between the dictated text
  and the anchored region; dictionary-phrase frequency counting from the edited text; the
  email-signature eligibility check that skips a box which already has a signature.

### Changed — settings fidelity from the reference app
- Transcription format is now their 4-value enum ("Apply AI formatting" / "No AI formatting" /
  "Casual messaging" / "All lowercase"), and cleanup is their 5-level `none/light/medium/high/full`
  with graduated prompt rules. Legacy `off`/`strong` values migrate transparently.
- Dictation capture now matches their exact constraints: 16 kHz mono with AEC/NS/AGC all off.
- The dictation cap defaults to their 20 minutes, warning at 19.

## [0.1.4] — 2026-10-28

### Added — app-type classification (the reference app's taxonomy)
- The foreground app is classified at dictation start using their `AppType` enum and verbatim
  `WINDOWS_*_PROCESS_NAME` lists. Email apps get your signature, chat apps drop the terminal
  period, AI apps skip auto-cleanup, and meeting-platform detection covers native clients and
  browser titles. The 8-part reverse-engineering corpus is published under
  `docs/research/wisprflow-re/`.

## [0.1.3] — 2026-10-27

### Fixed — the shipped overlay had no styling at all
- **The dictation overlay rendered unstyled in every released build.** The overlay entry never
  imported `styles.css`, so the built `overlay.html` linked no stylesheet — every class was inert.
  Found by screenshotting the actual built page (new `scripts/overlay-shots.cjs` harness that
  captures every state); fixed by importing the stylesheet.

### Changed — overlay redesigned to the reference app's design language
- Extracted from the shipped Wispr Flow bundle: panel geometry **500×420** (min 300×200,
  expandable to 920×660), palette `vast-950 #1a1a1a` / `sand-50 #fcfcfb` with a white accent, and
  the **transcript as the hero element** (19 px, large waveform, status header, footer hint).
  Verified visually in all five states (listening, transcribing, done, error, recording+typing).
- Replicated their settings surface: AI-formatting master toggle + cleanup strength
  (`polish.enabled` / `polish.cleanup` off-light-strong driving the model prompt), a hard
  `audio.maxRecordingLengthMs` dictation cap, and the overlay now actually uses the mic chosen in
  Audio settings (previously silently ignored).
- Per-dictation **app attribution** (`system/foreground.ts`) and **daily config/history backups**
  with 7-day rotation, matching the reference app's data-safety pattern.
- Injection hardened: paste failures surface their stderr (e.g. UIPI "Access is denied"), and when
  a paste cannot be delivered the text stays on the clipboard with an actionable message instead
  of being restored away and lost. The uiohook-based Ctrl+V was tried, verified to deliver nothing,
  and dropped — documented in code.

## [0.1.2] — 2026-10-26

### Added — real hold-to-talk
- **Press and hold to dictate.** Electron's global shortcuts only fire on key-down, so true
  push-to-talk needed an OS-level keyboard hook (`uiohook-napi`, MIT, bundled). Hold the hotkey to
  record, release to finish and polish.
- **Typing detection.** Type a correction mid-dictation and the session holds open; the overlay
  says `⌨ typing — dictation held`. The hook watches the configured combination only — keystrokes
  are counted as booleans, never recorded, stored, or sent.
- **Honest fallback.** If the hook can't load, the setting reports why and the app keeps working in
  toggle mode. No silent breakage.
- **Real Import buttons.** Dictionary imports word lists (`.txt`/`.csv`, one term per line,
  `word → replacement` supported); Snippets import JSON arrays of `{phrase, action, payload}` —
  both report how many landed and survive malformed files.

### Fixed
- **Local transcription returned empty text.** The whisper.cpp sidecar ships both `whisper-cli.exe`
  and the legacy `main.exe`, and the binary picker grabbed `main.exe`, which ignores `-oj` (JSON
  output). Now ranked by preference; caught by the new end-to-end STT verification script, which
  drives the real production path (download sidecar → extract → download model → transcribe the
  jfk.wav sample) and passes.
- **Auto-update was broken in every packaged build**, twice over:
  1. electron-updater exports `autoUpdater` as an `Object.defineProperty` *getter*, invisible to
     Node's ESM named exports — `const { autoUpdater } = await import(...)` destructured `undefined`
     and the updater threw before the first check. Dev builds skip the updater entirely, so only a
     *packaged* run revealed it. Resolved through the CJS default export, with a descriptive error
     if the shape ever changes.
  2. electron-builder writes `resources/app-update.yml` only when it publishes; the releases are
     uploaded separately, so the packaged app had no provider config and the *download* step
     crashed. The release workflow now injects it (two-phase build), and the updater also calls
     `setFeedURL` at runtime as a belt-and-braces fallback.
- **Release pipeline.** The workflow was missing the `electron-vite build` step (empty asar), and
  electron-builder silently dropped the 400 MB installer upload — releases now build with
  `--publish never` and upload assets explicitly with `fail_on_unmatched_files`.
- v0.1.2's first build attempt failed in CI on a UTF-8 BOM + mangled `package.json`; repaired and
  the exact CI build command passes locally.

## [0.1.1] — 2026-10-26

### Added — release pipeline & auto-update
- **Auto-update actually works now.** Releases publish as non-draft GitHub Releases with
  `latest.yml` + `.blockmap`, so installed apps check at launch + every 6 hours and download
  **only the changed blocks** between versions (differential updates), then install on quit.
- **Update banner**: "vX is ready — restart to finish installing" with a one-click restart.
- **Update channel** setting (Stable / Beta) in Privacy — the updater follows it.
- **Release workflow** (`release.yml`): pushing a `v*` tag builds the Windows installer on CI and
  publishes the release + update feed automatically.

### Added — production maturity
- **Backup import** — restore config and merge history from an exported backup (existing entries
  are never duplicated).
- **Native pickers** — Browse… buttons for the overlay backdrop and the recordings folder.
- **Diagnostics** in Help — open the log folder or the whole data folder.
- **Search** on Dictionary and Snippets (parity gap closed).

### Fixed
- Docs pages were unreadable in dark mode (Tailwind prose grays on the near-black Nocturne page).
- Two licence bugs in the shipped catalog: `whisper-base.en` / `whisper-small` said Apache-2.0;
  Whisper is MIT.
- Cloud STT transcribed nothing (the session gated segments on a local model path, which cloud
  adapters never have).

## [Unreleased]

### Added
- **Mistral Voxtral in the cloud STT presets** — `voxtral-mini-transcribe-3-0` at $0.0035/min
  (~$0.21/hour), 50+ languages, diarization/context-biasing capable; free-mode quota is
  explicitly marked "check your console" because Mistral publishes none.
- **Explicit STT fallback chain** (`stt.fallback`: none | local | cloud). Off by default so audio
  never leaves the machine by surprise; when enabled, a failed segment is retried on the other
  engine and the fallback is logged.
- **Polish fallback** (`polish.fallbackToLocal`) — a failing remote endpoint retries on the local
  GGUF before dropping to offline cleanup.
- **Model lifecycle**: deleting a custom model also removes it from the catalog, plus a
  "Remove unused" disk-cleanup action that deletes downloaded models nothing points at.
- **Best-practices card** on the Models page (model sizing, one-per-role, local-only lock, warm-up
  latency, post-switch test, dictionary size).
- Per-provider verified metadata (`freeNote`, `verified` date, docs link) shown in the cloud STT
  card so limits read as dated facts rather than evergreen claims.

### Fixed
- **Cloud STT transcribed nothing**: the session skipped every segment whose `modelPathFor()` was
  null, which is exactly what cloud adapters return. Adapters now declare readiness explicitly.
- **Docs were unreadable in dark mode** — Tailwind Typography's light-mode grays are now bound to
  the site's own Nocturne/Dawn tokens (body, headings, links, code, tables, quotes).
- **Licence errors in the shipped catalog**: `whisper-base-en` and `whisper-small` said Apache-2.0;
  Whisper is **MIT** (Whisper large v3 turbo was already correct, so the file contradicted itself).
- Dead provider ids removed after the 2026-10-26 audit: Groq's `distil-whisper-large-v3-en` (does
  not exist), OpenAI's `whisper-1` deprecated in favour of `gpt-transcribe` (shutdown 2027-02-26).
- Unverifiable marketing numbers dropped: Qwen3.5 IFEval/language claims, Gemini's "1,500 req/day"
  (that figure is Search-grounding RPD), Cerebras listed as free (their FAQ says it has no
  permanent free tier), Mistral's "$10/month free credit" (no official source — now described as
  reported-and-unconfirmed, ~47 hours if it holds).
- **Cloud STT (BYOK)** — Groq (generous free tier, ~2,000 req/day), OpenAI, or any
  OpenAI-compatible `/audio/transcriptions` endpoint; onboarding offers it as an engine choice,
  Models tab has provider/model/key config with a "Test key" probe. Blocked by the local-only
  lock like every network provider.
- **Meeting mode** — keeps the session open across pauses and pastes each utterance the moment
  it's transcribed (meetings, lectures, interviews). Overlay → Overlay tab or Settings.
- **Recorder** — "Start recorder…" in the tray runs meeting mode and saves the WAV next to the
  transcript; `Save dictation audio` saves every turn. History entries get a ▶ Play button.
- **Dedicated Overlay tab** — shape (pill/rect/blob), position (cursor/top/bottom), custom
  backdrop, meeting mode, audio saving, with a live preview; overlay re-reads config the moment
  it changes (no relaunch).
- **Models tab rebuild** — PC hardware card (CPU/cores/RAM/GPU + tier), "Recommended for this
  PC" set ranked by tier, one-click "Download recommended set", decluttered list with "Show all",
  custom-model form (any HF GGML/GGUF), auto-set-active after the first download of each role.
- **Setup checklist live-ticks** — bound to download progress events; engine and model are now
  separate steps; switching to cloud STT satisfies both.
- Desktop app: full dictation loop — global toggle hotkey, floating overlay (waveform, streaming partials, Esc cancel), clipboard-safe paste injection with snapshot/restore
- Settings hub in the measured reference layout: collapsible 192px rail, cream top-bar pills, 12 sections (Dictation, Audio, Models, Overlay, Dictionary, Snippets, Style, History, Insights, Scratchpad, Shortcuts, Privacy, Help)
- Three design systems: Nocturne (dark), Dawn (light), Classic (reference-measured) — switchable live
- Engine (`@whisperflow/engine`, Electron-free): RMS VAD with adaptive noise floor, 48k→16k resampling, whisper.cpp sidecar STT, llama.cpp polish + BYO OpenAI-compatible endpoint + offline cleanup fallback, fuzzy personal dictionary, voice commands ("scratch that" built-in), HuggingFace model manager (resumable downloads, hardware tiering, custom catalog), local history store with optional audio paths
- Onboarding: skip-ahead card, mic test, full ASR configuration board (engine source, language, model w/ RAM suggestion, sensitivity, polish), guided downloads
- Insights: local stats (counts, words today/all-time, 7-day bars)
- Scratchpad: local quick notes
- Website: Nocturne marketing site — home, features, download, pricing, sponsors, docs, 404; deployed to GitHub Pages
- CI: typecheck + tests + website + desktop builds; Pages deploy workflow
- Docs: architecture, parity matrix, reference-app analysis (live CDP evidence), model research, free-tier census (polish + STT)

### Fixed
- Toggle switches: knob could escape the track and vanished on the Classic ink track —
  repositioned with explicit offsets and a theme-proof knob.
- Model downloads: aria2 fast-path reported progress correctly (pass totalBytes through);
  first download of each role now auto-activates instead of requiring a manual "Set active".

### Security
- Zero telemetry, local-only network lock enforced at the provider layer (now covers STT too)
