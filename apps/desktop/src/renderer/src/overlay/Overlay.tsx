import { useCallback, useEffect, useRef, useState } from "react";
import type { DictationStateEvent } from "@whisperflow/shared";
import { startCapture, type Capture } from "./capture";

const BAR_COUNT = 28;
const BAR_HISTORY_MS = 28;

/**
 * The floating dictation pill. Listens for engine state; captures the mic
 * while `listening` and streams 16 kHz PCM to the main process.
 */
export function Overlay() {
  const [event, setEvent] = useState<DictationStateEvent>({ state: "idle" });
  const [backdrop, setBackdrop] = useState<string>("");
  const [shape, setShape] = useState<"pill" | "rect" | "blob">("pill");
  const [recording, setRecording] = useState(false);
  const [hotkeyHint, setHotkeyHint] = useState("the hotkey");
  const captureRef = useRef<Capture | null>(null);
  const startingRef = useRef(false);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.04));

  const readConfig = useCallback(async () => {
    const c = (await window.whisperflow.settings.get()) as {
      general?: { overlayBackdrop?: string; overlayStyle?: "pill" | "rect" | "blob" };
      hotkey?: { pushToTalk?: string };
    };
    setBackdrop(c.general?.overlayBackdrop ?? "");
    setShape(c.general?.overlayStyle ?? "pill");
    if (c.hotkey?.pushToTalk) {
      setHotkeyHint(
        c.hotkey.pushToTalk
          .split("+")
          .map((p) => (p === "Control" ? "Ctrl" : p === "Space" ? "Space" : p))
          .join("+"),
      );
    }
  }, []);

  useEffect(() => {
    const unsub = window.whisperflow.dictation.onState((ev) => {
      setEvent(ev);
      setRecording(Boolean(ev.recording));
    });
    void readConfig();
    // Live: re-read config the moment it changes in the settings window.
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
        onChunk: (pcm) => window.whisperflow.capture.sendPcm(pcm),
        onLevel: (rms) => {
          levelsRef.current.push(Math.min(1, rms * 6));
          if (levelsRef.current.length > BAR_COUNT) levelsRef.current.shift();
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

  // Waveform animation: reflect recent mic levels into the bars.
  useEffect(() => {
    if (event.state !== "listening") return;
    const timer = window.setInterval(() => {
      const levels = levelsRef.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barsRef.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(0.12, levels[Math.min(i, levels.length - 1)] ?? 0.04)})`;
      }
    }, BAR_HISTORY_MS);
    return () => window.clearInterval(timer);
  }, [event.state]);

  if (event.state === "idle" || event.state === "cancelled") return null;

  return (
    <div
      className={`mx-auto mt-2 w-[500px] select-none bg-gradient-to-r from-accent/40 via-line to-accent/25 p-[1px] shadow-[0_10px_44px_rgba(34,211,238,0.14)] ${
        shape === "blob" ? "rounded-[38px_24px_42px_20px]" : shape === "rect" ? "rounded-md" : "rounded-2xl"
      }`}
    >
      <div
        className={`relative overflow-hidden border border-line/70 bg-surface/92 p-4 backdrop-blur-xl ${
        shape === "blob" ? "rounded-[36px_22px_40px_18px]" : shape === "rect" ? "rounded-[5px]" : "rounded-[calc(1rem-1px)]"
      }`}
        style={backdrop ? { backgroundImage: `url(${backdrop})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {backdrop && <div className="absolute inset-0 bg-bg/70" aria-hidden="true" />}
        <div className="relative">
        <div className="flex items-center gap-3">
          <StatusDot state={event.state} />
          <p className="text-xs font-medium uppercase tracking-widest text-ink-dim">{label(event.state)}</p>
          {recording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> REC
            </span>
          )}
          <p className="text-[11px] text-ink-dim/70">press {hotkeyHint} again to finish</p>
          <button
            type="button"
            aria-label="Cancel dictation"
            onClick={() => void window.whisperflowExtras.dictation.cancel()}
            className="ml-auto rounded-md px-2 py-0.5 text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Esc ✕
          </button>
        </div>

        {event.state === "listening" && (
          <>
            <div className="mt-3 flex h-12 items-center justify-center gap-[5px]" aria-hidden="true">
              {Array.from({ length: BAR_COUNT }, (_, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    barsRef.current[i] = el;
                  }}
                  className="h-full w-[6px] origin-center rounded-full bg-accent/90 transition-transform duration-75"
                  style={{ transform: "scaleY(0.12)" }}
                />
              ))}
            </div>
            <p className="mt-2 line-clamp-2 min-h-[2.5rem] font-mono text-sm text-ink-dim">
              {event.partial || "Listening…"}
            </p>
          </>
        )}

        {(event.state === "transcribing" || event.state === "polishing" || event.state === "injecting") && (
          <div className="mt-4 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
            <p className="text-sm text-ink-dim">{label(event.state)}…</p>
            {event.partial && (
              <p className="ml-auto max-w-[55%] truncate font-mono text-xs text-ink-dim">{event.partial}</p>
            )}
          </div>
        )}

        {event.state === "done" && (
          <p className="mt-4 text-sm text-accent">✓ Text inserted</p>
        )}

        {event.state === "error" && (
          <p className="mt-4 line-clamp-3 text-sm text-red-400">{event.error ?? "Something went wrong"}</p>
        )}
        </div>
      </div>
    </div>
  );
}

function label(state: DictationStateEvent["state"]): string {
  switch (state) {
    case "listening":
      return "Listening";
    case "transcribing":
      return "Transcribing";
    case "polishing":
      return "Polishing";
    case "injecting":
      return "Typing";
    case "done":
      return "Done";
    case "error":
      return "Error";
    default:
      return state;
  }
}

function StatusDot({ state }: { state: DictationStateEvent["state"] }) {
  if (state === "error") {
    return <span className="h-2.5 w-2.5 rounded-full bg-red-400" />;
  }
  if (state === "done") {
    return <span className="h-2.5 w-2.5 rounded-full bg-accent" />;
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
    </span>
  );
}
