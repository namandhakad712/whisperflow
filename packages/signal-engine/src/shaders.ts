/**
 * WhisperFlow Signal Standard — GLSL sources.
 *
 * Every shader here is authored for WhisperFlow. Techniques (ordered Bayer
 * dithering, luma→glyph mapping, halftone dots) are decades-old public
 * knowledge; the composition, palettes and behavior are ours. See
 * INSPIRATION.md at the repo root for the technique lineage.
 */

/** Shared helpers injected into every fragment shader. */
export const COMMON_FRAG = /* glsl */ `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;

`;

/**
 * ENGINE A — DitherField.
 * A breathing ordered-dither field: Bayer 8x8 threshold vs a slow traveling
 * wave, palette-quantized to two token colors. The cursor injects a local
 * luma lift so the field "hears" the pointer like a mic hears a voice.
 */
export const DITHER_FRAG = /* glsl */ `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_paper;      // ink (page background)
uniform vec3 u_ink;        // dither dot color
uniform vec3 u_glow;       // cursor accent
uniform vec2 u_mouse;      // pixels, (0,0) = none armed
uniform float u_breath;    // 0..1, external drive (audio level or idle breath)
uniform float u_scale;     // cell size in px

// A slow traveling wave — the "breath" of the field.
float wave(vec2 p, float t, float freq, float amp, float dir) {
  return sin(p.x * freq * cos(dir) + p.y * freq * sin(dir) + t) * amp
       + sin(p.x * freq * 0.53 - p.y * freq * 0.71 + t * 0.61) * amp * 0.5;
}

// Bayer 8x8 via recursive 2x2 tiling (public-domain pattern).
float bayer2(vec2 q) {
  // base 2x2 pattern: (0 2; 3 1)
  float idx = mod(q.y, 2.0) * 2.0 + mod(q.x, 2.0);
  if (idx < 0.5) return 0.0;
  if (idx < 1.5) return 2.0;
  if (idx < 2.5) return 3.0;
  return 1.0;
}

float bayer8(vec2 p) {
  vec2 q = floor(mod(p, 8.0));
  float b = 0.0;
  float bit = 1.0;
  for (int i = 0; i < 3; i++) {
    b += bayer2(q) * bit;
    bit *= 4.0;
    q = floor(q / 2.0);
  }
  return (b + 0.5) / 64.0;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 cell = px / u_scale;
  vec2 p = px / u_res;

  // slow traveling wave — the "breath". Never loops faster than a resting breath.
  float t = u_time * 0.22;
  float w = wave(p, t, 9.0, 0.16, 0.6);
  w += wave(p, t * 0.73, 4.2, 0.10, -1.9);
  // external drive (audio / scroll velocity) deepens the field
  w += u_breath * 0.22 * sin(p.y * 12.0 - u_time * 1.9);

  // cursor: a soft luma well around the pointer
  float m = 0.0;
  if (u_mouse.x > 0.5) {
    float d = distance(px, u_mouse);
    m = smoothstep(220.0, 0.0, d) * 0.5;
  }

  float luma = 0.40 + w * 0.5 + m;
  float thr = bayer8(cell);
  float on = step(thr, luma);

  // near the cursor, tint toward the glow color
  vec3 col = mix(u_ink, u_glow, clamp(m * 1.6, 0.0, 1.0));
  vec3 outc = mix(u_paper, col, on);
  // soften the very brightest cells so it never reads as noise
  outc = mix(outc, u_paper, smoothstep(0.86, 1.0, luma) * 0.35);
  gl_FragColor = vec4(outc, 1.0);
}
`;

/**
 * ENGINE B — AsciiRender.
 * Renders an animated waveform "signal" scene to an offscreen luma target,
 * then post-processes it into glyphs from a character atlas texture.
 * This is the product made visible: voice → signal → text.
 */
