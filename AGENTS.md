# WhisperFlow — Engineering Notes

This file is the durable engineering memory for anyone (human or agent) working
in this repo. It records decisions, procedures and constraints that are easy to
get wrong the second time.

## Brand: the Printed Signal (v3, 2026-11)

- Identity: **the printed signal** — "a print shop that renders your voice".
  Tagline: `speak. it writes.`
- Paper `#F7F4EE` / ink `#1A1916` / ONE accent `#0E7A55` (print green, not
  phosphor — it lives inside the glyph scenes first, UI second).
- Type cast (roles are strict): **Instrument Serif** (display ONLY) ·
  Space Grotesk (UI/body) · JetBrains Mono (labels/eyebrows/captions — never
  display). Inter is retired from the site.
- The engine is `PaintedScene` (Engine D): halftone dots with CONTINUOUS
  radius from tone, bayer4 micro-dither, edge feathering, truecolor glyphs,
  image-driven duotone (`imgRGB`/`imgTone`, ink-coverage polarity). Scenes:
  SCENE_BLOOM (orchid hero), SCENE_CONTOURS, SCENE_PRESS_PROOF, SCENE_DUNE.
  GLSL note: **inverted smoothstep edges are undefined** — always write
  `1.0 - smoothstep(a, b, x)` for falling masks, never `smoothstep(b, a, x)`.
- Product artifacts are **specimens**: print border, exhibit, mono caption
  (`fig. NN — …`). Demos must be honest: real Web Speech when possible,
  simulations labeled as simulations, zero fabricated metrics.
- Dark mode is a second print (`paper:"ink"` → deep ink-blue sheet), not a
  re-skin. Default is light; `data-mode="dark"` opts in.
- Motion specs live in `MOTION.md`. Technique lineage lives in `INSPIRATION.md`.
  The v3 brief + research corpus summary: `SPEC.md`.
- `origin-check.yml` fails CI if retired borrowed values (`#1a1a1a`, `#30302f`,
  `#10b981`) or "reference app" comments reappear. Do not work around it; it is
  the anti-copy gate.

## packages/signal-engine

Zero-dependency TypeScript WebGL engine. `DITHER_FRAG` must inject
`COMMON_FRAG` (it defines `wave()`) — omitting it makes the shader fail and the
engine **silently** falls back to Canvas2D. If a canvas looks flat/empty, check
the shader include chain first.

## Releases / auto-update

- Desktop auto-update reads the GitHub release `latest.yml` (electron-updater,
  provider github). The app updates when a **new tag** ships, not on every push.
- `apps/desktop/package.json` `version` must equal the tag (`v0.1.41` ↔ `0.1.41`).
- Workflow: `.github/workflows/release.yml` (NSIS + MSI + latest.yml + blockmap).
- CHANGELOG follows keepachangelog.com with the house style: `### Added — feature`
  headings and dense bullets explaining the *why*.

## Website

- Astro, `base: "/whisperflow"`, GitHub Pages. Local QA: build then serve
  `dist/` from the **parent** directory through a `whisperflow/` symlink, or all
  routes 404.
- The hold-to-speak demo keycap sits below the fold on 900px viewports — the
  visibility guard correctly ignores it until scrolled into view (not a bug).

## Known environmental quirks

- `uiohook-napi` needs `libXtst.so.6` (X11). Headless Linux sandboxes lack it,
  so `holdToTalk` tests fail there environmentally — they pass in real CI
  (ubuntu runners install it via the workflow's apt step).
