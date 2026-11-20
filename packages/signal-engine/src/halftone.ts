/**
 * ENGINE C — HalftoneReveal.
 * Images that develop from 45° halftone dots into full color — like a print
 * coming out of the developer tray. Driven by scroll-in or hover.
 */
import { HALFTONE_FRAG } from "./shaders";
import { FULLSCREEN_VERT, GLLoop, Uniforms, cappedDpr, createGL, linkProgram, reducedMotion } from "./gl";

export interface HalftoneOptions {
  /** Reveal driver: 0 fully dithered → 1 resolved. */
  reveal?: () => number;
  /** Reveal origin in uv (default center). */
  focus?: [number, number];
}

export class HalftoneReveal {
  private loop: GLLoop | null = null;
  private u: Uniforms | null = null;
  private io: IntersectionObserver | null = null;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private img: HTMLImageElement,
    private opts: HalftoneOptions = {},
  ) {}

  mount(): void {
    if (this.disposed) return;
    if (!this.img.complete || !this.img.naturalWidth) {
      this.img.addEventListener("load", () => this.mount(), { once: true });
      return;
    }
    const ctx = createGL(this.canvas);
    if (!ctx) {
      this.mountFallback();
      return;
    }
    const { gl } = ctx;
    const prog = linkProgram(gl, FULLSCREEN_VERT, HALFTONE_FRAG);
    if (!prog) {
      this.mountFallback();
      return;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(prog, "a_pos");
    gl.useProgram(prog);
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    this.u = new Uniforms(gl, prog);

    const focus = this.opts.focus ?? [0.5, 0.5];
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

    this.loop = new GLLoop({
      reducedMotion: reducedMotion(),
      frame: ({ time }) => {
        resize();
        const u = this.u!;
        u.f2("u_res", this.canvas.width, this.canvas.height);
        u.f2("u_img_res", this.img.naturalWidth, this.img.naturalHeight);
        u.f1("u_time", time);
        u.f1("u_reveal", this.opts.reveal?.() ?? 1);
        u.f2("u_focus", focus[0], focus[1]);
        u.tex("u_img", tex, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    });

    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((entries) => {
        this.loop?.setVisible(entries.some((e) => e.isIntersecting));
      });
      this.io.observe(this.canvas);
    }

    this.cleanup = () => {
      window.removeEventListener("resize", resize);
      this.io?.disconnect();
      gl.deleteBuffer(quad);
      gl.deleteTexture(tex);
      gl.deleteProgram(prog);
    };
    this.loop.startLoop();
  }

  private cleanup: () => void = () => {};

  /** Fallback: plain <img> (CSS halftone overlay handles the retro feel). */
  private mountFallback(): void {
    this.canvas.style.display = "none";
    this.img.style.opacity = "1";
    this.cleanup = () => {};
  }

  dispose(): void {
    this.disposed = true;
    this.loop?.dispose();
    this.cleanup();
  }
}
