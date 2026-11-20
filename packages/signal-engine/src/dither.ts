/**
 * ENGINE A — DitherField.
 * A full-viewport ordered-dither canvas that breathes like tape hiss and
 * hears the cursor. Dark (Lab) and light (Daylight) palettes derived from
 * the Signal Standard tokens.
 *
 * Canvas2D fallback: paints a static Bayer 4x4 pattern at quarter
 * resolution — same feeling, zero WebGL.
 */
import { DITHER_FRAG } from "./shaders";
import { FULLSCREEN_VERT, GLLoop, Uniforms, cappedDpr, createGL, hexRgb, linkProgram, reducedMotion } from "./gl";

export interface DitherPalette {
  paper: string;
  ink: string;
  glow: string;
}

export const DITHER_PALETTES = {
  dark: { paper: "#0A0B0D", ink: "#13161A", glow: "#1C4234" },
  light: { paper: "#F4F2EC", ink: "#D9D5C9", glow: "#9CC7B4" },
} satisfies Record<string, DitherPalette>;

export interface DitherFieldOptions {
  palette?: DitherPalette;
  /** Cell size in CSS px (default 5). */
  cell?: number;
  /** External amplitude drive 0..1 — audio level, scroll velocity… */
  drive?: () => number;
}

export class DitherField {
  private loop: GLLoop | null = null;
  private u: Uniforms | null = null;
  private mouse: [number, number] = [0, 0];
  private dpr = 1;
  private smoothDrive = 0;
  private io: IntersectionObserver | null = null;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: DitherFieldOptions = {},
  ) {}

  mount(): void {
    if (this.disposed) return;
    const reduced = reducedMotion();
    const palette = this.opts.palette ?? DITHER_PALETTES.dark;
    const ctx = createGL(this.canvas);
    if (!ctx) {
      this.mountCanvas2d(palette);
      return;
    }
    const { gl } = ctx;
    const prog = linkProgram(gl, FULLSCREEN_VERT, DITHER_FRAG);
    if (!prog) {
      this.mountCanvas2d(palette);
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

    const paper = hexRgb(palette.paper);
    const ink = hexRgb(palette.ink);
    const glow = hexRgb(palette.glow);

    const resize = () => {
      this.dpr = cappedDpr();
      const w = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
      const h = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse = [(e.clientX - r.left) * this.dpr, (r.height - (e.clientY - r.top)) * this.dpr];
    };
    const onLeave = () => {
      this.mouse = [0, 0];
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    this.loop = new GLLoop({
      reducedMotion: reduced,
      frame: ({ time }) => {
        resize();
        const u = this.u!;
        u.f3("u_paper", ...paper);
        u.f3("u_ink", ...ink);
        u.f3("u_glow", ...glow);
        u.f2("u_res", this.canvas.width, this.canvas.height);
        u.f1("u_time", time);
        u.f2("u_mouse", this.mouse[0], this.mouse[1]);
        const target = this.opts.drive?.() ?? 0;
        // smooth the external drive so it never strobes
        this.smoothDrive += (target - this.smoothDrive) * 0.12;
        u.f1("u_breath", this.smoothDrive);
        u.f1("u_scale", (this.opts.cell ?? 5) * this.dpr);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    });

    // Only animate while on screen.
    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((entries) => {
        this.loop?.setVisible(entries.some((e) => e.isIntersecting));
      });
      this.io.observe(this.canvas);
    }

    this.cleanup = () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      this.io?.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
    this.loop.startLoop();
  }

  private cleanup: () => void = () => {};

  /** Static Bayer pattern fallback for no-WebGL environments. */
  private mountCanvas2d(palette: DitherPalette): void {
    const c2d = this.canvas.getContext("2d");
    if (!c2d) return;
    const draw = () => {
      const w = Math.max(1, Math.floor(this.canvas.clientWidth / 4));
      const h = Math.max(1, Math.floor(this.canvas.clientHeight / 4));
      this.canvas.width = w;
      this.canvas.height = h;
      const paper = hexRgb(palette.paper);
      const ink = hexRgb(palette.ink);
      const bayer = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
      ];
      const img = c2d.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = (bayer[y % 4]![x % 4]! + 0.5) / 16;
          const on = v < 0.42;
          const i = (y * w + x) * 4;
          const col = on ? ink : paper;
          img.data[i] = col[0] * 255;
          img.data[i + 1] = col[1] * 255;
          img.data[i + 2] = col[2] * 255;
          img.data[i + 3] = 255;
        }
      }
      c2d.putImageData(img, 0, 0);
    };
    draw();
    this.cleanup = () => {};
  }

  dispose(): void {
    this.disposed = true;
    this.loop?.dispose();
    this.cleanup();
  }
}
