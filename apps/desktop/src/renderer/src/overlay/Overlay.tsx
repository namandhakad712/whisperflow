import { useEffect, useRef, useState } from "react";
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
  const captureRef = useRef<Capture | null>(null);
  const startingRef = useRef(false);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.04));

  useEffect(() => {
    const unsub = window.whisperflow.dictation.onState((ev) => setEvent(ev));
    return () => {
      unsub();
      captureRef.current?.stop();
      captureRef.current = null;
    };
  }, []);

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
    <div className="mx-auto mt-2 w-[500px] select-none rounded-2xl bg-gradient-to-r from-accent/40 via-line to-accent/25 p-[1px] shadow-[0_10px_44px_rgba(34,211,238,0.14)]">
      <div className="rounded-[calc(1rem-1px)] border border-line/70 bg-surface/92 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <StatusDot state={event.state} />
          <p className="text-xs font-medium uppercase tracking-widest text-ink-dim">{label(event.state)}</p>
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
