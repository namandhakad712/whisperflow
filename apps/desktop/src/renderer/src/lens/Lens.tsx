/**
 * Lens window: "AI-edit the selected text". Signal Standard edition — the
 * instrument readout: mono input, phosphor caret, LED status at left,
 * violet accents while the LLM works. All values authored — see MOTION.md.
 */
import { useEffect, useRef, useState } from "react";

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden;
  font-family: "Inter", "Space Grotesk", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.zone { position: absolute; inset: 0; display: flex; align-items: center; }
.card {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  background: rgba(17, 19, 24, 0.94);
  border: 1px solid rgba(237, 235, 228, 0.16);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
}
/* the LED: idle → live (selected) → busy (violet, LLM working) */
.led {
  flex: none; width: 7px; height: 7px; border-radius: 999px;
  background: rgba(237, 235, 228, 0.3);
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.led[data-on="live"] { background: #5CE1A9; box-shadow: 0 0 7px rgba(92, 225, 169, 0.75); }
.led[data-on="busy"] { background: #8F7BE8; box-shadow: 0 0 7px rgba(143, 123, 232, 0.75); animation: led-pulse 1.2s ease-in-out infinite; }
@keyframes led-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .led[data-on="busy"] { animation: none; } }

.count {
  flex: none;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px; line-height: 18px;
  color: rgba(237, 235, 228, 0.5);
  white-space: nowrap;
}
input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: #EDEBE4;
  caret-color: #5CE1A9;
  font-size: 14.5px;
  line-height: 20px;
  font-weight: 500;
  font-family: inherit;
}
input::placeholder { color: rgba(237, 235, 228, 0.4); font-weight: 400; }
.hint {
  flex: none;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 10.5px;
  color: rgba(237, 235, 228, 0.35);
  white-space: nowrap;
}
.error {
  flex: 1;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12.5px;
  color: #E86A5E;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;

interface LensTextEvent {
  text: string;
}

export function Lens() {
  const [count, setCount] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<string>("");

  useEffect(() => {
    const onText = (ev: LensTextEvent) => {
      textRef.current = ev.text;
      setCount(ev.text.trim().split(/\s+/).filter(Boolean).length);
      setError(null);
      setWorking(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    };
    const unsub = window.whisperflowExtras.lens.onText(onText);
    return unsub;
  }, []);

  const submit = (instruction: string) => {
    // Nothing was selected — there's no text to edit. The hint already says
    // what to do; submitting an edit against empty text would be a no-op at
    // best and a confusing paste at worst.
    if (!instruction.trim() || working || !textRef.current.trim()) return;
    setWorking(true);
    setError(null);
    window.whisperflowExtras.lens
      .submit(instruction.trim())
      .then(() => {
        setWorking(false);
        // The result is pasted over the selection by main; the window closes.
      })
      .catch((err: unknown) => {
        setWorking(false);
        setError(String(err).replace(/^Error:\s*/, "").slice(0, 90));
      });
  };

  const ledState = error ? "error" : working ? "busy" : count !== null && count > 0 ? "live" : "off";

  return (
    <>
      <style>{CSS}</style>
      <div className="zone">
        <div className="card">
          {error ? (
            <p className="error">[!] {error}</p>
          ) : (
            <>
              <span className="led" data-on={ledState} aria-hidden="true" />
              {count !== null && count > 0 && <span className="count">{count} words</span>}
              {count === 0 && <span className="count" style={{ color: "#E86A5E" }}>nothing selected</span>}
              <input
                ref={inputRef}
                placeholder={
                  count === null
                    ? "select some text, then press the lens hotkey"
                    : count === 0
                      ? "highlight the text to edit, then press the hotkey again"
                      : "ask — 'make it shorter', 'translate', 'fix tone'…"
                }
                disabled={working}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit((e.target as HTMLInputElement).value);
                  if (e.key === "Escape") window.whisperflowExtras.lens.dismiss();
                }}
              />
              <span className="hint">{working ? "working…" : "↵ edit · esc close"}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
