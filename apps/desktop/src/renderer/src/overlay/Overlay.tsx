import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { DictationStateEvent } from "@whisperflow/shared";
import { startCapture, type Capture } from "./capture";

/**
 * The dictation surface — "the capsule". Signal Standard edition.
 *
 * Every geometry, color and timing below is AUTHORED for WhisperFlow
 * (see MOTION.md at the repo root). The previous build carried values
 * measured from another product's compiled CSS; that lineage is gone.
 *
 *   rest    → a 22×22 breathing phosphor dot (standby LED)
 *   mini    → 384×56 capsule: paper glass, hairline, phosphor trace
 *   card    → 384×88 (status row + transcript line)
 *   l4      → 384×336 (expanded transcript)
 *   morph   → 380ms cubic-bezier(0.7,0,0.2,1) — "scope" easing: quick in,
 *             slow settle, like a VU needle coming to rest
 */

const TRACE_POINTS = 56;

/** Authored morph curve — see MOTION.md "Envelopes". */
const SCOPE_EASING = "cubic-bezier(0.7, 0, 0.2, 1)";

const CAPSULE_CSS = `
:root { --scope-easing: ${SCOPE_EASING}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden;
  font-family: "Inter", "Space Grotesk", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

.capsule-zone { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%);
  width: 420px; height: 420px; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
.capsule-zone::after { content: ""; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 420px; height: 60px; background: rgba(0, 0, 0, 0.004); pointer-events: auto; }
body[data-align="top"] .capsule-zone { bottom: auto; top: 8px; align-items: flex-start; }
body[data-align="top"] .capsule-zone::after { bottom: auto; top: 0; }

/* ---- the capsule ---- */
.capsule {
  position: relative;
  width: 384px;
  height: 56px;
  border-radius: 14px;
  background: var(--cap-bg, rgba(17, 19, 24, 0.92));
  border: 1px solid var(--cap-border, rgba(237, 235, 228, 0.16));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(14px);
  transition:
    width 0.38s var(--scope-easing),
    height 0.38s var(--scope-easing),
    border-radius 0.38s var(--scope-easing),
    background-color 0.3s ease,
    border-color 0.3s ease,
    opacity 0.3s ease,
    box-shadow 0.3s ease;
  overflow: hidden;
  pointer-events: auto;
}
.capsule[data-state="card"] { height: 88px; }
.capsule[data-state="l4"] { height: 336px; }
/* rest = the standby LED: a breathing phosphor dot. */
.capsule[data-state="rest"] {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(17, 19, 24, 0.85);
  border-color: rgba(92, 225, 169, 0.35);
  animation: dot-breathe 3.2s ease-in-out infinite;
  cursor: pointer;
}
@keyframes dot-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(92, 225, 169, 0.0), inset 0 0 6px rgba(92, 225, 169, 0.3); }
  50% { box-shadow: 0 0 18px 2px rgba(92, 225, 169, 0.35), inset 0 0 10px rgba(92, 225, 169, 0.65); }
}
@media (prefers-reduced-motion: reduce) {
  .capsule[data-state="rest"] { animation: none; box-shadow: inset 0 0 8px rgba(92, 225, 169, 0.5); }
}
.capsule:focus-visible { outline: 2px solid #5CE1A9; outline-offset: 3px; }

/* the standby core: a 6px phosphor pip, visible on any desktop */
.capsule .standby-core {
  position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
}
.capsule[data-state="rest"] .standby-core { display: flex; }
.standby-core span {
  width: 6px; height: 6px; border-radius: 999px; background: #5CE1A9;
  box-shadow: 0 0 8px rgba(92, 225, 169, 0.9);
}

/* ---- mini row ---- */
.mini-row {
  position: absolute; inset: 0; display: flex; align-items: center; gap: 10px;
  padding: 0 14px; white-space: nowrap; overflow: hidden;
  opacity: 0; pointer-events: none; transition: opacity 0.08s ease;
}
.capsule[data-state="mini"] .mini-row { opacity: 1; pointer-events: auto; transition: opacity 0.16s ease 0.12s; }
.capsule[data-peek="true"] .mini-row { opacity: 0; }

/* mic glyph + drag handle */
.handle {
  flex: none; width: 26px; height: 26px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: var(--cap-ink, #EDEBE4); opacity: 0.7;
  cursor: grab; -webkit-app-region: drag;
}
.handle:active { cursor: grabbing; }

.live-text {
  flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: clip;
  font-size: 14.5px; line-height: 20px; font-weight: 500;
  color: var(--cap-ink, #EDEBE4);
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 18px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 18px), transparent);
}
.live-text[data-multiline="true"] { white-space: normal; -webkit-mask-image: none; mask-image: none; }

/* meta column — mono, tabular */
.meta {
  flex: none; display: inline-flex; align-items: center; gap: 8px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px; line-height: 18px; color: var(--cap-meta, rgba(237, 235, 228, 0.5));
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.meta .rec { width: 6px; height: 6px; border-radius: 2px; background: #5CE1A9; box-shadow: 0 0 6px rgba(92,225,169,0.8); }

/* typing indicator: three phosphor pips */
.typing-dots { display: inline-flex; align-items: center; gap: 2px; }
.typing-dots span {
  display: inline-block; width: 4px; height: 4px; border-radius: 50%;
  background: rgba(92, 225, 169, 0.8);
  animation: typing-bounce 1.4s ease-in-out infinite;
}
.typing-dots span:nth-child(1) { animation-delay: 0s; }
.typing-dots span:nth-child(2) { animation-delay: 0.18s; }
.typing-dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .typing-dots span { animation: none; } }

/* the phosphor trace: canvas, drawn by React (levels → polyline + afterglow) */
.trace { position: absolute; top: 10px; bottom: 10px; left: 46px; right: 92px; pointer-events: none; }
.trace canvas { width: 100%; height: 100%; display: block; }
.capsule:not([data-state="mini"]) .trace { display: none; }

/* ---- card content ---- */
.card-content {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  padding: 12px 14px; gap: 0; opacity: 0; transition: opacity 0.16s ease 0.12s;
}
.capsule[data-state="card"] .card-content,
.capsule[data-state="l4"] .card-content { display: flex; opacity: 1; }
.card-row { display: flex; align-items: center; gap: 8px; height: 34px; flex: none; }
.status-line {
  display: flex; align-items: center; gap: 7px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px; line-height: 18px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--cap-meta, rgba(237, 235, 228, 0.5)); white-space: nowrap; min-width: 0;
}
.status-line .rec { width: 6px; height: 6px; border-radius: 2px; background: #5CE1A9; box-shadow: 0 0 6px rgba(92,225,169,0.8); }

/* l4 transcript body */
.capsule[data-state="l4"] .l4-body { padding-top: 26px; transition: opacity 0.3s ease 0.12s; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: rgba(237,235,228,0.16) transparent; }
.l4-body::-webkit-scrollbar { width: 4px; }
.l4-body::-webkit-scrollbar-thumb { background: rgba(237,235,228,0.16); border-radius: 2px; }
.l4-body { font-size: 12.5px; line-height: 19px; opacity: 0.92; }
.l4-body h1, .l4-body h2, .l4-body h3 { font-size: 13px; line-height: 18px; font-weight: 600; margin-bottom: 5px; }
.l4-body ul { padding-left: 17px; margin-bottom: 7px; }
.l4-body li::marker { color: rgba(92, 225, 169, 0.6); }

/* the polish sweep styling: violet while the LLM works, phosphor on land. */
.sweep { font-style: normal; }
.sweep[data-phase="llm"] { color: #8F7BE8; }
.sweep[data-phase="done"] { color: #5CE1A9; }

/* error */
.error-text { color: #E86A5E; }

/* sequential counter tick */
.seq-tick { font-family: "JetBrains Mono", ui-monospace, monospace; color: #5CE1A9; }

/* ---- notification card (clipboard rescue) ---- */
.notification {
  position: absolute; left: 50%; bottom: 0; width: 384px; min-height: 190px; max-height: 190px;
  padding: 20px; background: rgba(17, 19, 24, 0.96); border-radius: 12px;
  border: 1px solid rgba(237, 235, 228, 0.16);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); backdrop-filter: blur(14px);
  display: flex; flex-direction: column; gap: 10px;
  transform: translate(-50%, 10px); opacity: 0;
  animation: notification-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
body[data-align="top"] .notification { bottom: auto; top: 0; }
@keyframes notification-in {
  from { transform: translate(-50%, 10px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
.notification h2 { font-size: 14px; font-weight: 600; color: #EDEBE4; }
.notification h2 .ok { color: #E8B84B; }
.notification p { font-size: 13px; line-height: 18px; color: rgba(237, 235, 228, 0.55); }
.notification kbd {
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px;
  padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(237, 235, 228, 0.18);
  background: rgba(22, 25, 31, 0.9); color: #EDEBE4;
}
`;

