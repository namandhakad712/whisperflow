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
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const micIdRef = useRef<string | undefined>(undefined);
  const [hotkeyHint, setHotkeyHint] = useState("the hotkey");
  const captureRef = useRef<Capture | null>(null);
  const startingRef = useRef(false);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.04));

  const readConfig = useCallback(async () => {
    const c = (await window.whisperflow.settings.get()) as {
      general?: { overlayBackdrop?: string; overlayStyle?: "pill" | "rect" | "blob" };
      hotkey?: { pushToTalk?: string };
      audio?: { deviceId?: string };
    };
    setBackdrop(c.general?.overlayBackdrop ?? "");
    setShape(c.general?.overlayStyle ?? "pill");
    // The mic the user picked in Audio settings (ref so capture reads the
    // freshest value without re-running this effect).
    micIdRef.current = c.audio?.deviceId && c.audio.deviceId !== "default" ? c.audio.deviceId : undefined;
    if (c.hotkey?.pushToTalk) {
      setHotkeyHint(
        c.hotkey.pushToTalk
          .split("+")
          .map((p) => (p === "Control" ? "Ctrl" : p === "Space" ? "Space" : p))
          .join("+"),
      );
    }
  }, []);

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
      // Typing-hold: the user typed mid-dictation. Show it briefly so they know
      // the session is deliberately still live.
      if (ev.typing) {
        setTyping(true);
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 1600);
      }
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
        deviceId: micIdRef.current,
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

  // Reference design language, extracted from the shipped app: a 500×420 dark
  // panel (vast-950 #1a1a1a) with warm-neutral text (sand-50 #fcfcfb), white
  // accent, and the live transcript as the dominant element.
  return (
    <div
      className={`flex h-full w-full select-none p-3 ${
        shape === "blob" ? "rounded-[38px_24px_42px_20px]" : shape === "rect" ? "rounded-lg" : "rounded-[26px]"
      }`}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden border border-[#46454499] bg-[#1a1a1a] shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${
          shape === "blob" ? "rounded-[34px_20px_38px_18px]" : shape === "rect" ? "rounded-[6px]" : "rounded-[23px]"
        }`}
        style={
          backdrop
            ? { backgroundImage: `url(${backdrop})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {backdrop && <div className="absolute inset-0 bg-[#1a1a1a]/75" aria-hidden="true" />}

        {/* header: status + recorder chip + cancel */}
        <div className="relative flex items-center gap-3 px-5 pt-4">
          <StatusDot state={event.state} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fcfcfb]">
            {label(event.state)}
          </p>
          {recording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> REC
            </span>
          )}
          {typing && (
            <span className="rounded-full bg-[#fcfcfb10] px-2 py-0.5 text-[10px] font-medium text-[#c5c0b3]">
              ⌨ typing — dictation held
            </span>
          )}
          <button
            type="button"
            aria-label="Cancel dictation"
            data-interactive="true"
            onClick={() => void window.whisperflowExtras.dictation.cancel()}
            className="ml-auto rounded-md px-2 py-0.5 text-xs text-[#a39d8e] transition-colors hover:bg-[#fcfcfb12] hover:text-[#fcfcfb]"
          >
            Esc ✕
          </button>
        </div>

        {/* transcript — the hero element, like the reference app's panel */}
        <div className="relative flex min-h-0 flex-1 flex-col justify-center px-6">
          {event.state === "listening" && (
            <>
              <p className="line-clamp-4 min-h-[6.5rem] text-pretty text-[19px] leading-relaxed font-medium text-[#fcfcfb]">
                {event.partial || <span className="text-[#a39d8e]">Listening…</span>}
              </p>
              <div className="mt-4 flex h-10 items-center gap-[5px]" aria-hidden="true">
                {Array.from({ length: BAR_COUNT }, (_, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      barsRef.current[i] = el;
                    }}
                    className="h-full w-[5px] origin-center rounded-full bg-[#fcfcfb] opacity-90 transition-transform duration-75"
                    style={{ transform: "scaleY(0.12)" }}
                  />
                ))}
              </div>
            </>
          )}

          {(event.state === "transcribing" || event.state === "polishing" || event.state === "injecting") && (
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#464544] border-t-[#fcfcfb]" />
              <p className="text-sm text-[#c5c0b3]">{label(event.state)}…</p>
              {event.partial && (
                <p className="ml-auto max-w-[55%] truncate font-mono text-xs text-[#a39d8e]">
                  {event.partial}
                </p>
              )}
            </div>
          )}

          {event.state === "done" && (
            <p className="text-[19px] font-medium text-[#fcfcfb]">✓ Text inserted</p>
          )}

          {event.state === "error" && (
            <p className="line-clamp-3 text-sm text-red-400">{event.error ?? "Something went wrong"}</p>
          )}
        </div>

        {/* footer hint */}
        <div className="relative px-5 pb-4">
          <p className="text-[11px] text-[#736e62]">press {hotkeyHint} again to finish</p>
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
    return <span className="h-2.5 w-2.5 rounded-full bg-[#fcfcfb]" />;
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fcfcfb] opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#fcfcfb]" />
    </span>
  );
}
