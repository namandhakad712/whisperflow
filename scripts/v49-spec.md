# v0.1.49 — "THE FRONT PAGE" design spec

Mined bestdesignsonx.com (rendered wall → VLM pattern extraction, Nov
2026). 15 patterns; the ones we ADOPT (grammar only, our print language):

1. Hero with ONE glowing focal element → the HeroPlate: a halftone "press
   plate" disc (CSS radial-gradient rings + bayer dots) behind the home
   H1. Radial ink, not glow — same trick, print dialect.
2. Serif display + italic accent word → "speak. it *writes*." —
   Instrument Serif + italic on the accent word (serif-cast themes).
3. Tiny wide-tracked micro-labels vs oversized display → keep our mono
   eyebrows, but the home H1 goes 56px+.
4. Pill CTAs everywhere → PrintButton already; home gets a JUMBO pill
   ("Start dictating") with the hotkey chip inside it.
5. Keyboard-hint chips (⌘K) → we have; extend to home hero + empty states.
6. Chrome-framed live previews (browser window motif) → the OVERLAY STAGE:
   a framed desktop mock in OverlayTab where the real capsule runs through
   rest→mini→card→l4 states on REAL theme tokens. Same for ThemePicker
   (mini press sheets previewing real colors/type).
7. Fanned/stacked cards → History "recent" cards on home fan out on hover.
8. Pastel gradient fog → AuroraField exists; add "FogMode" wash variant
   for light themes (softer, 2 washes).
9. Presence dots / live counters → live rail exists; home hero shows
   today's chars counting up + a live clock-in-print (mono timestamp).
10. Fluid responsive → the console gets true breakpoints: rail collapses
    to icon rail at <900px, live rail to a horizontal strip under the
    topbar at <1100px, content padding scales with clamp().

## The new HOME screen ("front page" — new default route)
```
┌ topbar (unchanged) ──────────────────────────────────────────┐
│ rail: NEW "home" channel 00 at top (house icon)             │
├──────────────────────────────────────────────────────────────┤
│  ● HeroPlate (halftone disc, accent ink, 6% alpha)           │
│  eyebrow: /// the front page                                 │
│  H1 56px: speak. it writes.   (italic on "writes")           │
│  sub: {greeting} — the press is {state}. Nothing leaves      │
│       this machine.                                          │
│  [ ▶ Start dictating · Ctrl+Shift+Space ]  ← jumbo pill      │
│  micro: local · v{ver} · {model} · {chars today} chars today │
├──────────────────────────────────────────────────────────────┤
│ bento: [recent dictations ×3 fan] [quick setup status]       │
│        [today's print run — mini insights] [the six prints]  │
└──────────────────────────────────────────────────────────────┘
```
- Default route becomes home; nav.ts gains channel 00.
- "Start dictating" fires the real hotkey path (app.tryStartDictation
  if exposed; else instructions chip).
- Greeting by hour: "good morning/afternoon/evening" — small, warm.

## Print loaders (replace Spinner everywhere)
- PressLoader: a 5-dot halftone wave (dots pulse in sequence, ink→accent)
- PlateSweep: a 1px rule that sweeps L→R with a comet of bayer dots
  (for model downloads — replaces the plain progress bar's spinner)
- Both CSS-only, 12px tall, honor reduced-motion (static dots).

## Overlay STAGE (OverlayTab)
- A framed "desktop" (wallpaper = blurred theme paper, window chrome
  dots) hosting the ACTUAL capsule component, cycling states.
- State buttons: rest / mini / card / l4 + mood slider feeding InkBloom.
- This is the "live preview window" — users finally SEE the overlay
  before dictating, on every theme.

## ThemePicker live sheets
- Each theme card previews: real bg/ink/accent swatch strip + the theme's
  own type cast rendering "Aa speak." + halftone density dot.
- Click = apply (existing) + the sheet flips (3D tilt) to confirm.

## Customization (GeneralTab → "your press" section)
- density: compact / regular / roomy (row padding scale, 3-step pill)
- motion: full / reduced (writes a local override honored by presskit)
- grain: off / subtle / full (body::before opacity)
- Persisted in localStorage (wf-press prefs), applied via data-attrs on
  <html>; CSS variables do the work. No config schema change (renderer-
  local preference, like theme).

## Fluid responsive
- <1100px: live rail → 4-cell horizontal strip (meter/engine/model/today)
- <900px: rail → 64px icon rail (labels as tooltips), content px-5
- Clamp() on home H1: clamp(40px, 6vw, 64px)
- All bento cells minmax() — collapse 2-col → 1-col at <900px.

## NOT doing (restraint = premium)
- No glassmorphism-over-photo (we're print, not glass)
- No brutalist collage clash (we keep one accent)
- No 3D card carousels (we keep ink-flat + spotlight)
