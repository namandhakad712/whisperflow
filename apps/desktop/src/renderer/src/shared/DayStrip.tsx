/* ------------------------------------------------------------------ */
/* DayStrip — v0.1.52: the day plotted as a halftone strip.            */
/*                                                                    */
/* Each dictation lands as an ink dot whose radius grows with the     */
/* run's length — a print-shop densitometer reading of the day. The   */
/* ruler below marks 3-hour stations; today's elapsed span reads as   */
/* a hairline. Hover a dot: time, duration, first words. Canvas,     */
/* dpr-aware, redraws on resize; the entrance press-in honors        */
/* reduced motion.                                                     */
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

export function DayStrip({
  points,
  className = "",
}: {
  points: DayStripPoint[];
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;

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

    function draw() {
      raf = 0;
      if (!alive || !canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const ink = css("--color-ink", "#1A1916");
      const inkFaint = css("--color-ink-faint", "#8D887B");
      const accent = css("--color-accent", "#0E7A55");

      // day bounds: local midnight → next midnight
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const span = 86_400_000;
      const dayMs = Math.min(Math.max(now.getTime() - start, 0), span);

      // the paper progress rule: today elapses as a hairline under the ruler
      ctx.fillStyle = inkFaint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, h - 14, (dayMs / span) * w, 1);
      ctx.globalAlpha = 1;

      // hour stations every 3h; labels every 6h
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "center";
      for (let hh = 0; hh <= 24; hh += 3) {
        const x = (hh / 24) * w;
        ctx.fillStyle = inkFaint;
        ctx.globalAlpha = hh % 12 === 0 ? 0.9 : 0.5;
        ctx.fillRect(x, h - 16, 1, hh % 12 === 0 ? 5 : 3);
        ctx.globalAlpha = 0.8;
        if (hh % 6 === 0) {
          const label = hh === 24 ? "24" : `${hh}`.padStart(2, "0");
          ctx.fillText(label, Math.min(Math.max(x, 10), w - 10), h - 2);
        }
        ctx.globalAlpha = 1;
      }

      // runs as halftone dots, bucketed per minute; stacked neighbors ±4px
      const seen = new Map<string, DayStripPoint[]>();
      for (const p of pointsRef.current) {
        const key = String(Math.round((p.at - start) / 60_000));
        const arr = seen.get(key) ?? [];
        arr.push(p);
        seen.set(key, arr);
      }

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t0 = reduced ? 0 : performance.now();
      let animating = false;

      const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
      for (const [key, bucket] of seen) {
        const t = Number(key);
        if (t < 0 || t > 24 * 60) continue;
        const cx = (t / (24 * 60)) * w;
        bucket.forEach((p, i) => {
          const cx2 = cx + (i % 3) * 2;
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
          ctx.arc(cx2, cy - 0, Math.max(0.4, r * grow), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }

      // hover tooltip: nearest minute-bucket within 8px
      const tip = tipRef.current;
      const hv = hoverRef.current;
      if (tip && hv) {
        let best: { p: DayStripPoint; x: number } | null = null;
        for (const [key, bucket] of seen) {
          const x = (Number(key) / (24 * 60)) * w;
          if (Math.abs(x - hv.x) <= 8) {
            const p = bucket[0];
            if (p) best = { p, x };
            break;
          }
        }
        if (best) {
          const d = new Date(best.p.at);
          const mm = `${d.getHours()}`.padStart(2, "0") + ":" + `${d.getMinutes()}`.padStart(2, "0");
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
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className={`pk-daystrip ${className}`}>
      <canvas ref={ref} className="pk-daystrip-canvas" aria-hidden="true" />
      <div ref={tipRef} className="pk-daystrip-tip" role="status" />
    </div>
  );
}
