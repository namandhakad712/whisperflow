/**
 * ENGINE G — InkBloom: the voice, printed.
 *
 * A halftone dot field that rises with the voice. Where the reference
 * (Voice Glow, libraries.dev — studied Nov 2026, technique lineage in
 * INSPIRATION.md, nothing installed) scatters glowing RGB pixels, we
 * print: dots of ACCENT INK whose radius follows the envelope, laid on a
 * bayer grid so the field reads as a halftone, not confetti. Louder =
 * bigger dots climbing higher. When the model thinks, a sweep travels
 * the field like a press roller passing over the sheet.
 *
 * Everything lives in Canvas2D: no shaders, no deps, ~3KB. It is fed
 * `drive()` (0..1 voice level) and `setMood()` (calm / intent / bright /
 * urgent — an "emotion print" derived from the audio's spectral tilt in
 * the overlay; each mood tunes the ink mix and rise). Reduced motion
 * renders a static settled field.
 */

import { reducedMotion } from "./gl";

export type InkMood = "calm" | "intent" | "bright" | "urgent";

export interface InkBloomOptions {
  /** Accent ink hex (the theme's print accent). */
  ink: string;
  /** Paper hex for dark-on-light moods (default transparent → ink only). */
  paper?: string;
  /** Mood tunes dot mix, rise height and sweep speed. */
  mood?: InkMood;
  /** Dot grid cell in CSS px (default 5). */
  cell?: number;
}

interface MoodSpec {
  rise: number; // fraction of height the quiet field reaches
  mix: number; // 0 = pure accent, 1 = paper-tinted dots
  sweep: number; // sweep cycles per second while thinking
  shimmer: number; // idle dot shimmer amplitude
}

const MOODS: Record<InkMood, MoodSpec> = {
  calm: { rise: 0.22, mix: 0.45, sweep: 0.30, shimmer: 0.05 },
  intent: { rise: 0.30, mix: 0.25, sweep: 0.45, shimmer: 0.08 },
  bright: { rise: 0.38, mix: 0.10, sweep: 0.60, shimmer: 0.11 },
  urgent: { rise: 0.46, mix: 0.0, sweep: 0.85, shimmer: 0.16 },
};

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class InkBloom {
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private disposed = false;
  private level = 0; // smoothed 0..1 voice level
  private rawLevel = 0;
  private mood: InkMood = "calm";
  private thinking = false;
  private sweepPos = 0;
  private t = 0;
  private io: IntersectionObserver | null = null;
  private visible = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: InkBloomOptions,
  ) {}

  /** Feed a voice level (0..1). Called from the audio loop, ~60/s. */
  drive(level: number): void {
    this.rawLevel = Math.max(0, Math.min(1, level));
  }

  setMood(mood: InkMood): void {
    this.mood = mood;
  }

  /** The thinking sweep: a roller passes over the field. */
  setThinking(on: boolean): void {
    this.thinking = on;
    if (on) this.sweepPos = 0;
  }

  setOptions(opts: InkBloomOptions): void {
    this.opts = opts;
  }

  mount(): void {
    if (this.disposed) return;
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) return;
    this.io = new IntersectionObserver(
      (e) => {
        this.visible = e[0]?.isIntersecting ?? true;
        if (this.visible && !this.raf) this.loop();
      },
      { threshold: 0.05 },
    );
    this.io.observe(this.canvas);
    this.loop();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.io?.disconnect();
  }

  private loop = () => {
    if (this.disposed) return;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - (this.lastT ?? now)) / 1000);
      this.lastT = now;
      this.t += dt;
      // envelope: attack fast, release slow — ink rises eagerly, settles like sediment
      this.level += (this.rawLevel - this.level) * (this.rawLevel > this.level ? 0.35 : 0.06);
      if (this.thinking) this.sweepPos = (this.sweepPos + dt * MOODS[this.mood].sweep) % 1;
      this.paint();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };

  private lastT: number | undefined;

  private paint(): void {
    const ctx = this.ctx;
    if (!ctx || !this.visible) return;
    const { ink, paper, cell = 5 } = this.opts;
    const spec = MOODS[this.mood];

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || 0;
    const h = this.canvas.clientHeight || 0;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (reducedMotion() && this.level < 0.02 && !this.thinking) {
      // static settled print: the quiet field, no shimmer
      this.field(ctx, w, h, cell, spec, 0, 0, 1);
      return;
    }

    this.field(ctx, w, h, cell, spec, this.t, this.level, this.sweepPos, this.thinking);
  }

  /** The halftone field. Row tone falls with height; the voice lifts the
   *  wavefront; the thinking sweep boosts a traveling band of dots. */
  private field(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cell: number,
    spec: MoodSpec,
    t: number,
    level: number,
    sweepPos: number,
    thinking = false,
  ): void {
    const { ink, paper } = this.opts;
    const [ir, ig, ib] = hexRgb(ink);
    const pr = paper ? hexRgb(paper)[0] : ir;
    const pg = paper ? hexRgb(paper)[1] : ig;
    const pb = paper ? hexRgb(paper)[2] : ib;
    const m = spec.mix;
    const R = Math.round(ir + (pr - ir) * m);
    const G = Math.round(ig + (pg - ig) * m);
    const B = Math.round(ib + (pb - ib) * m);
    const R2 = Math.round(ir + (pr - ir) * (1 - m) * 0.5);
    const G2 = Math.round(ig + (pg - ig) * (1 - m) * 0.5);
    const B2 = Math.round(ib + (pb - ib) * (1 - m) * 0.5);

    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    // the wavefront: quiet reach + voice lift, with a slow lateral sway so
    // the surface breathes even in silence
    const sway = Math.sin(t * 0.9) * 0.05 + Math.sin(t * 0.33 + 1.7) * 0.04;
    const reach = spec.rise + level * (0.9 - spec.rise) + sway * spec.shimmer * 8;

    for (let cy = 0; cy < rows; cy++) {
      const y = (cy + 0.5) * cell;
      const v = 1 - y / h; // height above the bottom edge (1 = top of canvas)
      if (v > reach) continue;
      const depth = v / Math.max(0.001, reach); // 0 at the base, 1 at the wavefront

      for (let cx = 0; cx < cols; cx++) {
        const x = (cx + 0.5) * cell;
        // tone pools at the base: full ink at v=0 (the bottom edge), airy
        // toward the wavefront — ink rises like a tide mark, not a flame
        let tone = Math.pow(1 - depth, 1.3) * 0.85;
        // bayer micro-variation so the crest is granular, not flat-topped
        const b = (BAYER4[cy & 3]![cx & 3]! + 0.5) / 16;
        tone *= 0.72 + 0.28 * b;
        // idle shimmer: a breath over the field
        tone += spec.shimmer * 0.5 * Math.sin(t * 2.1 + cx * 0.55 + cy * 0.4) * (1 - depth);
        // the thinking sweep: a press roller passing left→right
        let sweepBoost = 0;
        if (thinking) {
          const d = Math.abs(x / w - sweepPos);
          sweepBoost = Math.max(0, 1 - d * 9) * 0.5;
        }
        tone = Math.max(0, Math.min(1, tone + sweepBoost));

        // radius from tone — halftone discipline: radius IS the amplitude
        const radius = cell * 0.18 + tone * cell * 0.3;
        ctx.fillStyle = sweepBoost > 0.12 ? `rgb(${R2},${G2},${B2})` : `rgb(${R},${G},${B})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
