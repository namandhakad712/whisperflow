/**
 * The painted scenes — authored GLSL for PaintedScene.
 * Each scene defines `vec4 scene(vec2 uv)`: rgb = ink color, a = tone 0..1.
 * Techniques (dither, halftone, tone mapping) are public knowledge; the
 * compositions are ours. See SPEC.md and INSPIRATION.md for lineage.
 */

/**
 * HERO — "the bloom".
 * A real orchid macro printed as a duotone halftone: the photo's luminance
 * maps to dot tone (quiet highlights, full mid-tone form), the ink is cobalt
 * with the accent green reserved for the flower's lip (detected by its
 * magenta hue). Ken Burns drift comes from the renderer camera.
 */
export const SCENE_BLOOM = /* glsl */ `
vec4 scene(vec2 uv) {
  // the image drifts WITH the orbit (bounded; the press never runs away)
  vec2 suv = uv + vec2(sin(u_time * 0.18) * 0.004, cos(u_time * 0.13) * 0.003);

  // print polarity: white bg clean, petals a dense tonal mass
  // (imgTone window 0.42-0.88, gamma 0.65 — the midrange lift)
  float t = imgTone(suv);

  // the whisper plate: tone clamps to ~0.13 over the copy block so type
  // sits on a whisper of dots (the references' fade boundary), while the
  // flower prints at full voice everywhere else. On narrow sheets the copy
  // spans nearly the full width — widen the plate (uv-space) accordingly.
  float narrow = 1.0 - smoothstep(500.0, 900.0, u_res.x);
  float px0 = mix(0.62, 0.97, narrow);
  float px1 = mix(0.72, 1.05, narrow);
  float bandX = 1.0 - smoothstep(px0, px1, uv.x);
  float bandY = 1.0 - smoothstep(0.42, 0.52, uv.y);
  float quiet = bandX * bandY;
  float tone = min(t, mix(0.13, 1.0, 1.0 - quiet));

  // darks merge solid OUTSIDE the quiet zone — deep petals = solid ink,
  // never under the copy
  tone = max(tone, smoothstep(0.82, 0.92, t) * (1.0 - quiet));

  // load wipe: the print develops from the top-left corner, ~0.9s expo-out.
  // Inside the reveal radius the dots are ON (1 - smoothstep on distance).
  float reveal = 1.0 - pow(1.0 - clamp(u_time / 0.9, 0.0, 1.0), 4.0);
  float dw = distance(uv, vec2(0.0, 1.0));
  tone *= 1.0 - smoothstep(reveal * 1.5, reveal * 1.5 + 0.12, dw);

  // hue: the orchid lip/throat (magenta-ish) carries the accent ink
  vec3 c = imgRGB(suv);
  float lipness = clamp((c.r - c.g) * 3.0, 0.0, 1.0) * step(0.10, t);

  if (u_dark > 0.5) {
    // the dark run: luminous lavender → silver where dense, mint lip,
    // and a sparse dust floor so the sheet is never a void
    vec3 body  = vec3(0.635, 0.698, 0.898);
    vec3 dense = vec3(0.843, 0.878, 0.973);
    vec3 acc   = vec3(0.208, 0.702, 0.494);
    vec3 ink = mix(body, dense, smoothstep(0.45, 0.95, t));
    ink = mix(ink, acc, lipness * 0.9);
    float dust = 0.06 * smoothstep(0.35, 0.05, t);
    return vec4(ink, max(tone, dust));
  }

  // the light run: tritone ramp — saturated cobalt at mid density,
  // desaturating toward ink-black as coverage approaches solid
  vec3 cobalt = vec3(0.176, 0.294, 0.557);
  vec3 deep   = vec3(0.118, 0.145, 0.290);
  vec3 accent = vec3(0.055, 0.478, 0.333);
  vec3 ink = mix(cobalt, deep, smoothstep(0.55, 0.97, t));
  ink = mix(ink, accent, lipness * 0.9);
  return vec4(ink, tone);
}
`;

/**
 * SECTION — "the contours".
 * Quiet topographic contour lines in dots with one accent peak — the map
 * behind feature indexes. Slow, readable, calm.
 */
