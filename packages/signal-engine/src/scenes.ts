/**
 * The painted scenes — authored GLSL for PaintedScene.
 * Each scene defines `vec4 scene(vec2 uv)`: rgb = ink color, a = tone 0..1.
 * Techniques (dither, halftone, tone mapping) are public knowledge; the
 * compositions are ours. See SPEC.md and INSPIRATION.md for lineage.
 *//**
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

/**
 * CTA — "the nocturne". A night landscape printed in two inks: velvet
 * dunes with contour striations under a star field, and one horizon arc
 * that glows like an atmosphere rim. Lineage: the tonal nocturnes of
 * generative landscape reels (Odyssey, Nov 2026 — see INSPIRATION.md);
 * the composition, palette and technique are ours: bayer-dithered tone,
 * striation contours, a print-calm drift.
 */
export const SCENE_NOCTURNE = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time * 0.045;

  // ---- the sky: near-empty paper with a sparse star field ----
  vec2 sp = p * vec2(1.0, 1.0);
  float star = step(0.9975, hash21(floor(sp * 90.0) + 7.3));
  star *= 0.5 + 0.5 * sin(u_time * 1.4 + hash21(floor(sp * 90.0)) * 6.28);
  // stars only above the sky line, fading toward the horizon glow
  float skyMask = smoothstep(0.52, 0.62, p.y);
  float tone = star * skyMask * 0.55;

  // ---- the horizon: one atmosphere arc that glows ----
  float arc = 1.0 - smoothstep(0.0, 0.10, abs(p.y - 0.52 - 0.06 * sin(p.x * 1.2 - t * 0.5)));
  float glow = exp(-3.5 * abs(p.y - 0.52)) * 0.42;
  tone += arc * 0.34 + glow * smoothstep(0.35, 0.75, p.y);

  // ---- the dunes: three velvet ridges with contour striations ----
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y0 = 0.40 - fi * 0.13;
    float ridge = y0
      + 0.055 * sin(p.x * (2.2 + fi * 1.4) + t * (0.5 + fi * 0.3) + fi * 2.1)
      + 0.02 * fbm(vec2(p.x * 3.0 + fi * 9.0, fi));
    float below = smoothstep(0.003, 0.0, p.y - ridge); // 1 under the ridge line
    // striations: fine contour bands that follow the ridge — the velvet
    float stri = 0.5 + 0.5 * sin((ridge - p.y) * 130.0 + fbm(p * 2.0 + fi) * 6.0);
    float shade = (0.16 - fi * 0.035) * (0.45 + 0.55 * stri);
    tone += below * shade;
  }

  // ---- inks: night-blue field, the accent reserved for the arc ----
  vec3 night = mix(vec3(0.16, 0.22, 0.28), vec3(0.75, 0.82, 0.90), u_dark);
  vec3 accent = mix(vec3(0.055, 0.478, 0.333), vec3(0.208, 0.702, 0.494), u_dark);
  float arcness = clamp(arc * 1.6 + glow * 0.8, 0.0, 1.0);
  vec3 ink = mix(night, accent, arcness * arcness);

  // film speckle: a whisper of grain over everything, print calibre
  tone *= 0.94 + 0.06 * hash21(p * 300.0 + t);

  return vec4(ink, clamp(tone, 0.0, 1.0));
}
`;

/* ============================================================
   GLYPH scenes — authored GLSL for GlyphScene (true ASCII).
   Same contract: rgb = ink color inside the glyphs, a = tone 0..1.
   ============================================================ */

/**
 * GLYPH HERO — "the ascii bloom".
 * The orchid macro printed as TRUE ASCII: the photo's tone maps through the
 * glyph ramp (dark petals = `@#%`, lights = ` .·`), and the ink is
 * truecolor — plum/violet for petals, green for the lip, silver for the
 * stem. The whisper plate still thins the print where type lands.
 */