const TYPING_DOTS = (
  <span className="typing-dots" aria-label="typing">
    <span />
    <span />
    <span />
  </span>
);

const STATE_LABEL: Record<DictationStateEvent["state"], string> = {
  idle: "idle",
  listening: "listening",
  transcribing: "transcribing",
  polishing: "polishing",
  injecting: "typing",
  done: "done",
  error: "error",
  cancelled: "cancelled",
};

// Authored morph variants (framer-motion) — same geometry the CSS declares.
const capsuleVariants = {
  rest: { width: 22, height: 22, borderRadius: 999 },
  mini: { width: 384, height: 56, borderRadius: 14 },
  card: { width: 384, height: 88, borderRadius: 14 },
  l4: { width: 384, height: 336, borderRadius: 14 },
} as const;

const CAPSULE_TWEEN = { duration: 0.38, ease: [0.7, 0, 0.2, 1] as const } satisfies Record<string, unknown>;

/**
 * The floating dictation capsule. Listens for engine state; captures the mic
 * while `listening` and streams 16 kHz PCM to the main process.
 */
export function Overlay() {
  const [event, setEvent] = useState<DictationStateEvent>({ state: "idle" });
  const [micId] = useState<string | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const micIdRef = useRef<string | undefined>(undefined);
  const captureRef = useRef<Capture | null>(null);
  const startingRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  /** Mic levels for the phosphor trace. */
  const levelsRef = useRef<number[]>(new Array(TRACE_POINTS).fill(0.04));
  const traceRef = useRef<HTMLCanvasElement | null>(null);
  /** OS theme from main (matchMedia lags the OS in Electron). */
  const [systemDark, setSystemDark] = useState(true);
  /** Resting mode: main keeps the window alive between turns and tells the
   *  renderer to show the standby dot (click it to dictate, drag it to move). */
  const [resting, setResting] = useState(false);
  /** Hover over the standby dot morphs it to the mini capsule so the click
   *  target and drag handle are easy to hit. */
  const [hovered, setHovered] = useState(false);
  /** The hotkey hint shown on the resting capsule hover. */
  const [hotkey, setHotkey] = useState("");
  /** Sequential mode: finished utterances pasted so far (the "queued" meter). */
  const [pastedCount, setPastedCount] = useState(0);
  /** Latest finished utterance text (shown dimmed while the mic stays open). */
  const [lastPasted, setLastPasted] = useState("");

  useEffect(() => {
    void window.whisperflowExtras.system.theme().then((t) => setSystemDark(t.dark));
    const unsub = window.whisperflowExtras.system.onTheme((t) => setSystemDark(t.dark));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = window.whisperflowExtras.overlay.onRest((ev) => setResting(ev.resting));
    return unsub;
  }, []);

  // Which edge the overlay hangs from — top anchors grow downward.
  useEffect(() => {
    const unsub = window.whisperflowExtras.overlay.onAlign((ev) => {
      document.body.dataset["align"] = ev.edge;
    });
    return unsub;
  }, []);

  // Feedback chimes: main sends a data URL, we just play it. Skipped silently
  // when the Audio API is unavailable — never breaks a dictation.
  useEffect(() => {
    const unsub = window.whisperflowExtras.overlay.onSound((ev) => {
      try {
        const audio = new Audio(ev.dataUrl);
        audio.volume = 0.5;
        void audio.play().catch(() => {
          /* autoplay policy or teardown racing — the chime is optional */
        });
      } catch {
        /* no Audio API — optional feedback, never fatal */
      }
    });
    return unsub;
  }, []);

  const readConfig = useCallback(async () => {
    const c = (await window.whisperflow.settings.get()) as {
      general?: {
        overlayBackdrop?: string;
        overlayTint?: string;
        overlayFollowSystemTheme?: boolean;
        meetingMode?: boolean;
      };
      hotkey?: { pushToTalk?: string };
      audio?: { deviceId?: string };
    };
    // Meeting mode: the session captures SYSTEM audio (a hidden window), so
    // this renderer's mic capture must stay off — never both at once.
    setMeetingMode(Boolean(c.general?.meetingMode));
    // The mic the user picked in Audio settings (ref so capture reads the
    // freshest value without re-running this effect).
    micIdRef.current = c.audio?.deviceId && c.audio.deviceId !== "default" ? c.audio.deviceId : undefined;
    void micId;
    // Adaptive tint: the capsule recolors for light desktops and custom tints.
    const follow = Boolean(c.general?.overlayFollowSystemTheme);
    const systemLight = follow && !systemDark;
    const tint = c.general?.overlayTint?.trim() || "";
    const root = document.documentElement.style;
    root.setProperty("--cap-bg", tint || (systemLight ? "rgba(244, 242, 236, 0.94)" : "rgba(17, 19, 24, 0.92)"));
    root.setProperty("--cap-border", tint ? "rgba(0,0,0,0.1)" : systemLight ? "rgba(22,24,29,0.18)" : "rgba(237,235,228,0.16)");
    root.setProperty("--cap-ink", systemLight ? "#16181D" : "#EDEBE4");
    root.setProperty("--cap-meta", systemLight ? "rgba(22,24,29,0.5)" : "rgba(237,235,228,0.5)");
    // The hotkey hint for the hovered standby dot.
    setHotkey(c.hotkey?.pushToTalk ?? "");
  }, [micId, systemDark]);

  // Click-through by default: the window ignores the mouse so it never blocks
  // the app underneath; we only make it interactive while the pointer is over
  // a real control.
  useEffect(() => {
    let interactive = false;
    const report = (next: boolean) => {
      if (next === interactive) return;
      interactive = next;
      window.whisperflowExtras.overlay.setInteractive(next);
    };
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      report(Boolean(el?.closest("[data-interactive='true']")));
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      report(false);
    };
  }, []);

  useEffect(() => {
    const unsub = window.whisperflow.dictation.onState((ev) => {
      setEvent(ev);
      setRecording(Boolean(ev.recording));
      if (ev.recording) startedAtRef.current = Date.now();
      if (ev.state === "idle" || ev.state === "done" || ev.state === "cancelled") startedAtRef.current = null;
      // Sequential mode: a finished utterance arrives on `appendText` while
      // still listening — count it and remember its text for the meter.
      if (ev.appendText) {
        setPastedCount((n) => n + 1);
        setLastPasted(ev.appendText);
      } else if (ev.state !== "listening") {
        setPastedCount(0);
        setLastPasted("");
      }
      // Typing-hold: the user typed mid-dictation. Show it briefly so they know
      // the session is deliberately still live.
      if (ev.typing) {
        setTyping(true);
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 1600);
      }
    });
    void readConfig();
    const unsubSettings = window.whisperflowExtras.settings.onChanged(() => void readConfig());
    return () => {
      unsub();
      unsubSettings();
      captureRef.current?.stop();
      captureRef.current = null;
    };
  }, [readConfig]);

  // Start/stop the mic with the state stream. In meeting mode the SYSTEM audio
  // is captured instead (a hidden window feeds the session directly) — running
  // the mic too would interleave two sources into one audio stream.
  const [meetingMode, setMeetingMode] = useState(false);
  useEffect(() => {
    const listening = event.state === "listening";
    if (listening && !meetingMode && !captureRef.current && !startingRef.current) {
      startingRef.current = true;
      startCapture({
        deviceId: micIdRef.current,
        onChunk: (pcm) => window.whisperflow.capture.sendPcm(pcm),
        onLevel: (rms) => {
          levelsRef.current.push(Math.min(1, rms * 6));
          if (levelsRef.current.length > TRACE_POINTS) levelsRef.current.shift();
        },
      })
        .then((cap) => {
          captureRef.current = cap;
        })
        .catch((err) => {
          setEvent({ state: "error", error: `Microphone unavailable: ${String(err)}` });
        })
        .finally(() => {
          startingRef.current = false;
        });
    } else if (!listening && captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
  }, [event.state]);

  // Recording timer (mono meta shows duration).
  useEffect(() => {
    if (!recording) {
      setElapsed(0);
      return;
    }
    const timer = window.setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  /**
   * The phosphor trace: mic levels → a continuous polyline with afterglow
   * (previous frames fade ~12%/frame). Redrawn on rAF while listening.
   */
  useEffect(() => {
    if (event.state !== "listening") {
      levelsRef.current = new Array(TRACE_POINTS).fill(0.04);
      return;
    }
    const canvas = traceRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      // afterglow: fade previous frame instead of clearing
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.scale(dpr, dpr);
      // ASCII GLYPH WAVE — the signal printed as text, not a polyline.
      // Voice maps through the glyph ramp: silence = ":", speech = "#%@"
      // — the product made literally visible (voice → glyphs).
      const levels = levelsRef.current;
      const mid = h / 2;
      const RAMP = " .:=+x#@";
      const colW = 9;
      const cols = Math.max(8, Math.floor(w / colW));
      ctx.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let c = 0; c < cols; c++) {
        const i = Math.floor((c / Math.max(1, cols - 1)) * (levels.length - 1));
        const env = Math.sin((c / Math.max(1, cols - 1)) * Math.PI) ** 0.5; // edge fade
        const amp = Math.min(1, (levels[i] ?? 0.04) * 1.35 * env + 0.05);
        const glyph = RAMP[Math.min(RAMP.length - 1, Math.floor(amp * RAMP.length))] ?? "#";
        const x = (c + 0.5) * colW;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = amp > 0.55 ? "#8CFFC7" : "#5CE1A9";
        ctx.fillText(glyph, x, mid);
        if (amp > 0.3) {
          ctx.globalAlpha = 0.45;
          ctx.fillText(RAMP[Math.max(0, Math.floor(amp * RAMP.length) - 2)] ?? "+", x, mid - 13);
          ctx.fillText(RAMP[Math.max(0, Math.floor(amp * RAMP.length) - 2)] ?? "+", x, mid + 13);
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [event.state]);

  if (event.state === "idle" || event.state === "cancelled") return null;

  const processing = event.state === "transcribing" || event.state === "polishing" || event.state === "injecting";
  const card = processing;
  // The state machine: listening → mini; processing → card; long transcripts
  // get the 336px l4 expansion; done collapses back to the standby dot. In
  // rest mode the dot persists between turns; otherwise the window hides a
  // beat after done.
  const capState = resting
    ? hovered
      ? "mini"
      : "rest"
    : event.state === "done"
      ? "rest"
      : event.state === "listening"
        ? "mini"
        : card
          ? event.partial && event.partial.length > 60
            ? "l4"
            : "card"
          : "mini";

  const seconds = String(elapsed % 60).padStart(2, "0");
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const meta = recording ? `${minutes}:${seconds}` : null;
  /** The paste-failure notification shows only for the clipboard-fallback error. */
  const clipboardFallback =
    event.state === "error" && /clipboard/i.test(event.error ?? "");

  const liveText =
    event.state === "listening"
      ? // Once words arrive they take the space; until then "listening…" sits
        // under the trace (NOT "press the hotkey" — the user just did).
        event.partial || "listening…"
      : event.state === "error"
        ? event.error ?? "something went wrong"
        : event.partial || `${STATE_LABEL[event.state]}…`;

  return (
    <>
      <style>{CAPSULE_CSS}</style>
      <div className="capsule-zone">
        {!clipboardFallback && (
        <motion.div
          className="capsule"
          variants={capsuleVariants}
          animate={capState}
          transition={CAPSULE_TWEEN}
          data-state={capState}
          data-interactive="true"
          onMouseEnter={() => resting && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => {
            // The standby dot is a dictation button: click to start talking.
            // Never fires mid-dictation.
            if (resting) void window.whisperflow.dictation.start();
          }}
        >
          {/* the standby core — visible only in rest state */}
          <div className="standby-core" aria-hidden="true">
            <span />
          </div>

          {/* the phosphor trace: shows while listening and no words yet */}
          {event.state === "listening" && !event.partial && (
            <div className="trace" aria-hidden="true">
              <canvas ref={traceRef} />
            </div>
          )}

          <div className="mini-row">
            <span className="handle" role="img" aria-label="WhisperFlow (drag to move)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </span>
            <p
              className={`live-text ${processing ? "sweep" : ""} ${event.state === "error" ? "error-text" : ""}`}
              data-multiline={capState === "l4"}
              data-phase={event.state === "polishing" ? "llm" : event.state === "done" ? "done" : undefined}
            >
              {liveText}
            </p>
            {resting && hovered ? (
              <span className="meta">{hotkey ? `${hotkey} · or click` : "click to dictate"}</span>
            ) : typing && !recording ? (
              TYPING_DOTS
            ) : pastedCount > 0 ? (
              <span className="meta seq-tick" title={lastPasted} data-sequential="true">
                +{pastedCount}{lastPasted ? ` · ${lastPasted.slice(0, 22)}${lastPasted.length > 22 ? "…" : ""}` : ""}
              </span>
            ) : meta ? (
              <span className="meta">
                {recording && <span className="rec" aria-hidden="true" />}
                {meta}
              </span>
            ) : null}
          </div>

          <div className="card-content">
            <div className="card-row">
              <span className="status-line">
                {recording && <span className="rec" aria-hidden="true" />}
                {STATE_LABEL[event.state]}
                {recording ? ` · ${minutes}:${seconds}` : ""}
              </span>
            </div>
            <div className="l4-body">
              <p
                className={`live-text ${processing && !event.partial ? "sweep" : ""} ${event.state === "error" ? "error-text" : ""}`}
                data-multiline="true"
                data-phase={event.state === "polishing" ? "llm" : event.state === "done" ? "done" : undefined}
              >
                {liveText}
              </p>
            </div>
          </div>
        </motion.div>
        )}
      </div>
      {clipboardFallback && (
        /* When the paste couldn't land, say so with the clipboard rescue
         * instead of leaving the text stranded. */
        <div className="notification" data-interactive="true">
          <h2>
            <span className="ok">[!]</span> couldn't paste — text is on your clipboard
          </h2>
          <p>
            WhisperFlow tried to type your dictation into the focused window and it
            didn't land (some apps block synthetic input). The full text is on your
            clipboard right now — press <kbd>Ctrl</kbd>+<kbd>V</kbd> to put it there.
          </p>
        </div>
      )}
    </>
  );
}
