/**
 * Lens window: "AI-edit the selected text". A small command bar that takes a
 * free-form instruction ("make it shorter", "translate to French", "fix the
 * tone"), runs the active polish engine, and pastes the result back over the
 * user's selection. Their `lens` action (default Ctrl+Win+Alt).
 */
import { useEffect, useRef, useState } from "react";

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden;
  font-family: "Figtree", "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.zone { position: absolute; inset: 0; display: flex; align-items: center; }
.card {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: #1f1f1f;
  border: 1.5px solid #30302f;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.count { flex: none; font-size: 12px; line-height: 18px; color: #71716e; white-space: nowrap; }
.dot { flex: none; width: 6px; height: 6px; border-radius: 2px; background: #878683; }
input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: #fcfcfb;
  font-size: 15px;
  line-height: 20px;
  font-weight: 500;
  font-family: inherit;
}
input::placeholder { color: #71716e; font-weight: 400; }
.hint { flex: none; font-size: 11px; color: #5b5b59; white-space: nowrap; }
.error { flex: 1; font-size: 13px; color: #f87171; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    if (!instruction.trim() || working) return;
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

  return (
    <>
      <style>{CSS}</style>
      <div className="zone">
        <div className="card">
          {error ? (
            <p className="error">{error}</p>
          ) : (
            <>
              <span className="dot" />
              {count !== null && <span className="count">{count} words</span>}
              <input
                ref={inputRef}
                placeholder={count === null ? "Select some text, then press the lens hotkey" : "Ask AI — 'make it shorter', 'translate', 'fix tone'…"}
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
