/**
 * ENGINE D — PaintedScene.
 * A printmaking renderer: the scene is painted as color+tone, tone maps to
 * halftone-dot glyphs (5 radii), and each glyph is tinted by the scene color —
 * color lives INSIDE the glyphs, like a risograph print. A slow camera drift
 * re-rasters the scene every frame ("living grain"), the signature motion of
 * the printed references this engine is built to match.
 *
 * Ported-technique credits (MIT, asciicn.dev engine study, 2026-11):
 * - tone-from-color scene mapping (tone = f(value), darks quieted)
 * - bayer4 dither on the tone→glyph mapping
 * - square ~7px cells (~200 columns at 1440) for the halftone print look
 * - motion 0.01–0.08 units/s; never hash raw time
 * The GLSL composition and TS runtime are ours, on our existing harness.
 *
 * Canvas2D fallback: static dot field sampled from the same scene function
 * (evaluated per-cell on CPU at reduced resolution).
 */
import { PAINTED_FRAG } from "./shaders";
import { FULLSCREEN_VERT, GLLoop, Uniforms, cappedDpr, createGL, linkProgram, reducedMotion } from "./gl";

/** A GLSL scene body: must define `vec4 scene(vec2 uv)` returning ink rgb + tone a. */
export type SceneGLSL = string;

export interface PaintedSceneOptions {
  /** GLSL body defining `vec4 scene(vec2 uv)` — rgb = ink, a = tone 0..1. */
  scene: SceneGLSL;
  /** Cell size in CSS px (default 7 — the print register). */
  cell?: number;
  /** External amplitude drive 0..1 (voice level, scroll…) lifts tone. */
  drive?: () => number;
  /** Camera drift speed multiplier (default 1 = 0.03 units/s). */
  drift?: number;
  /** Paper color — the page beneath the dots. */
  paper?: string;
  /** Optional photo to print: mapped over uv, duotoned by the scene ink.
   * When set, the scene body samples it via `imgRGB()` / `imgTone()`. */
  image?: string;
  /** Image crop: [centerX, centerY, zoom] in 0..1 space (default center). */
  imageCrop?: [number, number, number];
}

interface PaintedPalette {
  paper: readonly [number, number, number];
}

const PALETTES: Record<string, PaintedPalette> = {
  cream: { paper: [0.969, 0.957, 0.933] as const }, // #F7F4EE
  ink: { paper: [0.078, 0.09, 0.114] as const }, // #14171D
};

export class PaintedScene {
  private loop: GLLoop | null = null;
  private u: Uniforms | null = null;
  private io: IntersectionObserver | null = null;
  private disposed = false;
  private smoothDrive = 0;
  private crop: [number, number, number] | null = null;
  private driveOverride: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: PaintedSceneOptions,
  ) {}

  mount(): void {
    if (this.disposed) return;
    const reduced = reducedMotion();
    const ctx = createGL(this.canvas);
    if (!ctx) {
      this.mountFallback();
      return;
    }
    const { gl } = ctx;
    const prog = linkProgram(gl, FULLSCREEN_VERT, PAINTED_FRAG(this.opts.scene));
    if (!prog) {
      this.mountFallback();
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    this.u = new Uniforms(gl, prog);

    let paperName = this.opts.paper ?? "cream";
    let paper = PALETTES[paperName] ?? PALETTES.cream;
    // the print follows the sheet: switching data-mode re-inks every scene live
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

    // the photo to print (optional): loaded async, bound when ready
    let imgTex: WebGLTexture | null = null;
    let imgW = 0;
    let imgH = 0;
    if (this.opts.image) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        imgTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, imgTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        imgW = img.naturalWidth;
        imgH = img.naturalHeight;
      };
      img.src = this.opts.image;
    }

    let mx = 0;
    let my = 0;
    const onMove = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / Math.max(1, r.width);
      my = 1 - (e.clientY - r.top) / Math.max(1, r.height);
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
        u.f1("u_cell", (this.opts.cell ?? 7) * cappedDpr());
        u.f1("u_drift", this.opts.drift ?? 1);
        u.f2("u_mouse", mx, my);
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
      gl.deleteProgram(prog);
    };
    ctx.onDispose(onCleanup);
    this.cleanup = onCleanup;
  }

  private cleanup: () => void = () => {};

  /** DOM fallback: CPU-sampled static dot field, same scene semantics. */
  private mountFallback(): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    // Static ASCII-ish pre — a coarse print of the scene via a JS port of the
    // simplest scene: horizontal bands. Real scenes are WebGL-only; the
    // fallback keeps the page legible rather than empty.
    const pre = document.createElement("pre");
    pre.style.cssText =
      "position:absolute;inset:0;margin:0;overflow:hidden;pointer-events:none;" +
      "font:11px/1.15 ui-monospace,monospace;color:rgba(26,25,22,0.5);" +
      "user-select:none;white-space:pre;";
    const cols = 90;
    const rows = 24;
    let out = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const u = x / cols;
        const v = y / rows;
        // soft diagonal wash + vignette — a quiet print, not a simulation
        const t = 0.5 + 0.28 * Math.sin(u * 5.1) * Math.cos(v * 3.3) - 0.35 * Math.hypot(u - 0.5, v - 0.5);
        out += t > 0.72 ? "●" : t > 0.55 ? "⦁" : t > 0.4 ? "•" : t > 0.25 ? "∙" : t > 0.12 ? "·" : " ";
      }
      out += "\n";
    }
    pre.textContent = out;
    pre.setAttribute("aria-hidden", "true");
    host.appendChild(pre);
    this.cleanup = () => pre.remove();
  }

  /** Re-compose the printed image live: [cx, cy, zoom] (scroll morphs). */
  setCrop(crop: [number, number, number]): void {
    this.crop = crop;
  }

  /** Re-register the halftone screen live: cell size in CSS px. */
  setCell(px: number): void {
    this.opts.cell = px;
  }

  /** Drive the print directly (scroll velocity, audio…), overriding the
   *  constructor's drive callback for this frame and on. */
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
