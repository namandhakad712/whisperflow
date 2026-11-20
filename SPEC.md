# SPEC v3 — "Printed Signal" — the rebuild brief

> Derived from: 11 reference works (praveenisomer dither+orchid, stackedlol shark
> school, gruffwashere Glyphoras, Skirook ×4, poi studio ×4), asciicn.dev engine
> analysis, Wispr Flow + competitor research, hex/linear/raycast/resend study,
> and a 3-persona expert panel (art director 4/10, SDE 6/10, target user 5/10).
> This is the exact standard. No approximations.

## THE ONE-LINE BRIEF

**A paper-light editorial site where the product's signal is printed in
halftone-dot glyph scenes — color inside the glyphs, one serif voice over it,
ambient motion that never stops breathing. "The New Yorker meets an oscilloscope."**

## 0. The verdict on what exists

The panel's findings, all three agreeing:
- The product never appears — everything is a *metaphor* of the product
  (instrument panels, transmission logs). The demo is canned strings with
  fabricated latency (`240 + Math.random()*180` — Dev checked).
- One type costume where there should be a cast: mono plays display + UI +
  labels + body → hierarchy flattened into texture.
- Four accents (green, violet, amber, coral) on near-black; the dither reads
  as a broken alpha channel at cell 3.
- Wispr Flow — the category leader — won with the EXACT opposite: warm cream
  editorial, serif×sans pairing, live "Cleaning up…" transform demos.
- The references are all **light/paper or dark-void painterly scenes** — never
  mid-gray terminal chrome.

## 1. ART DIRECTION — non-negotiables

### Palette — "press room"
- **Paper**: `#F7F4EE` (warm cream, the base of 5/7 references: praveen,
  shark, poi ×4, asciicn backgrounds)