export const ASCII_SCENE_FRAG = /* glsl */ `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_drive;     // 0..1 external amplitude (mic level / demo drive)
uniform float u_density;   // 0..1 glyph detail (hover/scroll driven)

// The signal: a layered oscilloscope trace across the viewport.
float trace(vec2 p) {
  float t = u_time;
  float y = 0.5;
  y += sin(p.x * 6.0 + t * 1.4) * 0.12 * (0.58 + u_drive);
  y += sin(p.x * 11.0 - t * 2.3) * 0.06 * (0.45 + u_drive * 0.8);
  y += sin(p.x * 23.0 + t * 3.7) * 0.02 * (0.2 + u_drive);
  // an envelope shaped like speech: bursts and gaps
  float env = smoothstep(0.25, 0.6, sin(p.x * 2.4 - t * 0.5) * 0.5 + 0.5);
  y = 0.5 + (y - 0.5) * (0.25 + env * (0.75 + u_drive * 0.6));
  return y;
}

void main() {
  vec2 p = gl_FragCoord.xy / u_res;
  float y = trace(p);
  float d = abs(p.y - y);
  // beam width tightens with density; plus a soft afterglow band
  float beam = smoothstep(0.016 + (1.0 - u_density) * 0.012, 0.0, d);
  float glow = smoothstep(0.14, 0.0, d) * 0.3;
  float luma = clamp(beam + glow, 0.0, 1.0);
  // faint grid ticks so the field reads as an instrument screen
  float grid = step(0.985, fract(p.x * 24.0)) * step(0.985, fract(p.y * 12.0)) * 0.12;
  gl_FragColor = vec4(vec3(luma + grid), 1.0);
}
`;

export const ASCII_POST_FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D u_scene;    // luma scene
uniform sampler2D u_atlas;    // glyph atlas: N glyphs in a row
uniform vec2 u_res;
uniform float u_cells;        // columns across the viewport
uniform float u_glyphs;       // glyph count in atlas
uniform vec3 u_color;         // trace color (phosphor)

