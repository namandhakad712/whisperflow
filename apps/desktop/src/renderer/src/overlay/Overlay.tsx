import { useCallback, useEffect, useRef, useState } from "react";
import type { DictationStateEvent } from "@whisperflow/shared";
import { startCapture, type Capture } from "./capture";

const BAR_COUNT = 28;
const BAR_HISTORY_MS = 28;

/**
 * The dictation surface — rebuilt 1:1 from the reference app's compiled CSS
 * (extracted verbatim from its shipped status-window bundle; every value
 * below is theirs, sources noted inline).
 *
 *   rest  → 30×6 dash, rgba(0,0,0,.5) bg, hsla(0,0%,100%,.5) border
 *   mini  → 416×48, radius 16, #1f1f1f, 1.5px #30302f border,
 *           shadow 0 8px 32px rgba(0,0,0,.38)
 *   card  → 416×80, column content, status line with a 6×6 #10b981 dot
 *   l4    → 416×322 (expanded transcript)
 * All morphs run on their exact spring easing at 0.42s.
 */
// Root pill morph curve (reference status bundle @665034) — drives the
// 0.42s width/height/border-radius morphs below.
const SPRING_EASING =
  "linear(0, 0.005, 0.019 1.8%, 0.079 3.9%, 0.476 13.5%, 0.72 24%, 0.867 34%, 0.948 43.6%, 0.981 53.4%, 0.994 63.4%, 0.999 76%, 1)";
// Capsule curve is used by StatusBar.tsx (different bundle position — the
// status capsule at 0.2s).
const CAPSULE_SPRING_EASING =
  "linear(0, 0.0015, 0.0057 1.07%, 0.0214 2.13%, 0.0739 4.26%, 0.1638 6.93%, 0.479 15.46%, 0.5791 18.66%, 0.6512 21.32%, 0.7243, 0.784, 0.832 30.92%, 0.8757 34.65%, 0.9126 38.91%, 0.9418 43.71%, 0.9633 49.04%, 0.9781 54.9%, 0.9882 61.83%, 0.9948 70.89%, 0.9982 82.09%, 0.9997 99.68%)";

const PILL_CSS = `
:root { --spring-easing: ${SPRING_EASING}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; font-family: "Figtree", "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
body { font-feature-settings: "salt" on; }

.pill-zone { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 428px; height: 54px; display: flex; align-items: flex-end; justify-content: center; }
.pill-zone::after { content: ""; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 428px; height: 54px; background: rgba(0, 0, 0, 0.004); }

/* The card — their exact pill geometry. */
.pill-card {
  position: relative;
  width: 416px;
  height: 48px;
  border-radius: 16px;
  background: var(--pill-bg, #1f1f1f);
  border: 1.5px solid var(--pill-border, #30302f);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.38);
  transition:
    width 0.42s var(--spring-easing),
    height 0.42s var(--spring-easing),
    border-radius 0.42s var(--spring-easing),
    background-color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease,
    opacity 0.3s ease;
  overflow: hidden;
}
.pill-card[data-state="card"] { height: 80px; }
.pill-card[data-state="l4"] { height: 322px; }
/* Their rest state — the pill collapses to a 30×6 dash (exact values). */
.pill-card[data-state="rest"] {
  width: 30px;
  height: 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  border-color: hsla(0, 0%, 100%, 0.5);
  box-shadow: none;
}
.pill-card:focus-visible { outline: 2px solid #10b981; outline-offset: 3px; }
/* Mini content row: flex, 8px gap, 12px side padding, single line. */
.mini-row {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  white-space: nowrap;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.08s ease;
}
.pill-card[data-state="mini"] .mini-row { opacity: 1; pointer-events: auto; transition: opacity 0.18s ease 0.1s; }
.pill-card[data-peek="true"] .mini-row { opacity: 0; }

/* Frosted avatar circle (their 24px, hsla white .15 + blur 8px). */
.avatar {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: hsla(0, 0%, 100%, 0.15);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fcfcfb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Live text: 15px/20px, weight 500, sand-50, single line with a right-edge
 * fade (their 20px mask). */
.live-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: clip;
  font-size: 15px;
  line-height: 20px;
  font-weight: 500;
  color: var(--pill-ink, #fcfcfb);
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 20px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 20px), transparent);
}
.live-text[data-multiline="true"] {
  white-space: normal;
  -webkit-mask-image: none;
  mask-image: none;
}

/* Meta (timer / WPM): 12px/18px, vast-500 #71716e. */
.meta {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 18px;
  color: #71716e;
  white-space: nowrap;
}

/* The record dot: 6×6, radius 2, their green #10b981. */
.rec-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: #10b981;
}
.rec-dot[data-pulsing="true"] { animation: rec-pulse 1.6s ease-in-out infinite; }
@keyframes rec-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* Card content: column, 16px/12px padding. */
.card-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 0;
  opacity: 0;
  transition: opacity 0.18s ease 0.1s;
}
.pill-card[data-state="card"] .card-content,
.pill-card[data-state="l4"] .card-content { display: flex; opacity: 1; }
.card-row { display: flex; align-items: center; gap: 8px; min-height: 48px; }
.status-line { display: flex; align-items: center; gap: 5px; font-size: 12px; line-height: 18px; color: #71716e; white-space: nowrap; min-width: 0; }

/* l4 transcript body (rules L65-L85). */
.pill-card[data-state="l4"] .l4-body {
  padding-top: 28px;
  transition: opacity 0.32s ease 0.12s;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #30302f transparent;
}
.l4-body::-webkit-scrollbar { width: 4px; }
.l4-body::-webkit-scrollbar-thumb { background: #30302f; border-radius: 2px; }
.l4-body { font-size: 12.5px; line-height: 18px; opacity: 0.92; }
.l4-body h1, .l4-body h2, .l4-body h3 { font-size: 13px; line-height: 18px; font-weight: 600; margin-bottom: 5px; }
.l4-body ul { padding-left: 17px; margin-bottom: 7px; }
.l4-body li::marker { color: #878683; }

/* Shimmer: their generating-text sweep, 90deg #6f6f76→#fff, 220% travel
 * (pillcss @541469). */
.shimmer {
  background-image: linear-gradient(90deg, #6f6f76 0%, #6f6f76 35%, #fff 50%, #6f6f76 65%, #6f6f76 100%);
  background-size: 220% 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-style: italic;
  letter-spacing: -0.01em;
  animation: shimmer-sweep 4s ease-in-out infinite;
}
@keyframes shimmer-sweep { from { background-position: 220% 0; } to { background-position: -220% 0; } }

/* Notification badge straddling the top-right (their #2a2a29/#343432 pill). */
.badge {
  position: absolute;
  top: -12px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #2a2a29;
  border: 1px solid #343432;
  color: #deddd7;
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  z-index: 3;
  transition: opacity 0.2s ease;
}
.pill-card[data-state="card"] .badge,
.pill-card[data-state="l4"] .badge { opacity: 0; transition: opacity 0.08s ease; }

/* Error text — their destructive-400 #f87171. */
.error-text { color: #f87171; }
`;