- **Ink**: `#1A1916` (warm near-black, never pure #000)
- **ONE accent**: deep signal green `#0E7A55` (print-ink green, not phosphor).
  It lives INSIDE the glyph scenes first, UI second.
- Scene inks (used only inside painted scenes, never in UI): cobalt `#2D4B8E`,
  vermilion `#C2452D`, ochre `#C98A3D` — the poi studio printmaking triad,
  one per scene, chosen per composition.
- **Retired**: phosphor `#5CE1A9`, violet, amber, coral as UI colors; the
  near-black `#0A0B0D` page; the checkerboard dither.
- Dark mode: not a re-skin — a second print (deep ink-blue paper `#14171D`,
  cream ink). The scene owns its paper (asciicn pattern): hero art identical
  in both modes.

### Typography — "a cast, not a costume"
- **Display serif**: Instrument Serif (Google Fonts, free, editorial Didone-ish
  — the praveen/resend register). 64–96px, tight leading (1.02), tracking -1%.
  ALL headlines. Lowercase allowed but not mandatory.
- **UI grotesk**: Space Grotesk (already ours) 14–16px, 500 weight, for nav,
  buttons, body. It reads "premium neutral" next to the serif.
- **Mono labels**: JetBrains Mono 10–11px, uppercase, +8% tracking — demoted
  to eyebrows/labels/status ONLY. Never display, never body.
- Gradient-clip on ONE display word per page max (hex.tech move), ink→accent.

### Layout — editorial grid
- 12-col, max-w 1280, generous 96–128px section rhythm.
- Hero: full-bleed painted scene (below), headline set OVER the art (praveen
  pattern: headline at 30%→100% opacity as the scene blooms).
- Asymmetric compositions: headline left-anchored, art right; features as an
  index/contents page, not card grid; serpentine flow between sections.

## 2. THE ENGINE — port asciicn's printmaking into signal-engine

Verdict from the engine study: port techniques (MIT), keep our zero-dep TS.

### New renderer: `PaintedScene` (WebGL2, in `packages/signal-engine`)
Contract (mirrors asciicn's field, namespaced to avoid collision):
```glsl
// one shared scene function returns color; tone derives from it
vec4 scene(vec2 uv)        // rgb = ink color, a = tone 0..1
```
- **Charset**: halftone DOTS ` ·∙•⦁●` (5 radii, sub-cell circles) as default;
  `standard` ramp as scene-specific option. Dots = printmaking, references'
  dominant register.
- **Truecolor glyphs**: each glyph tinted by `scene()` color (the #1 thing our
  engine lacks — color INSIDE glyphs).
- **bayer4 dithering** on the tone→glyph mapping.
- **Cell**: 7px, square, ~200 columns at 1440 (asciicn's documented paint look).
- **Motion**: Ken Burns re-raster — the scene's camera drifts 0.01–0.08
  units/s so every frame re-dithers (the praveen "living grain" signature);
  per-scene ambient life (petals sway, creatures pass) via `fbm` noise phases.
- **Pixel-snapped cells**, DPR-capped, `IntersectionObserver`-gated,
  reduced-motion → static frame (all already ours).
- Pointer: soft local tone lift (existing `u_mouse` well, tuned subtle).

### The scenes (authored GLSL, one per page)
1. **Hero — "the orchid bloom"**: duotone-printed orchid macro on cream,
   bottom-up bloom reveal on load, Ken Burns drift. Cobalt+cream ink.
   (Direct homage to praveen's reference; different flower, our palette.)
2. **Features — "the signal field"**: quiet topographic contour lines in
   dots (asciicn's Contours), one accent-green peak.
3. **Download — "press proof"**: halftone still-life of the app window
   (abstracted UI shapes in dots), print-registration marks.
4. **404 — "lost transmission"**: static-noise dots resolving to nothing,
   one green pulse.
5. Section dividers: thin glyph rules (running dots) — never 1px lines.

## 3. THE PRODUCT APPEARS — honesty requirements

- **Real overlay capture** in the hero column: an actual screen recording of
  the v0.1.41 overlay dictating into Notepad, ~6s loop, framed as a
  "specimen" (print border + mono caption: `fig. 01 — live dictation, 0.1.41`).
  If no capture exists yet, build a Playwright-driven capture of the real app
  UI mock — but label mockups as mockups. **Zero fabricated metrics**: the
  demo shows simulated text but says "simulated transcript" and shows no
  fake milliseconds.
- **Demo that listens** (Sara's ask): the hold-to-speak demo requests the mic
  (optional) and runs the REAL Web Speech API → shows HER words. Fallback
  (denied/no support): the scripted simulation, honestly labeled
  "simulated — the desktop app is the real thing".
- Typing-race strip (Wispr's proven mechanic, ours local): "voice 152 wpm ·
  typing 41 wpm · measured on this machine, once, by us" — or omit numbers
  we didn't measure. Keep honest.

## 4. COPY — comprehension first (Sara's 2-second rule)

- Hero: serif headline **"speak. it writes."** (comprehension in 2s) with the
  poetry as subhead: "your voice, rendered — on your machine, in any app."
- The value ladder above the fold: `local-first · free forever · works in
  every app · your words never leave this machine`.
- Pricing page: "free forever · no card · no account" FIRST. The calibrator
  demoted to a quiet "help us decide what to build" section.
- Platform honesty matrix: Windows ✓ · macOS/Linux "on the roadmap" with a
  link, visible near the CTA (not buried in FAQ).

## 5. PERCEPTION CHECKLIST (the bar to clear)

- [ ] Screenshot test: any frame of the hero is poster-grade
- [ ] Serif headline lands in first viewport; explanation ≥ hierarchy of poetry
- [ ] Color visible inside glyphs (not monochrome buzz)
- [ ] Real product visible in motion within one scroll
- [ ] Exactly ONE accent in UI; zero fabricated metrics
- [ ] Clean at 375px (no clipped glyphs, no scroll-bar artifacts)
- [ ] Panel re-review ≥ 8/10 average
- [ ] 60fps idle on a mid laptop (DPR-capped, IO-gated)
