# MOTION.md — Signal Standard motion grammar

Every animated value in WhisperFlow, documented. If a timing isn't here, it
shouldn't be in the product. Authored 2026-11 for the Signal redesign.

## Envelopes (easings)

| Name | Curve | Where |
| --- | --- | --- |
| `out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | entrances, reveals, hover lift |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | toggle knob, playful confirmations |
| `scope` | `cubic-bezier(0.7, 0, 0.2, 1)` | overlay/statusbar morphs — quick attack, slow settle, like a VU needle |

## Durations

- 120–150 ms — hover states, color-only transitions
- 240 ms — element-level entrances, small panels
- 380 ms — capsule morphs (overlay, statusbar) on `scope`
- 500 ms — page-section reveals on scroll
- Never above 700 ms for anything the user is waiting on.

## Signature motions

- **Standby breath** — 3.2 s ease-in-out infinite, box-shadow glow 0.35 →
  1. The overlay rest dot and the statusbar dot share this exactly: one
  language everywhere. Pauses under `prefers-reduced-motion`.
- **Capsule morph** — 380 ms `scope`; geometry authored: rest 22×22 dot →
  mini 384×56 → card 384×88 → l4 384×336, radius 14.
- **Phosphor trace** — canvas polyline, 56 levels, rAF, afterglow via
  `destination-out` fade at 12 %/frame, edge envelope `sin^0.5`.
- **Polish sweep** — characters cycle the glyph ramp ` .·:;=+x%#@` then
  settle left→right; violet (`--violet`) while the LLM works, phosphor on
  land. 42 ms/frame, ~26 frames for a sentence.
- **LED states** — live (phosphor, breathe), busy (amber / violet pulse
  1.2 s), error (coral), off (faint).
- **Scramble decode** — nav links cycle the glyph ramp on hover; settles in
  ≤ `len + 9` frames at 42 ms. Instant under reduced motion.

## Press-kit envelopes (console surfaces, v0.1.52–53)

The console's press-kit components follow the same grammar with three
authored envelopes:

- **Press-in entrance (DayStrip)** — dots scale from 0.4 px to their
  radius on `out-expo` over 500 ms, once per mount and once per range
  change. Under reduced motion the dots render at full size instantly.
- **DotRadar wake** — the grid's base dot is 0.8 px; within 130 px of the
  cursor dots grow toward 2.6 px, eased by the smoothed cursor
  (lerp 0.14/frame). No entrance; the wake IS the motion.
- **Spotlight settle (SpotlightCard)** — 240 ms `out-expo` lift on hover;
  the card lifts ≤ 4 px, the shadow gains one step. Color-only at
  reduced motion.

Range changes (day → week → month) do NOT re-run the entrance cascade;
they redraw in place — the strip is data, not theater.

## Rules

1. Nothing loops faster than a resting breath (3.2 s) except the trace,
   which is live data, not decoration.
2. Every animation has a `prefers-reduced-motion: reduce` path: static
   frame, no loop, instant settle.
3. The engines (DitherField, AsciiRender, HalftoneReveal) render one static
   frame under reduced motion and never animate.
4. DPR capped at 1.5 (site) / 2 (trace) so integrated GPUs stay smooth.
5. RAF pauses when the tab is hidden; IntersectionObserver gates every
   engine canvas to visibility.
