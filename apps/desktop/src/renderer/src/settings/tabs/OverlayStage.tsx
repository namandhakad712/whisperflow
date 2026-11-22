import { useEffect, useRef, useState } from "react";
import { Card } from "../../shared/ui";

/**
 * THE OVERLAY STAGE v2 (v0.1.50) — a framed "desktop" where users see
 * the REAL thing before ever pressing the hotkey:
 *
 *   - the chrome bar shows the REAL machine: primary display resolution,
 *     scale factor, and the usable work area — the exact stage the
 *     overlay floats on (from AppHardware IPC, v0.1.50).
 *   - the mic trace is the REAL microphone (getUserMedia), not a
 *     simulated sine — press "test mic" and speak.
 *   - the capsule mirrors the REAL dictation state live: hold your
 *     hotkey anywhere and the stage plays along (rest/listening/
 *     printing/transcript), same geometry + scope easing as
 *     overlay/Overlay.tsx.
 *
 * The demo states (mood pads, the state buttons when idle) stay labeled
 * as rehearsals — honesty is part of the brand.
 */

type StageState = "rest" | "mini" | "card" | "l4";
type Mood = "calm" | "bright" | "storm";

const STATE_BUTTONS: Array<{ id: StageState; label: string }> = [
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

interface Hardware {
  cpu: string;
  cores: number;
  totalMemGb: number;
  tier: string;
  gpu: string;
  primaryDisplay: {
    label: string;
    sizePx: { w: number; h: number };
    scaleFactor: number;
    workArea: { x: number; y: number; w: number; h: number };
  };
}

export function OverlayStage() {
  const [demoState, setDemoState] = useState<StageState>("mini");
  const [mood, setMood] = useState<Mood>("calm");
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [hardware, setHardware] = useState<Hardware | null>(null);
  /** the REAL dictation state, mirrored live */
  const [liveState, setLiveState] = useState<string>("idle");
  const traceRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // real hardware + real dictation state
  useEffect(() => {
    void window.whisperflow.app.hardware().then(setHardware).catch(() => setHardware(null));
    return window.whisperflow.dictation.onState((ev) => setLiveState(ev.state));
  }, []);

  // when the real engine is mid-turn, the stage follows it automatically
  const busy = liveState !== "idle" && liveState !== "done" && liveState !== "cancelled" && liveState !== "error";
  const state: StageState = busy
    ? liveState === "listening"
      ? "mini"
      : "card"
    : demoState;
  const stateLabel = busy ? liveState : "rehearsal";

  // REAL mic: getUserMedia → AnalyserNode → the phosphor trace
  useEffect(() => {
    if (!micOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      void audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        analyserRef.current = analyser;
        setMicError(null);
      } catch (e) {
        setMicOn(false);
        setMicError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "mic permission denied — the overlay needs it to hear you"
            : "no mic available on this machine",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [micOn]);

  // the trace painter: real analyser data when mic on, gentle idle wave otherwise
  useEffect(() => {
    const canvas = traceRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let t = 0;
    const timeBuf = new Uint8Array(512);
    const freqBuf = new Uint8Array(512);
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
      const points: number[] = [];
      const analyser = analyserRef.current;
      if (analyser) {
        // REAL levels: time-domain wave, amplitude scaled by the band energy
        analyser.getByteTimeDomainData(timeBuf);
        analyser.getByteFrequencyData(freqBuf);
        let sum = 0;
        for (let i = 0; i < 256; i += 8) sum += freqBuf[i] ?? 0;
        const level = Math.min(1, sum / 32 / 160);
        for (let x = 0; x <= w; x += 2) {
          const idx = Math.floor((x / w) * 512);
          const sample = timeBuf[idx] ?? 128;
          const v = (sample - 128) / 128;
          points.push(h / 2 + v * (h * 0.44) * (0.4 + level));
        }
      } else {
        const amp = state === "mini" ? 1 : 0.12;
        for (let x = 0; x <= w; x += 2) {
          const env = 0.55 + 0.45 * Math.sin(t * 1.7 + x * 0.012);
          points.push(
            h / 2 +
              Math.sin(x * 0.09 + t * 5.2) * (h * 0.34) * env * amp +
              Math.sin(x * 0.023 + t * 1.3) * (h * 0.14) * amp,
          );
        }
      }
      ctx.beginPath();
      points.forEach((y, i) => (i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * 2, y)));
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (!reduced) rafRef.current = requestAnimationFrame(tick);
    else {
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
  }, [state]);

  // mic cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const bloomHue =
    mood === "calm" ? "var(--color-accent)" : mood === "bright" ? "var(--color-amber)" : "var(--color-violet)";

  const disp = hardware?.primaryDisplay;

  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            the overlay, live
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            The rehearsal matches the real capsule; hold your hotkey anywhere and it follows along.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMicOn((v) => !v)}
          className={`stage-btn ${micOn ? "on" : ""}`}
          aria-pressed={micOn}
        >
          {micOn ? "mic: live — speak" : "test mic"}
        </button>
      </div>

      <div className="stage-frame">
        <div className="stage-chrome" aria-hidden="true">
          <i />
          <i />
          <i />
          <span className="stage-chrome-spec">
            {disp
              ? `${disp.sizePx.w}×${disp.sizePx.h} · ${disp.scaleFactor}× · ${disp.label}`
              : "resolving display…"}
          </span>
          {micError && <em className="stage-chrome-err">{micError}</em>}
        </div>
        <div className="stage-floor">
          <div
            className="stage-capsule"
            data-state={state}
            style={{ "--bloom-hue": bloomHue } as React.CSSProperties}
          >
            {state !== "rest" && (
              <span className="stage-capsule-bloom" aria-hidden="true">
                <span className="bloom-ring r1" />
                <span className="bloom-ring r2" />
                <span className="bloom-ring r3" />
              </span>
            )}
            {state === "mini" && (
              <span className="stage-mini-row">
                <span className="stage-led" data-on={micOn ? "live" : "busy"} aria-hidden="true" />
                <canvas ref={traceRef} className="stage-trace" aria-hidden="true" />
                <span className="stage-meta">{micOn ? "live" : "00:07"}</span>
              </span>
            )}
            {state === "card" && (
              <span className="stage-card-body">
                <span className="stage-status">
                  <span className="stage-led" data-on={busy ? "busy" : "live"} aria-hidden="true" />
                  {busy ? liveState : "printing"}
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
          {STATE_BUTTONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`stage-btn ${!busy && demoState === s.id ? "on" : ""}`}
              onClick={() => setDemoState(s.id)}
              aria-pressed={!busy && demoState === s.id}
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
          <span className="stage-live-tag" data-busy={busy}>
            {stateLabel}
          </span>
        </div>
      </div>

      {/* the machine the press runs on — real specs, no placeholders */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-dim">
        {hardware ? (
          <>
            <span className="truncate" title={hardware.cpu}>
              cpu · {hardware.cpu.replace(/\s*\(.*\)/, "")} ×{hardware.cores}
            </span>
            <span>ram · {hardware.totalMemGb} gb</span>
            <span className="truncate" title={hardware.gpu}>
              gpu · {hardware.gpu}
            </span>
            {disp && (
              <span>
                work area · {disp.workArea.w}×{disp.workArea.h}
              </span>
            )}
            <span className="text-accent">tier · {hardware.tier}</span>
          </>
        ) : (
          <span>reading the machine…</span>
        )}
      </div>
    </Card>
  );
}