export const GLYPH_SCENE_BLOOM = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 suv = uv + vec2(sin(u_time * 0.18) * 0.004, cos(u_time * 0.13) * 0.003);

  float t = imgTone(suv);

  // the whisper plate: type sits on a whisper of glyphs
  float narrow = 1.0 - smoothstep(500.0, 900.0, u_res.x);
  float px0 = mix(0.62, 0.97, narrow);
  float px1 = mix(0.72, 1.05, narrow);
  float bandX = 1.0 - smoothstep(px0, px1, uv.x);
  float bandY = 1.0 - smoothstep(0.42, 0.52, uv.y);
  float quiet = bandX * bandY;
  float tone = min(t, mix(0.16, 1.0, 1.0 - quiet));

  // darks print as solid glyph mass outside the quiet zone
  tone = max(tone, smoothstep(0.80, 0.92, t) * (1.0 - quiet));

  // load wipe: the print develops from the top-left corner, ~0.9s expo-out
  float reveal = 1.0 - pow(1.0 - clamp(u_time / 0.9, 0.0, 1.0), 4.0);
  float dw = distance(uv, vec2(0.0, 1.0));
  tone *= 1.0 - smoothstep(reveal * 1.5, reveal * 1.5 + 0.12, dw);

  // hue inks: sample the photo's color, map to the print triad
  vec3 c = imgRGB(suv);
  // petal hue: violet-magenta when r > g (the orchid's family)
  float petalness = clamp((c.r - c.g) * 2.6, 0.0, 1.0) * step(0.08, t);
  // lip hue: the yellow-green throat (g dominates)
  float lipness = clamp((c.g - c.r) * 3.0, 0.0, 1.0) * step(0.10, t) * (1.0 - petalness);

  if (u_dark > 0.5) {
    // the dark run: luminous violet → silver where dense, mint lip
    vec3 body  = vec3(0.667, 0.627, 0.882);
    vec3 dense = vec3(0.878, 0.871, 0.973);
    vec3 acc   = vec3(0.208, 0.702, 0.494);
    vec3 ink = mix(body, dense, smoothstep(0.45, 0.95, t));
    ink = mix(ink, acc, lipness * 0.9);
    float dust = 0.07 * smoothstep(0.35, 0.05, t);
    return vec4(ink, max(tone, dust));
  }

  // the light run: plum → deep violet, green lip
  vec3 plum = vec3(0.478, 0.325, 0.549);
  vec3 deep = vec3(0.286, 0.220, 0.404);
  vec3 acc  = vec3(0.055, 0.478, 0.333);
  vec3 ink = mix(plum, deep, smoothstep(0.55, 0.97, t));
  ink = mix(ink, acc, lipness * 0.9);
  return vec4(ink, tone);
}
`;

/**
 * GLYPH SECTION — "the ascii garden".
 * A botanical band of authored tulips: cup blooms on swaying stems over a
 * dithered ground, one in accent green, one in coral. Fully procedural —
 * no photo — so the glyphs themselves draw the petals (ramp = shading).
 * Stations are aspect-relative (p spans [0,aspect]) so they survive every
 * viewport width. Verified via CPU raster preview before porting.
 */
export const GLYPH_SCENE_GARDEN = /* glsl */ `
vec4 scene(vec2 uv) {
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float aspect = u_res.x / u_res.y;
  float t = u_time * 0.05;

  float tone = 0.0;
  vec3 ink = mix(vec3(0.28, 0.30, 0.33), vec3(0.62, 0.64, 0.74), u_dark);
  float accentMix = 0.0;
  float coralMix = 0.0;

  // the ground: a dithered soil band, bottom quarter
  float ground = smoothstep(0.24, 0.20, p.y);
  tone += ground * (0.30 + 0.10 * fbm(p * vec2(6.0, 3.0) + vec2(t, 0.0)));

  // seven tulips, each on its own sway phase — the garden breathes
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float x0 = aspect * (0.08 + fi * 0.14);
    float sway = sin(t * (0.8 + fi * 0.13) + fi * 1.7) * 0.014;
    float hx = x0 + sway;

    // the stem: a hairline from ground to bloom
    float stemD = abs(p.x - hx + (p.y - 0.24) * 0.10);
    float stem = smoothstep(0.010, 0.003, stemD) * smoothstep(0.24, 0.30, p.y) * smoothstep(0.52, 0.46, p.y);

    // a leaf: a curved blade on the lower stem
    vec2 lp = p - vec2(hx + 0.05, 0.42);
    float ang = 0.9;
    vec2 rp = vec2(lp.x * cos(ang) - lp.y * sin(ang), lp.x * sin(ang) + lp.y * cos(ang));
    float leaf = smoothstep(0.030, 0.024, abs(rp.x) * (1.0 + abs(rp.y) * 9.0)) * smoothstep(0.16, 0.02, abs(rp.y));
    leaf *= step(0.0, rp.y);

    // the bloom: a wide cup with a center notch (reads in glyphs)
    vec2 b = p - vec2(hx, 0.52 + sin(t * 0.7 + fi) * 0.006);
    b.x /= 0.62;
    float r = length(vec2(b.x * 0.75, b.y * 1.1));
    float cup = smoothstep(0.155, 0.138, r);
    float notch = smoothstep(0.052, 0.042, abs(b.x)) * step(0.0, b.y);
    float bloom = clamp(cup - notch, 0.0, 1.0) * smoothstep(0.0, 0.012, 0.155 - r + 0.012);
    // petal ribs: vertical shading inside the cup
    float ribs = 0.16 * smoothstep(0.05, 0.0, abs(fract(b.x * 14.0) - 0.5) - 0.18);

    float w = stem * 0.55 + leaf * 0.30 + bloom * (0.72 + ribs);
    tone = max(tone, w);

    if (i == 3) accentMix = clamp(bloom + stem, 0.0, 1.0);
    if (i == 5) coralMix = clamp(bloom * 0.6, 0.0, 1.0);
  }

  // sky speckle: sparse dust so the field never reads empty
  tone += 0.05 * step(0.986, hash21(floor(p * vec2(48.0, 40.0))));

  // inks: slate body; station 3 accent green; station 5 coral
  vec3 acc = mix(vec3(0.055, 0.478, 0.333), vec3(0.208, 0.702, 0.494), u_dark);
  vec3 coral = vec3(0.910, 0.416, 0.369);
  ink = mix(ink, acc, accentMix);
  ink = mix(ink, coral, coralMix);

  return vec4(ink, clamp(tone, 0.0, 1.0));
}
`;
