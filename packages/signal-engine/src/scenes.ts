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
  // ambient life — the print breathes
  vec2 suv = uv + vec2(sin(u_time * 0.18) * 0.004, cos(u_time * 0.13) * 0.003);

  // the photo's ink coverage: petal shading prints, paper stays clean
  float t = imgTone(suv);

  // hue detection: the orchid lip/throat (magenta-ish) gets accent ink
  vec3 c = imgRGB(suv);
  float lipness = clamp((c.r - c.g) * 3.0, 0.0, 1.0) * step(0.10, t);

  // the type zone: a clean-paper plate behind the whole text block.
  // uv.y is up (GL), so the copy band is uv.y < 0.45, uv.x < 0.55 —
  // a soft-cornered rectangle fading IN from the top-right of the band.
  float bandX = 1.0 - smoothstep(0.30, 0.62, uv.x);   // 1 on the left
  float bandY = 1.0 - smoothstep(0.34, 0.52, uv.y);   // 1 at the bottom
  float typeZone = bandX * bandY;
  // and a global bottom fade: the print lifts off the bottom edge
  float horizon = smoothstep(0.08, 0.40, uv.y);
  float mat = max(typeZone, horizon);

  // bloom reveal: bottom-up develop on load (2.4s ease-out)
  float reveal = clamp(u_time / 2.4, 0.0, 1.0);
  float edge = reveal * 1.35 - 0.1;
  float curtain = 1.0 - smoothstep(edge - 0.02, edge + 0.18, uv.y);

  float tone = t * mat * curtain;

  // inks: cobalt body, deep shadows, accent lip — a committed duotone
  vec3 cobalt  = vec3(0.176, 0.294, 0.557);  // #2D4B8E
  vec3 deep    = vec3(0.10, 0.19, 0.42);
  vec3 accent  = vec3(0.055, 0.478, 0.333);  // #0E7A55
  vec3 ink = mix(cobalt, deep, smoothstep(0.45, 0.9, t));
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

  vec3 slate = vec3(0.28, 0.30, 0.33);
  vec3 accent = vec3(0.055, 0.478, 0.333); // #0E7A55
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

  vec3 slate = vec3(0.26, 0.27, 0.30);
  vec3 accent = vec3(0.055, 0.478, 0.333);
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

  vec3 sepia = vec3(0.62, 0.48, 0.33); // #9E7A54 print ochre
  vec3 accent = vec3(0.055, 0.478, 0.333);
  vec3 ink = mix(sepia, accent, sun);

  return vec4(ink, clamp(tone, 0.0, 1.0));
}
`;