export const SCENE_CONTOURS = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.04;

  // terrain: fbm heightfield
  float h = fbm(p * 2.6 + vec2(t, -t * 0.6));

  // contour lines: quantize height, edge detect the bands
  float bands = 9.0;
  float q = floor(h * bands) / bands;
  float line = smoothstep(0.028, 0.0, abs(h - q - 0.5 / bands) - 0.012);
  // thin ridge detail
  float ridge = smoothstep(0.012, 0.0, abs(h - 0.58)) * 0.6;

  // the one accent peak: a gaussian bump top-right
  float peak = exp(-9.0 * length(p - vec2(0.78, 0.72)));

  float tone = line * (0.30 + 0.25 * h) + ridge * 0.22 + peak * 0.34 * line;

  vec3 slate = mix(vec3(0.28, 0.30, 0.33), vec3(0.62, 0.65, 0.72), u_dark);
  vec3 accent = mix(vec3(0.055, 0.478, 0.333), vec3(0.208, 0.702, 0.494), u_dark);
  vec3 ink = mix(slate, accent, clamp(peak * 1.8, 0.0, 1.0));

  return vec4(ink, clamp(tone, 0.0, 1.0));
}
`;

/**
 * DOWNLOAD — "the press proof".
 * An abstracted app window still-life in dots: paper sheet, one window
 * rectangle with UI bars, registration marks at the corners. Prints calm.
 */
export const SCENE_PRESS_PROOF = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.05;

  // paper sheet edge (very light frame)
  float sheet = smoothstep(0.02, 0.0, abs(max(abs(p.x) - 0.44, abs(p.y) - 0.30)));

  // the window: rounded rect silhouette
  vec2 w = abs(p - vec2(0.0, 0.02)) - vec2(0.30, 0.19);
  float win = smoothstep(0.012, 0.0, length(max(w, 0.0)) - 0.012 + min(max(w.x, w.y), 0.0));
  // title bar: the top strip of the window
  float bar = win * smoothstep(-0.13, -0.15, p.y) * step(p.y, 0.0);
  // text lines inside the window: dotted rows
  float rows = win * step(0.0, p.y + 0.10);
  float lineMask = smoothstep(0.016, 0.0, abs(fract((p.y + 0.08) * 14.0) - 0.5) - 0.18);
  float colMask = smoothstep(0.26, 0.24, abs(p.x) + 0.06 * sin(p.y * 9.0 + t));
  float text = rows * lineMask * colMask * 0.7;

  // registration marks: corner crosshairs
  float reg = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 c = (i == 0) ? vec2(-0.40, 0.26) : (i == 1) ? vec2(0.40, 0.26)
           : (i == 2) ? vec2(-0.40, -0.26) : vec2(0.40, -0.26);
    float dc = length(p - c);
    reg += smoothstep(0.014, 0.0, abs(dc - 0.016));
    reg += smoothstep(0.004, 0.0, abs(p.x - c.x)) * step(dc, 0.022)
         + smoothstep(0.004, 0.0, abs(p.y - c.y)) * step(dc, 0.022);
  }

  float tone = sheet * 0.18 + win * 0.16 + bar * 0.42 + text * 0.34 + reg * 0.30;

  vec3 slate = mix(vec3(0.26, 0.27, 0.30), vec3(0.60, 0.63, 0.70), u_dark);
  vec3 accent = mix(vec3(0.055, 0.478, 0.333), vec3(0.208, 0.702, 0.494), u_dark);
  vec3 ink = mix(slate, accent, bar * 0.5);

  return vec4(ink, clamp(tone, 0.0, 1.0));
}
`;

/**
 * CTA — "the dune".
 * A quiet landscape band for closing sections: layered sine ridgelines in
 * sepia ink, one sun disc in accent. Slow drift, print calm.
 */
export const SCENE_DUNE = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.06;

  // three ridgelines, each a sine terrain at different phase/amp
  float tone = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y0 = 0.34 + fi * 0.16;
    float ridge = y0 + 0.05 * sin(p.x * (3.0 + fi * 2.0) + t * (0.7 + fi * 0.4)) + 0.02 * fbm(p * 3.0 + fi);
    float band = smoothstep(0.004, 0.0, p.y - ridge) * smoothstep(0.06, 0.012, p.y - ridge);
    tone += band * (0.30 - fi * 0.07);
  }

  // the sun: a crisp disc in accent ink, upper third
  float sun = smoothstep(0.085, 0.075, length(p - vec2(0.68, 0.66)));
  tone += sun * 0.5;

  // sky speckle: a few faint dots so the field never reads empty
  tone += 0.05 * step(0.985, hash21(floor(p * 42.0)));

  vec3 sepia = mix(vec3(0.62, 0.48, 0.33), vec3(0.85, 0.76, 0.60), u_dark);
  vec3 accent = mix(vec3(0.055, 0.478, 0.333), vec3(0.208, 0.702, 0.494), u_dark);
  vec3 ink = mix(sepia, accent, sun);

  return vec4(ink, clamp(tone, 0.0, 1.0));
}
`;