void main() {
  vec2 cellCount = vec2(u_cells, u_cells * u_res.y / u_res.x);
  vec2 cell = floor(gl_FragCoord.xy * cellCount / u_res);
  vec2 cellUv = fract(gl_FragCoord.xy * cellCount / u_res);

  // average the scene luma inside this cell (2x2 taps)
  vec2 texel = 1.0 / u_res;
  vec2 center = (cell + 0.5) / cellCount;
  float l = texture2D(u_scene, center).r;
  l += texture2D(u_scene, center + vec2(texel.x * 4.0, 0.0)).r;
  l += texture2D(u_scene, center - vec2(texel.x * 4.0, 0.0)).r;
  l += texture2D(u_scene, center + vec2(0.0, texel.y * 4.0)).r;
  l /= 4.0;

  // map luma → glyph index into the atlas row
  float idx = floor(clamp(l, 0.0, 0.999) * u_glyphs);
  vec2 glyphUv = vec2((cellUv.x + idx) / u_glyphs, cellUv.y);
  float glyph = texture2D(u_atlas, glyphUv).r;

  gl_FragColor = vec4(u_color * glyph * clamp(l * 2.6, 0.0, 1.0), 1.0);
}
`;

/**
 * ENGINE C — HalftoneReveal.
 * An image that "develops": starts fully dithered (halftone dots at 45°),
 * and resolves into the real image driven by `u_reveal` (scroll/hover),
 * with a soft circular wipe so it feels like a print in a developer tray.
 */
export const HALFTONE_FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D u_img;
uniform vec2 u_res;
uniform vec2 u_img_res;
uniform float u_time;
uniform float u_reveal;      // 0 = fully dithered, 1 = resolved
uniform vec2 u_focus;        // reveal origin (uv)

// 2x2 Bayer base: (0 2; 3 1)
float bayer2(vec2 q) {
  float idx = mod(q.y, 2.0) * 2.0 + mod(q.x, 2.0);
  if (idx < 0.5) return 0.0;
  if (idx < 1.5) return 2.0;
  if (idx < 2.5) return 3.0;
  return 1.0;
}

float bayer4(vec2 p) {
  vec2 q = floor(mod(p, 4.0));
  // compose from two 2x2 levels: value = base(y%2,x%2) + 4*base((y/2)%2,(x/2)%2)
  float b0 = bayer2(q);
  float b1 = bayer2(floor(q / 2.0));
  float v = b0 + 4.0 * b1;
  return (v + 0.5) / 16.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // cover-fit the image
  float scale = max(u_res.x / u_img_res.x, u_res.y / u_img_res.y);
  vec2 iuv = (uv - 0.5) / scale + 0.5;
  if (iuv.x < 0.0 || iuv.x > 1.0 || iuv.y < 0.0 || iuv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 img = texture2D(u_img, vec2(iuv.x, 1.0 - iuv.y)).rgb;
  float lum = dot(img, vec3(0.2126, 0.7152, 0.0722));

  // circular wipe from focus
  float d = distance(uv, u_focus);
  float wipe = smoothstep(u_reveal * 1.25, u_reveal * 1.25 - 0.35, d);

  // 45-degree halftone cell grid
  vec2 p = gl_FragCoord.xy;
  vec2 rot = vec2(
    p.x * 0.7071 - p.y * 0.7071,
    p.x * 0.7071 + p.y * 0.7071
  ) / 5.0;
  float thr = bayer4(rot);
  float halftone = step(thr, lum * 0.85 + 0.08);

  vec3 col = mix(vec3(halftone), img, wipe);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ============================================================
   ENGINE D — PaintedScene ("printed signal").
   Printmaking pass: scene → color+tone → bayer4 dither →
   halftone-dot glyph, tinted by the scene ink. A slow camera
   drift re-rasters the lattice every frame.
   ============================================================ */

/** Helpers available to every painted scene. */
export const PAINTED_COMMON = /* glsl */ `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_paper;
uniform float u_cell;
uniform float u_drift;
uniform vec2 u_mouse;
uniform float u_drive;
uniform sampler2D u_img;
uniform vec3 u_imgAspect;  // (w, h, hasImage 0/1)
uniform vec3 u_imgCrop;    // (cx, cy, zoom)

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u3 = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u3.x), mix(c, d, u3.x), u3.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
// value (perceptual weight) of an ink color on paper
float valueOf(vec3 ink) {
  return dot(ink, vec3(0.2126, 0.7152, 0.0722));
}

// sample the photo at a scene uv, cover-fit + crop (zoom>1 = tighter).
// returns rgb in 0..1; call from your scene() to print a real image.
vec3 imgRGB(vec2 uv) {
  if (u_imgAspect.z < 0.5) return vec3(0.0);
  float srcAsp = u_imgAspect.x / u_imgAspect.y;
  float dstAsp = u_res.x / u_res.y;
  // cover-fit scale, then user zoom
  float sc = (srcAsp > dstAsp) ? dstAsp / srcAsp : 1.0;
  sc /= max(u_imgCrop.z, 0.001);
  vec2 rel = (uv - 0.5) * vec2(1.0 / max(sc * srcAsp / dstAsp, 0.001), 1.0 / max(sc, 0.001));
  // simpler: uniform-cover then zoom
  vec2 size = (srcAsp > dstAsp)
    ? vec2(dstAsp / srcAsp, 1.0)
    : vec2(1.0, srcAsp / dstAsp);
  size /= max(u_imgCrop.z, 0.001);
  vec2 iuv = u_imgCrop.xy + (uv - 0.5) * size;
  iuv.y = 1.0 - iuv.y; // flip: image y is down
  if (iuv.x < 0.0 || iuv.x > 1.0 || iuv.y < 0.0 || iuv.y > 1.0) return vec3(0.0);
  return texture2D(u_img, iuv).rgb;
}
// tone from a photo: luma remapped for print (quiet highlights, full range)
float imgTone(vec2 uv) {
  vec3 c = imgRGB(uv);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // gamma lift so mid-tones print with form; paper stays clean
  return pow(clamp(l, 0.0, 1.0), 1.35);
}
`;

/** The printed renderer — wraps a user scene body. */
export const PAINTED_FRAG = (sceneGLSL: string) => /* glsl */ `
${PAINTED_COMMON}
${sceneGLSL}

