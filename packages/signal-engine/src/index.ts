/**
 * @whisperflow/signal-engine — the Signal Standard visual engines.
 *
 * Original work for WhisperFlow. Techniques are public knowledge (ordered
 * dithering, luma→glyph mapping, halftone); composition and code are ours.
 * See INSPIRATION.md at the repo root for lineage.
 */
export { DitherField, DITHER_PALETTES, type DitherPalette, type DitherFieldOptions } from "./dither";
export { AsciiRender, GLYPH_RAMP, type AsciiRenderOptions } from "./ascii";
export { HalftoneReveal, type HalftoneOptions } from "./halftone";
export { scramble, bindScrambles, holdDemo, type ScrambleOptions, type HoldDemoOptions } from "./interactions";
export { reducedMotion } from "./gl";
