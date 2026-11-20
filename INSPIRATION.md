# INSPIRATION.md — technique lineage ledger

The Signal Standard is original work. Nothing below was copied — no code,
no palettes, no geometry, no motion values were taken from any product.
This ledger records *where we learned public techniques* and *what we
deliberately avoided*, so the distinction is auditable.

## What we built from (public, decades-old techniques)

| Technique | Public reference we learned from | Where we use it |
| --- | --- | --- |
| Ordered Bayer dithering | Bayer matrices (1973); "The Art of Dithering and Retro Shading for the Web" — blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web (2024) | DitherField engine |
| Luma→glyph ASCII mapping | three.js AsciiEffect docs (jsascii lineage); Efecto writeup (2026) | AsciiRender engine |
| Halftone dot screens | Classic print repro; same Heckel article | HalftoneReveal engine |
| Scroll-driven reveals | CSS `animation-timeline: view()` (native, 2024+) | site reveals |
| Smooth scroll inertia | Lenis (MIT) — used as a library, unmodified | marketing site only |
| WebGL fullscreen-quad harness | Standard practice | `packages/signal-engine/src/gl.ts` (written from scratch) |

Component galleries we browsed for **technique awareness only** — nothing
installed, nothing copied: reactbits.dev, 21st.dev/community ASCII tag,
Framer marketplace ASCII components. The ASCII/dither *trend* context came
from awwwards.com and onepagelove.com browsings in Nov 2026.

## What we deliberately did NOT take

- **Hex** (anomalyco/hex): no keycap hero, no screen-shatter, no Voronoi
  shards, no capsule morph curves, no palette values. Their site was
  studied as a benchmark of commitment level, nothing more.
- **Wispr Flow / the old "Classic" skin**: the pre-redesign overlay,
  statusbar, lens and Classic theme carried values measured 1:1 from
  another app's compiled CSS ("their green #10b981", "their typing
  indicator", etc.). The Signal redesign **removed every one of those
  values**. The `classic` skin no longer exists; stored `wf-skin=classic`
  migrates to `lab`.
- No third-party component library ships in either app's UI.

## The origin check

`.github/workflows/origin-check.yml` greps the tree for the retired
borrowed values and fails the build if any reappear. If you must add one
of these strings for a legitimate reason, update the workflow AND this
ledger in the same PR.

## Fonts

- Space Grotesk (SIL OFL) — display
- JetBrains Mono (SIL OFL) — data/mono
- Inter (SIL OFL) — body
All self-hosted via Fontsource. No font metrics or hinting were altered.