// 4x4 Bayer matrix (public-domain ordered dither)
float bayer4(vec2 q) {
  int x = int(mod(q.x, 4.0));
  int y = int(mod(q.y, 4.0));
  int idx = 0;
  // unrolled 4x4 Bayer lookup
  if (x == 0 && y == 0) idx = 0;  else if (x == 1 && y == 0) idx = 8;
  else if (x == 2 && y == 0) idx = 2;  else if (x == 3 && y == 0) idx = 10;
  else if (x == 0 && y == 1) idx = 12; else if (x == 1 && y == 1) idx = 4;
  else if (x == 2 && y == 1) idx = 14; else if (x == 3 && y == 1) idx = 6;
  else if (x == 0 && y == 2) idx = 3;  else if (x == 1 && y == 2) idx = 11;
  else if (x == 2 && y == 2) idx = 1;  else if (x == 3 && y == 2) idx = 9;
  else if (x == 0 && y == 3) idx = 15; else if (x == 1 && y == 3) idx = 7;
  else if (x == 2 && y == 3) idx = 13; else idx = 5;
  return float(idx) / 16.0 + 0.5 / 16.0;
}

void main() {
  // camera drift — the scene slowly pans/zooms so every frame re-rasters
  float t = u_time * 0.03 * u_drift;
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 suv = (uv - 0.5) / (1.0 + 0.04 * sin(t * 0.7)) + 0.5;
  suv += vec2(t * 0.35, sin(t * 0.5) * 0.02);

  // the scene paints ink + tone
  vec4 s = scene(suv);

  // pointer: a soft local tone lift (the print "hears" you)
  float m = exp(-18.0 * distance(uv, u_mouse)) * 0.22;

  float tone = clamp(s.a * (1.0 + u_drive * 0.35) + m, 0.0, 1.0);
  vec3 ink = s.rgb;
  // print S-curve: preserves deep ink + clean paper, boosts midtone steps
  tone = tone * tone * (3.0 - 2.0 * tone) * 0.82 + tone * 0.18;

  // the halftone cell: square grid, one dot per cell
  vec2 cellpx = floor(gl_FragCoord.xy / u_cell);
  vec2 cellf = fract(gl_FragCoord.xy / u_cell) - 0.5;

  // dithered tone: bayer4 jitter inside the cell's radius decision
  float thr = bayer4(cellpx) * 0.22;
  // 5-radius dot ramp (· ∙ • ⦁ ●): tone selects the radius
  float r = 0.0;
  if      (tone > 0.84) r = 0.50; // ●
  else if (tone > 0.62) r = 0.36; // ⦁
  else if (tone > 0.42) r = 0.26; // •
  else if (tone > 0.24) r = 0.16; // ∙
  else if (tone > 0.10) r = 0.07; // ·
  float dithered = tone + (thr - 0.11);
  if (dithered > 0.84) r = 0.50;
  else if (dithered > 0.62) r = 0.36;
  else if (dithered > 0.42) r = 0.26;
  else if (dithered > 0.24) r = 0.16;
  else if (dithered > 0.10) r = 0.07;
  else r = 0.0;

  float dot_ = 1.0 - smoothstep(r - 0.06, r + 0.06, length(cellf));

  // quiet the darks: ink fades toward paper at low tone (print, not screen)
  vec3 painted = mix(u_paper, ink, dot_);
  gl_FragColor = vec4(painted, 1.0);
}
`;
