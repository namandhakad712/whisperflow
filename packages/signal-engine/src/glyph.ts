/**
 * ENGINE E — GlyphScene. "the typewriter press".
 * The TRUE ASCII renderer: a color scene printed as GLYPHS — not dots.
 * tone → glyph ramp (bayer-dithered), scene color → glyph ink (truecolor),
 * exactly the printed-ASCII references this brand is built to match:
 * color lives INSIDE the glyphs, darks print as dense blocks `@#`, lights
 * as ` .·`, the lattice drifts so the print re-rasters forever.
 *
 * The glyph atlas is rendered once per ramp+font into a texture row; the
 * fragment shader composes cell → glyph → ink in a single pass.
 *
 * Canvas2D fallback: CPU grid of glyphs, same scene semantics, static.
 */
import { GLLoop, Uniforms, cappedDpr, createGL, linkProgram, reducedMotion } from "./gl";
import { GLYPH_FRAG } from "./shaders";

/** The print ramps — ours, tuned by eye on the orchid source.
 *  Density-first: midtones land on 'x'/'X' masses (10-20% ink per glyph),
 *  never on hollow strokes — the reference prints read DENSE. */
export const GLYPH_RAMPS = {
  /** Fine detail ramp: continuous tone, reads like shading. */
  fine: " .`:;=+xxxX##@",
  /** Bold display ramp: chunky, poster-like. */
  bold: " .:+xX#@",
  /** Dots ramp: stipple/grain, for quiet fields. */
  dots: " .·∙•●",
} as const;

export type GlyphRampName = keyof typeof GLYPH_RAMPS;

export interface GlyphSceneOptions {
  /** GLSL body defining `vec4 scene(vec2 uv)` — rgb = ink, a = tone 0..1. */
  scene: string;
  /** Glyph ramp (default "fine"). */
  ramp?: GlyphRampName;
  /** Cell size in CSS px — the glyph pitch. Default 8. */
  cell?: number;
  /** Mono font stack for the atlas. Must be loaded before mount. */
  font?: string;
  /** External drive 0..1 (voice level, scroll velocity…). */
  drive?: () => number;
  /** Camera drift multiplier (default 1). */
  drift?: number;
  /** Paper name for mode-reactive paper: "cream" | "ink". */
  paper?: string;
  /** Optional photo to print: mapped over uv, inked by the scene. */
  image?: string;
  imageCrop?: [number, number, number];
}

interface GlyphPalette {
  paper: readonly [number, number, number];
}

const PALETTES: Record<string, GlyphPalette> = {
  cream: { paper: [0.969, 0.957, 0.933] as const }, // #F7F4EE
  ink: { paper: [0.078, 0.09, 0.114] as const }, // #14171D
};

