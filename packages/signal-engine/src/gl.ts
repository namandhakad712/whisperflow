/**
 * WebGL mini-harness for the Signal engines.
 * Owns context creation, program linking, a fullscreen quad and the render
 * loop with visibility/intersection gating. Written for WhisperFlow — no
 * third-party 3D framework, ~2 KB of runtime.
 */

export interface EngineContext {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  /** Register a cleanup that runs on dispose. */
  onDispose(fn: () => void): void;
}

export interface RenderFrame {
  time: number;
  dt: number;
}

export type FrameFn = (f: RenderFrame) => void;

export interface LoopOptions {
  /** Called every visible frame. Return false to keep running, true when done (unused by engines). */
  frame: FrameFn;
  /** Reduced-motion: engines render a single static frame instead of animating. */
  reducedMotion?: boolean;
}

export function reducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export class GLLoop {
  private raf = 0;
  private running = false;
  private start = 0;
  private last = 0;
  private visible = true;
  private disposed = false;

  constructor(private opts: LoopOptions) {}

  startLoop(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.start = performance.now();
    this.last = this.start;

    if (this.opts.reducedMotion || reducedMotion()) {
      // static frame — engines must still show something meaningful
      this.opts.frame({ time: 1.2, dt: 16 });
      return;
    }

    const tick = (now: number) => {
      if (!this.running) return;
      if (this.visible) {
        const dt = Math.min(64, now - this.last);
        this.opts.frame({ time: (now - this.start) / 1000, dt });
        this.last = now;
      } else {
        this.last = now;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);

    if (typeof document !== "undefined" && typeof document.hidden === "boolean") {
      const onVis = () => {
        this.visible = !document.hidden;
        if (this.visible) this.last = performance.now();
      };
      document.addEventListener("visibilitychange", onVis);
      this.optsCleanup.push(() => document.removeEventListener("visibilitychange", onVis));
    }
  }

  private optsCleanup: Array<() => void> = [];

  setVisible(v: boolean): void {
    this.visible = v;
  }

  stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.disposed = true;
    this.stopLoop();
    for (const fn of this.optsCleanup) fn();
    this.optsCleanup = [];
  }
}

export function createGL(canvas: HTMLCanvasElement): EngineContext | null {
  const gl = (canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  }) || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  if (!gl) return null;

  // fullscreen triangle strip
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const cleanups: Array<() => void> = [];
  return {
    gl,
    canvas,
    onDispose: (fn) => cleanups.push(fn),
  };
}

export function disposeContext(ctx: EngineContext): void {
  // canvas-specific cleanups are registered by callers via onDispose
  void ctx;
}

export function linkProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[signal-engine] shader compile failed:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[signal-engine] program link failed:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

export const FULLSCREEN_VERT = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** Uniform setter helper — resolves locations once. */
export class Uniforms {
  private locs = new Map<string, WebGLUniformLocation | null>();
  constructor(
    private gl: WebGLRenderingContext,
    private prog: WebGLProgram,
  ) {}
  loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) {
      this.locs.set(name, this.gl.getUniformLocation(this.prog, name));
    }
    return this.locs.get(name) ?? null;
  }
  f1(name: string, v: number): void {
    const l = this.loc(name);
    if (l) this.gl.uniform1f(l, v);
  }
  f2(name: string, x: number, y: number): void {
    const l = this.loc(name);
    if (l) this.gl.uniform2f(l, x, y);
  }
  f3(name: string, r: number, g: number, b: number): void {
    const l = this.loc(name);
    if (l) this.gl.uniform3f(l, r, g, b);
  }
  tex(name: string, texture: WebGLTexture, unit: number): void {
    const l = this.loc(name);
    if (!l) return;
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(l, unit);
  }
}

/** hex #rrggbb → [r,g,b] 0..1 */
export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Device pixel ratio, capped so integrated GPUs survive. */
export function cappedDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 1.5);
}
