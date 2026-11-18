/**
 * ENGINE B — AsciiRender.
 * The WhisperFlow mascot moment: an oscilloscope signal that IS text.
 * Scene pass draws a layered waveform to a framebuffer; post pass maps
 * cell luma to glyphs from an atlas built from our authored ramp.
 *
 * The glyph ramp is OURS: " .·:;=+x%#@" — chosen so low luma is whitespace,
 * mid luma reads as texture, peaks are dense blocks. CJK-safe subset.
 */
import { ASCII_POST_FRAG, ASCII_SCENE_FRAG } from "./shaders";
import { FULLSCREEN_VERT, GLLoop, Uniforms, cappedDpr, createGL, linkProgram, reducedMotion } from "./gl";

export const GLYPH_RAMP = " .·:;=+x%#@";

export interface AsciiRenderOptions {
  /** Column count across (default 96). */
  columns?: number;
  /** Text color (default #5CE1A9 phosphor). */
  color?: [number, number, number];
  /** External drive 0..1 — live mic level, demo amplitude. */
  drive?: () => number;
  /** Density drive 0..1 — glyph detail (hover/scroll). */
  density?: () => number;
}

/** Build the glyph atlas: one row texture, one glyph per slot. */
function buildAtlas(gl: WebGLRenderingContext, glyphs: string): WebGLTexture | null {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size * glyphs.length;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(size * 0.72)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < glyphs.length; i++) {
    ctx.fillText(glyphs[i]!, i * size + size / 2, size / 2 + 2);
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export class AsciiRender {
  private loop: GLLoop | null = null;
  private sceneU: Uniforms | null = null;
  private postU: Uniforms | null = null;
  private dpr = 1;
  private smoothDrive = 0;
  private smoothDensity = 0;
  private io: IntersectionObserver | null = null;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: AsciiRenderOptions = {},
  ) {}

  mount(): void {
    if (this.disposed) return;
    const ctx = createGL(this.canvas);
    if (!ctx) {
      this.mountFallback();
      return;
    }
    const { gl } = ctx;

    const sceneProg = linkProgram(gl, FULLSCREEN_VERT, ASCII_SCENE_FRAG);
    const postProg = linkProgram(gl, FULLSCREEN_VERT, ASCII_POST_FRAG);
    const atlas = sceneProg && postProg ? buildAtlas(gl, GLYPH_RAMP) : null;
    if (!sceneProg || !postProg || !atlas) {
      this.mountFallback();
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const bindQuad = (prog: WebGLProgram) => {
      gl.useProgram(prog);
      const attr = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    };

    // offscreen luma target for the scene pass
    const fb = gl.createFramebuffer();
    const fbTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.sceneU = new Uniforms(gl, sceneProg);
    this.postU = new Uniforms(gl, postProg);

    const resize = () => {
      this.dpr = cappedDpr();
      const w = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
      const h = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        gl.bindTexture(gl.TEXTURE_2D, fbTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    resize();
    window.addEventListener("resize", resize);

    const color = this.opts.color ?? [0.36, 0.88, 0.66];

    this.loop = new GLLoop({
      reducedMotion: reducedMotion(),
      frame: ({ time }) => {
        resize();
        const w = this.canvas.width;
        const h = this.canvas.height;

        // pass 1 — scene to framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, w, h);
        bindQuad(sceneProg);
        const su = this.sceneU!;
        su.f2("u_res", w, h);
        su.f1("u_time", time);
        this.smoothDrive += ((this.opts.drive?.() ?? 0) - this.smoothDrive) * 0.1;
        this.smoothDensity += ((this.opts.density?.() ?? 0) - this.smoothDensity) * 0.08;
        su.f1("u_drive", this.smoothDrive);
        su.f1("u_density", this.smoothDensity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // pass 2 — glyph post to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        bindQuad(postProg);
        const pu = this.postU!;
        pu.f2("u_res", w, h);
        pu.f1("u_cells", this.opts.columns ?? 96);
        pu.f1("u_glyphs", GLYPH_RAMP.length);
        pu.tex("u_scene", fbTex, 0);
        pu.tex("u_atlas", atlas, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        void color;
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
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(fbTex);
      gl.deleteTexture(atlas);
      gl.deleteProgram(sceneProg);
      gl.deleteProgram(postProg);
    };
    this.loop.startLoop();
  }

  private cleanup: () => void = () => {};

  /** DOM fallback: a static two-line ASCII waveform, still on-brand. */
  private mountFallback(): void {
    const el = this.canvas.parentElement;
    if (!el) return;
    const pre = document.createElement("pre");
    pre.className = "ascii-fallback";
    pre.setAttribute("aria-hidden", "true");
    const cols = 48;
    const line = (mid: number) =>
      Array.from({ length: cols }, (_, i) => {
        const t = i / cols;
        const env = Math.sin(t * Math.PI);
        const y = Math.sin(t * 10.5) * env;
        return Math.abs(y - mid) < 0.28 ? "%" : Math.abs(y) > 0.55 ? ":" : "·";
      }).join("");
    pre.textContent = `\n${line(0)}\n${line(0)}\n`;
    el.appendChild(pre);
    this.cleanup = () => pre.remove();
  }

  dispose(): void {
    this.disposed = true;
    this.loop?.dispose();
    this.cleanup();
  }
}
