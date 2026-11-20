# DESIGN.md — v0.1.44 "The Instrument, Tuned"

User verdict on v0.1.43: "GREEN VOMIT. No color psychology, no hierarchy."
Diagnosis (honest): the Signal Standard had ONE accent (#5CE1A9 phosphor)
used EVERYWHERE — active nav, focus rings, selection, LED glows, buttons,
marks, palette edges, overlay trace. ~30% of interactive pixels were green.
Raycast/Linear discipline: accent ≤ 10% of area, hierarchy from LUMINANCE
stepping, depth from insets/translucency, never hue saturation.

## The fix — luminance first, color scarce

### 1. Neutral ramp (dark "Lab"), 2-4% luminance steps
```
bg      #07080A   (canvas, 60% of area)
paper   #0C0D0F   (cards L2)
paper-2 #111214   (raised L2.5, inputs)
paper-3 #1B1C1E   (hover, pressed)
line    rgba(255,255,255,0.07)  (hairline)
line-2  rgba(255,255,255,0.12)  (stronger edge)
ink     #F2F1EE   (primary text)
ink-2   #9C9C9D   (secondary)
ink-3   #6A6B6C   (metadata)
```
### 2. Accent DISCIPLINE (60-30-10)
- 60%: bg/paper neutrals. 30%: text + lines. 10%: color, split:
  - phosphor #5CE1A9 — ONLY: live/recording states, the one active LED,
    primary CTA border, focus ring. Never on: nav active bg, selection,
    hover text, decorative marks.
  - amber #E8B84B — busy/processing, warnings, downloads.
  - coral #E86A5E — errors, destructive.
  - violet #8F7BE8 — AI/polish features (semantic: the LLM lane).
- Nav active = NEUTRAL (paper-3 bg + ink text + 2px phosphor left rail
  mark, 2px wide — the only green in the nav).
### 3. Depth = insets, not shadows
- card: inset 0 1px 0 rgba(255,255,255,0.05)
- raised: + radial-gradient top glow
- modal/palette: backdrop-filter blur(12px) + gradient fill + 1px light border
- NO outer drop shadows below 24px elevation
### 4. Dither + SVG texture layer (the "print" identity)
- .dither-tex: 4px SVG pattern (bayer-like), opacity 0.35, on hero panels
  and rail background only — texture, not noise
- .corner-brackets: 4 SVG L-marks on cards (12px, line color, phosphor on
  hover/focus) — instrument frame language
- .noise::after: 1-bit grain (SVG turbulence, 3% opacity) on bg only
### 5. Microanimations (MOTION.md grammar preserved)
- rail item hover: 120ms bg fade + LED dot slides in
- card hover: border-color line→line-2 (150ms), corner brackets brighten
- toggle: 200ms thumb travel + phosphor ONLY when on
- palette rows: 90ms stagger (already in), selection = neutral-3 + 2px
  violet left mark (it's a command surface, not a live signal)
- reduced-motion: all durations → 0ms (already handled)
```

## Files to touch
1. styles.css — full token block replace + component polish (this doc §1-5)
2. shared/ui.tsx — CornerBrackets + DitherTex components (SVG)
3. App.tsx rail — neutral active state + left mark
4. Overlay.tsx — trace keeps phosphor (it IS the live signal), capsule
   gets 1px gradient border + blur depth, state chip colors semantic
5. StatusBar — LED semantic colors only

## Verify (QA gates)
- Screenshot Lab + Daylight: green pixels < 12% of interactive area
- Contrast: ink on paper ≥ 12:1, ink-2 on paper ≥ 4.5:1 (WCAG AA)
- No color-only meaning (LEDs have labels/icons)
