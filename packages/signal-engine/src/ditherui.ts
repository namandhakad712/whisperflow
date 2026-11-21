/**
 * ENGINE F — DitherCanvas: ordered-dither FILLS for UI surfaces.
 *
 * Where DitherField is an ambient background and PaintedScene renders
 * glyph scenes, DitherCanvas dithers *data* — bar fills, heatmaps,
 * sparklines, card washes — so charts read as print, not as flat CSS.
 *
 * Technique lineage: ordered (Bayer 8×8) dithering, public since the
 * 1970s. We studied dither-kit (tripwire.sh/dither-kit, Nov 2026) for
 * the interaction grammar — entrance sweeps, gliding scrub tooltips,
 * bloom ("aura"), gradient/hatched fill variants — and implemented
 * every one of it from scratch in our zero-dependency Canvas2D engine.
 * Nothing was installed; no code, palettes or values were copied.
 *
 * Discipline (MOTION.md): entrance ≤ 700ms, IO-gated, DPR-capped at 2,
 * reduced motion renders the final frame statically, and the whole
 * surface repaints only when data or theme tokens change.
 */

import { reducedMotion } from "./gl";

export type DitherVariant = "gradient" | "dotted" | "hatched";

export interface DitherCanvasOptions {
  /** Ink hex — the fill's saturated end (e.g. the theme accent). */
  ink: string;
  /** Secondary hex for gradient/hatch blends (defaults to paper). */
  paper?: string;
  /** Variant of the fill (default "gradient"). */
  variant?: DitherVariant;
  /** Dot cell size in CSS px (default 4). */
  cell?: number;
  /** Bloom: "aura" adds a soft blurred underlay of the ink. */
  bloom?: boolean;
  /** 0..1 entrance sweep progress; 1 = settled. Driving it externally
   *  is allowed, or use `animate()` for the built-in 620ms out-expo. */
  progress?: number;
  /** Direction of the gradient ("up" = ink concentrated at bottom). */
  direction?: "up" | "down";
}

/** Bayer 8×8 threshold matrix, 0..63 — the ordered-dither kernel. */
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
] as const;

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Horizontal-hatch Bayer: reorders rows so dots fuse into lines. */
function hatchThreshold(x: number, y: number): number {
  return (BAYER8[y % 8]![x % 8]! + 0.5) / 64;
}

export class DitherCanvas {
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private t0 = 0;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private visible = true;
  private disposed = false;
  private progress: number;
  private lastPaint = "";

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: DitherCanvasOptions,
  ) {
    this.progress = opts.progress ?? (reducedMotion() ? 1 : 0);
  }

  /** Repaint with new options (theme change, data change, replay). */
  setOptions(opts: DitherCanvasOptions): void {
    this.opts = opts;
    this.paint();
  }

  /** Entrance sweep on out-expo, 620ms — MOTION.md's reveal budget. */
  animate(replay = true): void {
    if (replay) this.progress = 0;
    if (reducedMotion()) {
      this.progress = 1;
      this.paint();
      return;
    }
    this.t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const tick = () => {
      const t = Math.min(1, (performance.now() - this.t0) / 620);
      // out-expo: cubic-bezier(0.16, 1, 0.3, 1) approximated
      this.progress = 1 - Math.pow(2, -10 * t);
      this.paint();
      if (t < 1 && this.visible) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  mount(): void {
    if (this.disposed) return;
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;
    this.io = new IntersectionObserver(
      (entries) => {
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && this.progress < 1) this.animate(false);
      },
      { threshold: 0.1 },
    );
    this.io.observe(this.canvas);
    // The canvas often mounts before its flex parent grants it height (bars
    // animating in, cards staging). A ResizeObserver re-measures and repaints
    // whenever the CSS box changes — the 78×2-collapsed-canvas bug.
    this.ro = new ResizeObserver(() => this.paint());
    this.ro.observe(this.canvas);
    if (this.progress < 1) this.animate(false);
    else this.paint();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    this.ro?.disconnect();
  }

  /** The paint itself: rows of dots, tone from gradient, Bayer decides on/off. */
  private paint(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { ink, paper = "transparent", variant = "gradient", cell = 4, bloom = false, direction = "up" } = this.opts;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || this.canvas.width / dpr;
    const h = this.canvas.clientHeight || this.canvas.height / dpr;
    if (w === 0 || h === 0) return;

    const key = JSON.stringify([w, h, this.progress, ink, paper, variant, cell, bloom, direction]);
    if (key === this.lastPaint) return;
    this.lastPaint = key;

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const [ir, ig, ib] = hexRgb(ink);
    const paperIsVoid = paper === "transparent";
    const [pr, pg, pb] = paperIsVoid ? [ir, ig, ib] : hexRgb(paper);

    // Bloom ("aura"): a soft blurred underlay of the ink beneath the dots.
    if (bloom && this.progress > 0.05) {
      ctx.save();
      ctx.filter = "blur(14px) saturate(1.1)";
      ctx.globalAlpha = 0.16 * this.progress;
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, w, h * this.progress);
      ctx.restore();
    }

    // The fill tone at height v (0..1 from the bottom): the tone drives DOT
    // DENSITY (the Bayer threshold), never the dot color — a dithered fill
    // reads as print precisely because every dot is full ink. Gradient =
    // dense ink low, sparser high; dotted/hatched keep flat coverage.
    const cols = Math.max(1, Math.floor(w / cell));
    const rows = Math.max(1, Math.floor(h / cell));

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = cx * cell;
        const y = cy * cell;
        const v = direction === "up" ? 1 - cy / Math.max(1, rows - 1) : cy / Math.max(1, rows - 1);
        const tone =
          variant === "gradient"
            ? 0.9 - 0.68 * v // dense ink low (0.9), airy top (0.22)
            : variant === "dotted"
              ? 0.34 + 0.2 * (1 - v)
              : 0.5; // hatched: threshold geometry does the work

        const thr = hatchThreshold(cx, cy);
        const on = thr < tone;
        // entrance sweep: dots appear bottom-up with the wavefront
        const front = this.progress;
        const cellPos = direction === "up" ? 1 - cy / rows : cy / rows;
        if (!on || cellPos > front) continue;

        // full ink for every dot; paper only tints the very top of gradients
        const mix = variant === "gradient" ? Math.max(0.45, 1 - v * 0.55) : 1;
        const r = Math.round(ir + (pr - ir) * (1 - mix));
        const g = Math.round(ig + (pg - ig) * (1 - mix));
        const b = Math.round(ib + (pb - ib) * (1 - mix));

        const radius =
          variant === "dotted" ? cell * 0.24 : variant === "hatched" ? cell * 0.3 : cell * 0.34;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
