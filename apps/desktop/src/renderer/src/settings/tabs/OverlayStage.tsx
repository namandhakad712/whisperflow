import { useEffect, useRef, useState } from "react";
import { useSettings } from "../store";
import { Card, PageHeader } from "../../shared/ui";
import { SpotlightCard } from "../../shared/presskit";

/**
 * THE OVERLAY STAGE (v0.1.49) — a framed "desktop" where users finally
 * SEE the dictation capsule before ever pressing the hotkey. The capsule
 * here is a faithful CSS replica of overlay/Overlay.tsx (same geometry,
 * same morph easing, same InkBloom mood ring), driven by the SAME theme
 * tokens as the console — so it previews on every print. Chrome-framed
 * live previews were the standing pattern on the Nov-2026 design wall;
 * ours frames a press bed instead of a browser.
 */

type StageState = "rest" | "mini" | "card" | "l4";
type Mood = "calm" | "bright" | "storm";

const STATES: Array<{ id: StageState; label: string }> = [
  { id: "rest", label: "rest" },
  { id: "mini", label: "listening" },
  { id: "card", label: "printing" },
  { id: "l4", label: "transcript" },
];

const MOODS: Array<{ id: Mood; label: string }> = [
  { id: "calm", label: "calm ink" },
  { id: "bright", label: "bright ink" },
  { id: "storm", label: "storm ink" },
];

const SIM_TEXT =
  "the quick brown fox jumps over the lazy dog — and the press prints every word of it.";

export function OverlayStage() {
  const [state, setState] = useState<StageState>("mini");
  const [mood, setMood] = useState<Mood>("calm");
  const [live, setLive] = useState(true);
  const rafRef = useRef(0);
  const traceRef = useRef<HTMLCanvasElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);

  // simulated voice trace: a gentle waveform when "listening"
  useEffect(() => {
    const canvas = traceRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const accentOf = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#5CE1A9";

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      t += 0.016;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const accent = accentOf();
      const amp = state === "mini" && live ? 1 : 0.12;
      // the phosphor trace: a rolling wave + level swell
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const env = 0.55 + 0.45 * Math.sin(t * 1.7 + x * 0.012);
        const y =
          h / 2 +
          Math.sin(x * 0.09 + t * 5.2) * (h * 0.34) * env * amp +
          Math.sin(x * 0.023 + t * 1.3) * (h * 0.14) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // afterglow
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (!reduced) rafRef.current = requestAnimationFrame(tick);
    else {
      // static line for reduced motion
      ctx.strokeStyle = accentOf();
      ctx.beginPath();
      ctx.moveTo(0, canvas.clientHeight / 2);
      ctx.lineTo(canvas.clientWidth, canvas.clientHeight / 2);
      ctx.stroke();
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [state, live]);

  // InkBloom mood ring: hue-shifted radial ink at the capsule's base
  const bloomHue =
    mood === "calm" ? "var(--color-accent)" : mood === "bright" ? "var(--color-amber)" : "var(--color-violet)";

  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            the overlay, live
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            A faithful rehearsal on this theme — exactly what appears over your apps when you hold the hotkey.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          className="stage-btn"
          aria-pressed={live}
        >
          {live ? "voice: on" : "voice: off"}
        </button>
      </div>

      <div className="stage-frame">
        <div className="stage-chrome" aria-hidden="true">
          <i />
          <i />
          <i />
          <span>your desktop — the capsule floats here</span>
        </div>
        <div className="stage-floor">
          {/* the capsule replica — geometry + easing match Overlay.tsx */}
          <div
            className="stage-capsule"
            data-state={state}
            style={{ "--bloom-hue": bloomHue } as React.CSSProperties}
          >
            {state !== "rest" && (
              <span className="stage-capsule-bloom" ref={bloomRef} aria-hidden="true">
                <span className="bloom-ring r1" />
                <span className="bloom-ring r2" />
                <span className="bloom-ring r3" />
              </span>
            )}
            {state === "mini" && (
              <span className="stage-mini-row">
                <span className="stage-led" data-on="live" aria-hidden="true" />
                <canvas ref={traceRef} className="stage-trace" aria-hidden="true" />
                <span className="stage-meta">00:07</span>
              </span>
            )}
            {state === "card" && (
              <span className="stage-card-body">
                <span className="stage-status">
                  <span className="stage-led" data-on="busy" aria-hidden="true" />
                  printing
                </span>
                <span className="stage-text">{SIM_TEXT.slice(0, 44)}…</span>
              </span>
            )}
            {state === "l4" && (
              <span className="stage-card-body">
                <span className="stage-status">
                  <span className="stage-led" data-on="live" aria-hidden="true" />
                  transcript · 00:12
                </span>
                <span className="stage-scroll">
                  <p className="stage-para">{SIM_TEXT}</p>
                  <p className="stage-para stage-dim">{SIM_TEXT}</p>
                  <p className="stage-para">{SIM_TEXT}</p>
                </span>
                <span className="stage-actions">
                  <i className="stage-key">copy</i>
                  <i className="stage-key">esc</i>
                </span>
              </span>
            )}
            {state === "rest" && <span className="stage-pip" aria-hidden="true" />}
          </div>
        </div>
        <div className="stage-controls">
          {STATES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`stage-btn ${state === s.id ? "on" : ""}`}
              onClick={() => setState(s.id)}
              aria-pressed={state === s.id}
            >
              {s.label}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`stage-btn ${mood === m.id ? "on" : ""}`}
              onClick={() => setMood(m.id)}
              aria-pressed={mood === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** Local import guard: SpotlightCard kept for future stage variants. */
export const _StageSpotlight = SpotlightCard;