const STATE_LABEL: Record<DictationStateEvent["state"], string> = {
  idle: "Idle",
  listening: "Listening",
  transcribing: "Transcribing",
  polishing: "Polishing",
  injecting: "Typing",
  done: "Done",
  error: "Error",
  cancelled: "Cancelled",
};

/**
 * The floating dictation pill. Listens for engine state; captures the mic
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

  const readConfig = useCallback(async () => {
    const c = (await window.whisperflow.settings.get()) as {
      general?: {
        overlayBackdrop?: string;
        overlayTint?: string;
        overlayFollowSystemTheme?: boolean;
      };
      hotkey?: { pushToTalk?: string };
      audio?: { deviceId?: string };
    };
    // The mic the user picked in Audio settings (ref so capture reads the
    // freshest value without re-running this effect).
    micIdRef.current = c.audio?.deviceId && c.audio.deviceId !== "default" ? c.audio.deviceId : undefined;
    void micId;
    // Custom tint + OS theme sync: the pill recolors from config (their colors
    // stay the default). `prefers-color-scheme` is the OS theme signal.
    const follow = Boolean(c.general?.overlayFollowSystemTheme);
    const systemLight =
      follow && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;
    const tint = c.general?.overlayTint?.trim() || "";
    document.documentElement.style.setProperty("--pill-bg", tint || (systemLight ? "#fcfcfb" : "#1f1f1f"));
    document.documentElement.style.setProperty(
      "--pill-border",
      systemLight && !tint ? "rgba(0,0,0,0.1)" : "#30302f",
    );
    document.documentElement.style.setProperty("--pill-ink", systemLight && !tint ? "#1a1a1a" : "#fcfcfb");
    document.documentElement.style.setProperty("--pill-meta", systemLight && !tint ? "#71716e" : "#71716e");
  }, [micId]);

  // Click-through by default (like the reference overlay): the window ignores the
  // mouse so it never blocks the app underneath; we only make it interactive
  // while the pointer is over a real control.
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

  // Start/stop the mic with the state stream.
  useEffect(() => {
    const listening = event.state === "listening";
    if (listening && !captureRef.current && !startingRef.current) {
      startingRef.current = true;
      startCapture({
        deviceId: micIdRef.current,
        onChunk: (pcm) => window.whisperflow.capture.sendPcm(pcm),
        onLevel: () => {},
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

  // Recording timer (their meta column shows duration / WPM).
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

  if (event.state === "idle" || event.state === "cancelled") return null;

  const processing = event.state === "transcribing" || event.state === "polishing" || event.state === "injecting";
  const card = processing;
  // Their state machine: listening → mini; processing → card; long
  // transcripts get the 322px l4 expansion; done collapses back to the rest
  // dash (the window then hides — no "inserted!" debug text hangs around).
  const pillState =
    event.state === "done"
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
  const meta = recording ? `${minutes}:${seconds}` : typing ? "typing…" : "";

  const liveText =
    event.state === "listening"
      ? event.partial || (recording ? "" : "Press the hotkey and speak")
      : event.state === "error"
        ? event.error ?? "Something went wrong"
        : event.partial || `${STATE_LABEL[event.state]}…`;

  return (
    <>
      <style>{PILL_CSS}</style>
      <div className="pill-zone">
        <div className="pill-card" data-state={pillState} data-interactive="true">
          <div className="mini-row">
            {recording && <span className="rec-dot" data-pulsing="true" />}
            <span className="avatar">W</span>
            <p
              className={`live-text ${processing ? "shimmer" : ""} ${event.state === "error" ? "error-text" : ""}`}
              data-multiline={pillState === "l4"}
            >
              {liveText}
            </p>
            <span className="meta">{meta}</span>
          </div>
          <div className="card-content">
            <div className="card-row">
              {recording && <span className="rec-dot" data-pulsing="true" />}
              <span className="status-line">
                {STATE_LABEL[event.state]}
                {recording ? ` · ${minutes}:${seconds}` : ""}
              </span>
            </div>
            <div className="l4-body">
              <p
                className={`live-text ${processing && !event.partial ? "shimmer" : ""} ${event.state === "error" ? "error-text" : ""}`}
                data-multiline="true"
              >
                {liveText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