export class GlyphScene {
  private loop: GLLoop | null = null;
  private u: Uniforms | null = null;
  private io: IntersectionObserver | null = null;
  private disposed = false;
  private smoothDrive = 0;
  private crop: [number, number, number] | null = null;
  private driveOverride: number | null = null;
  private cleanup: () => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: GlyphSceneOptions,
  ) {}

  mount(): void {
    if (this.disposed) return;
    if (this.opts.image) {
      // Boot race: bringing up GL before the photo is decoded leaves the
      // hero printing empty glyphs (the texture arrives mid-race). Load and
      // decode FIRST, then init GL — the print is dense from frame one.
      const src = this.opts.image;
      const img = new Image();
      const isCross = /^https?:/i.test(src) && new URL(src, location.href).origin !== location.origin;
      if (isCross) img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = async () => {
        try { await img.decode(); } catch { /* already decoded */ }
        this.initGL(img);
      };
      img.onerror = () => this.initGL(null);
      img.src = src;
      return;
    }
    this.initGL(null);
  }

  private initGL(img: HTMLImageElement | null): void {
    if (this.disposed) return;
    const reduced = reducedMotion();
    const ctx = createGL(this.canvas);
    if (!ctx) {
      this.mountFallback();
      return;
    }
    const { gl } = ctx;
    const prog = linkProgram(gl, FULLSCREEN_QUAD_VERT, GLYPH_FRAG(this.opts.scene));
    if (!prog) {
      this.mountFallback();
      return;
    }
    gl.useProgram(prog);

    const ramp = GLYPH_RAMPS[this.opts.ramp ?? "fine"];
    // mutable atlas: rebuilt once webfonts are ready. A fallback-font atlas
    // renders most ramps near-invisible — the #1 cause of a "blank" print.
    let atlas = this.buildAtlas(gl, ramp);
    if (!atlas) {
      this.mountFallback();
      return;
    }
    // The atlas must be built with the real mono font. fonts.ready can fire
    // before the @font-face is even registered (no pending loads = ready),
    // so we rebuild on every signal that the font may have arrived:
    // explicit fonts.load, fonts.ready, and window load.
    const rebuild = () => {
      if (this.disposed) return;
      const next = this.buildAtlas(gl, ramp);
      if (next) {
        gl.deleteTexture(atlas!);
        atlas = next;
      }
    };
    if (typeof document !== "undefined" && document.fonts) {
      const fontSpec = `500 47px ${this.opts.font ?? `"JetBrains Mono", ui-monospace, monospace`}`;
      document.fonts.load(fontSpec).then(rebuild).catch(() => {});
      document.fonts.ready.then(rebuild).catch(() => {});
    }
    if (typeof window !== "undefined") {
      if (document.readyState === "complete") setTimeout(rebuild, 0);
      else window.addEventListener("load", () => rebuild(), { once: true });
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    this.u = new Uniforms(gl, prog);

    let paperName = this.opts.paper ?? "cream";
    let paper = PALETTES[paperName] ?? PALETTES.cream;
    const modeObs = new MutationObserver(() => {
      const next = document.documentElement.dataset.mode === "dark" ? "ink" : "cream";
      if (next !== paperName) {
        paperName = next;
        paper = PALETTES[paperName] ?? PALETTES.cream;
      }
    });
    modeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });

    const resize = () => {
      const dpr = cappedDpr();
      const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    // the photo (already decoded before GL init by mount())
    let imgTex: WebGLTexture | null = null;
    let imgW = 0;
    let imgH = 0;
    if (img) {
      imgTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0); // explicit: never clobber the atlas unit
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;
    }

    let mx = 0;
    let my = 0;
    let px = 0,
      py = 0,
      tx = 0,
      ty = 0;
    const onMove = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / Math.max(1, r.width);
      my = 1 - (e.clientY - r.top) / Math.max(1, r.height);
      tx = mx * 2.0 - 1.0;
      ty = my * 2.0 - 1.0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    this.loop = new GLLoop({
      reducedMotion: reduced,
      frame: ({ time }) => {
        resize();
        const u = this.u!;
        u.f3("u_paper", paper.paper[0], paper.paper[1], paper.paper[2]);
        u.f1("u_dark", paperName === "ink" ? 1 : 0);
        u.f2("u_res", this.canvas.width, this.canvas.height);
        u.f1("u_time", time);
        u.f1("u_cell", (this.opts.cell ?? 8) * cappedDpr());
        u.f1("u_drift", this.opts.drift ?? 1);
        u.f2("u_mouse", mx, my);
        px += (tx - px) * 0.055;
        py += (ty - py) * 0.055;
        u.f2("u_par", px, py);
        const target = this.driveOverride ?? this.opts.drive?.() ?? 0;
        this.smoothDrive += (target - this.smoothDrive) * 0.1;
        u.f1("u_drive", this.smoothDrive);
        const crop = this.crop ?? this.opts.imageCrop ?? [0.5, 0.5, 1];
        u.f3("u_imgCrop", crop[0], crop[1], crop[2]);

        if (imgTex) {
          u.tex("u_img", imgTex, 0);
          u.f3("u_imgAspect", imgW, imgH, 1);
        } else {
          u.f3("u_imgAspect", 1, 1, 0);
        }
        if (atlas) u.tex("u_atlas", atlas, 1);
        u.f1("u_glyphs", ramp.length);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    });

    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((entries) => {
        this.loop?.setVisible(entries.some((e) => e.isIntersecting));
      });
      this.io.observe(this.canvas);
    }
    this.loop.startLoop();

    const onCleanup = () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      this.io?.disconnect();
      modeObs.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteTexture(atlas);
      if (imgTex) gl.deleteTexture(imgTex);
      gl.deleteProgram(prog);
    };
    ctx.onDispose(onCleanup);
    this.cleanup = onCleanup;
  }

  /** The glyph atlas: one row, one glyph per slot, white on black. */
  private buildAtlas(gl: WebGLRenderingContext, ramp: string): WebGLTexture | null {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = size * ramp.length;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    ctx.font = `500 ${Math.round(size * 0.74)}px ${this.opts.font ?? `"JetBrains Mono", ui-monospace, monospace`}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < ramp.length; i++) {
      ctx.fillText(ramp[i]!, i * size + size / 2, size / 2 + 2);
    }
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.activeTexture(gl.TEXTURE1); // the atlas slot — upload must not land on u_img
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /** CPU fallback: a static glyph grid printed from a JS scene sampler. */
  private mountFallback(): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    const pre = document.createElement("pre");
    pre.style.cssText =
      "position:absolute;inset:0;margin:0;overflow:hidden;pointer-events:none;" +
      'font:11px/1.1 "JetBrains Mono",ui-monospace,monospace;' +
      "user-select:none;white-space:pre;";
    pre.setAttribute("aria-hidden", "true");
    const cols = 110;
    const rows = 26;
    const ramp = GLYPH_RAMPS[this.opts.ramp ?? "fine"];
    const dark = this.opts.paper === "ink";
    let out = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const u = x / cols;
        const v = y / rows;
        const t = Math.max(
          0,
          0.42 + 0.3 * Math.sin(u * 6.2) * Math.cos(v * 4.1) - 0.4 * Math.hypot(u - 0.5, v - 0.45),
        );
        const idx = Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)));
        out += ramp[idx]!;
      }
      out += "\n";
    }
    pre.style.color = dark ? "rgba(151,161,192,0.55)" : "rgba(38,45,84,0.55)";
    pre.textContent = out;
    host.appendChild(pre);
    this.cleanup = () => pre.remove();
  }

  /** Re-compose the printed image live: [cx, cy, zoom]. */
  setCrop(crop: [number, number, number]): void {
    this.crop = crop;
  }

  /** Re-register the glyph pitch live: cell size in CSS px. */
  setCell(px: number): void {
    this.opts.cell = px;
  }

  /** Drive the print directly (scroll velocity, audio…). */
  setDrive(v: number): void {
    this.driveOverride = v;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop?.dispose();
    this.cleanup();
  }
}

/** Local quad vertex shader (kept private to this module). */
const FULLSCREEN_QUAD_VERT = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
