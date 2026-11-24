/* ------------------------------------------------------------------ */
/* DayStrip — v0.1.52: the day plotted as a halftone strip.            */
/* v0.1.53: the press runs at three ranges — day, week, month.         */
/*                                                                    */
/* Each dictation lands as an ink dot whose radius grows with the     */
/* run's length — a print-shop densitometer reading of the day        */
/* (or week, or month). The ruler below marks the stations of the     */
/* current range; the elapsed span reads as a hairline. Hover a dot:   */
/* time, duration, first words. Canvas, dpr-aware, redraws on resize   */
/* + range change; the entrance press-in honors reduced motion.        */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";

export interface DayStripPoint {
  /** Unix epoch ms — when the run started. */
  at: number;
  /** Duration ms — drives the dot radius. */
  durationMs?: number;
  /** First words of the transcript, for the tooltip. */
  excerpt?: string;
}

export type DayStripRange = "day" | "week" | "month";

/** Range geometry: span ms, bucket count, stack stride for neighbors. */
const RANGES: Record<DayStripRange, { span: number; buckets: number; stride: number }> = {
  day: { span: 86_400_000, buckets: 24 * 60, stride: 2 },
  week: { span: 7 * 86_400_000, buckets: 7 * 24, stride: 2 },
  month: { span: 30 * 86_400_000, buckets: 30, stride: 2 },
};

/** Ruler station labels per range. */
function rulerLabels(range: DayStripRange): string[] {
  if (range === "day") return ["00", "06", "12", "18", "24"];
  if (range === "week") return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return ["01", "05", "10", "15", "20", "25", "30"];
}

export function DayStrip({
  points,
  range = "day",
  className = "",
}: {
  points: DayStripPoint[];
  range?: DayStripRange;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;

    const io = new IntersectionObserver((e) => {
      alive = e[0]?.isIntersecting ?? true;
      if (alive && !raf) raf = requestAnimationFrame(draw);
    });
    io.observe(canvas);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!raf) raf = requestAnimationFrame(draw);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const css = (name: string, fallback: string) =>
      getComputedStyle(canvas).getPropertyValue(name).trim() || fallback;

    /** Local-midnight start of the range window: day → today; week →
     * Monday of this week; month → the 1st. */
    const windowStart = (now: Date, r: DayStripRange) => {
      if (r === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (r === "week") {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dow = (d.getDay() + 6) % 7; // Monday = 0
        return d.getTime() - dow * 86_400_000;
      }
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    };

    function draw() {
      raf = 0;
      if (!alive || !canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (w === 0 || h === 0) return;

      const ink = css("--color-ink", "#1A1916");
      const inkFaint = css("--color-ink-faint", "#8D887B");
      const accent = css("--color-accent", "#0E7A55");

      const range = rangeRef.current;
      const geo = RANGES[range];
      const now = new Date();
      const start = windowStart(now, range);
      const elapsed = Math.min(Math.max(now.getTime() - start, 0), geo.span);

      // the paper progress rule: the window elapses as a hairline
      ctx.fillStyle = inkFaint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, h - 14, (elapsed / geo.span) * w, 1);
      ctx.globalAlpha = 1;

      // ruler stations at the label positions
      const labels = rulerLabels(range);
      const n = labels.length;
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "center";
      for (let i = 0; i < n; i++) {
        const frac = n === 1 ? 0 : i / (n - 1);
        const x = frac * w;
        const major = i === 0 || i === n - 1 || (n > 4 && i % 2 === 0);
        ctx.fillStyle = inkFaint;
        ctx.globalAlpha = major ? 0.9 : 0.5;
        ctx.fillRect(x, h - 16, 1, major ? 5 : 3);
        ctx.globalAlpha = 0.8;
        ctx.fillText(labels[i]!, Math.min(Math.max(x, 12), w - 12), h - 2);
        ctx.globalAlpha = 1;
      }

      // runs as halftone dots, bucketed per range unit
      const seen = new Map<number, DayStripPoint[]>();
      for (const p of pointsRef.current) {
        if (p.at < start || p.at >= start + geo.span) continue;
        const key = Math.floor((p.at - start) / (geo.span / geo.buckets));
        const arr = seen.get(key) ?? [];
        arr.push(p);
        seen.set(key, arr);
      }

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t0 = reduced ? 0 : performance.now();
      let animating = false;

      const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
      const colW = w / geo.buckets;
      for (const [key, bucket] of seen) {
        if (key < 0 || key >= geo.buckets) continue;
        const cxBase = key * colW + colW / 2;
        bucket.forEach((p, i) => {
          const cx = cxBase + (i % 3) * geo.stride;
          const dur = (p.durationMs ?? 0) / 1000;
          const r = Math.min(3.2, 1.6 + Math.sqrt(dur) * 0.5);
          // entrance: dots press in over ~0.5s
          const phase = reduced ? 1 : Math.min(1, (performance.now() - t0) / 500);
          if (phase < 1) animating = true;
          const grow = easeOut(phase);
          const cy = h - 22 - r;
          ctx.fillStyle = p.durationMs !== undefined ? accent : ink;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0.4, r * grow), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }

      // hover tooltip: nearest bucket center within hit width
      const tip = tipRef.current;
      const hv = hoverRef.current;
      if (tip && hv) {
        let best: { p: DayStripPoint; x: number } | null = null;
        for (const [key, bucket] of seen) {
          const x = key * colW + colW / 2;
          if (Math.abs(x - hv.x) <= Math.max(8, colW / 2)) {
            const p = bucket[0];
            if (p) best = { p, x };
            break;
          }
        }
        if (best) {
          const d = new Date(best.p.at);
          const mm =
            range === "day"
              ? `${d.getHours()}`.padStart(2, "0") + ":" + `${d.getMinutes()}`.padStart(2, "0")
              : range === "week"
                ? `${["mon", "tue", "wed", "thu", "fri", "sat", "sun"][(d.getDay() + 6) % 7]} ${d.getHours()}`.padStart(2, "0") + "h"
                : `${d.getDate()}`.padStart(2, "0") + " " + `${d.getHours()}`.padStart(2, "0") + "h";
          const dur = best.p.durationMs ? ` · ${(best.p.durationMs / 1000).toFixed(0)}s` : "";
          tip.style.display = "block";
          tip.style.left = `${Math.min(Math.max(best.x, 70), w - 70)}px`;
          tip.textContent = `${mm}${dur} — ${best.p.excerpt ?? "run"}`;
        } else {
          tip.style.display = "none";
        }
      } else if (tip) {
        tip.style.display = "none";
      }

      if (!reduced && animating) raf = requestAnimationFrame(draw);
    }

    redrawRef.current = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      hoverRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onLeave = () => {
      hoverRef.current = null;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      redrawRef.current = null;
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // range change → immediate redraw + a fresh entrance
  useEffect(() => {
    const redraw = redrawRef.current;
    if (redraw) redraw();
  }, [range]);

  return (
    <div className={`pk-daystrip ${className}`}>
      <canvas ref={ref} className="pk-daystrip-canvas" aria-hidden="true" />
      <div ref={tipRef} className="pk-daystrip-tip" role="status" />
    </div>
  );
}
