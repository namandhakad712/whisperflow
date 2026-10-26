import { useEffect, useState } from "react";
import { useSettings } from "../store";
import { Button, Card, Kbd, Row, SectionTitle, Toggle } from "../../shared/ui";

/** Turns a KeyboardEvent into an Electron accelerator string. */
function acceleratorFrom(e: KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null; // modifier alone
  let k: string | null = null;
  if (/^[a-z]$/i.test(key)) k = key.toUpperCase();
  else if (/^F\d{1,2}$/.test(key)) k = key;
  else if (key === " ") k = "Space";
  else if (/^Digit\d$/.test(key)) k = key.slice(5);
  if (!k) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(k);
  return parts.join("+");
}

export function ShortcutsTab() {
  const config = useSettings((s) => s.config);
  const patch = useSettings((s) => s.patchConfig);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hook, setHook] = useState<{ available: boolean; reason?: string } | null>(null);

  useEffect(() => {
    void window.whisperflowExtras.app.keyboardHookStatus().then(setHook);
  }, []);
  if (!config) return null;

  const captureKey = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const accel = acceleratorFrom(e.nativeEvent);
    if (!accel) return;
    setRecording(false);
    void window.whisperflowExtras.app.rebindHotkey(accel).then(({ ok }) => {
      if (ok) {
        setMessage(`Bound to ${accel}`);
        void patch({ hotkey: { pushToTalk: accel } });
      } else {
        setMessage(`"${accel}" is already taken by another app — try a different combo.`);
      }
      setTimeout(() => setMessage(null), 4000);
    });
  };

  return (
    <section>
      <SectionTitle
        title="Shortcuts"
        hint="Global keys that work in any application. Press once to start, again to finish; Esc cancels."
      />
      <Card>
        <Row label="Dictation hotkey">
          {recording ? (
            <input
              autoFocus
              readOnly
              onKeyDown={captureKey}
              onBlur={() => setRecording(false)}
              value="Press a key combination…"
              className="w-56 rounded-lg border border-accent/60 bg-surface-2 px-3 py-2 text-center text-sm outline-none"
            />
          ) : (
            <Button variant="ghost" onClick={() => setRecording(true)}>
              <Kbd>{config.hotkey.pushToTalk}</Kbd>
              <span className="ml-2 text-ink-dim">Rebind</span>
            </Button>
          )}
        </Row>
        <Row
          label="Toggle mode"
          hint="On: one press starts, next press finishes. Off: the session also auto-finishes after silence."
        >
          <Toggle
            checked={config.hotkey.toggleMode}
            onChange={(v) => void patch({ hotkey: { toggleMode: v } })}
          />
        </Row>
        <Row
          label="Hold to talk"
          hint={
            hook?.available
              ? "Press and hold the hotkey to talk; release to finish. Also detects typing mid-dictation and holds the session open."
              : "Needs the global keyboard hook, which isn't available in this build — toggling on has no effect until it is."
          }
        >
          <Toggle
            checked={config.hotkey.holdMode}
            disabled={!hook?.available}
            onChange={(v) => void patch({ hotkey: { holdMode: v } })}
          />
        </Row>
        {config.hotkey.holdMode && hook && (
          <p className="border-t border-line/60 px-1 pt-3 text-xs leading-5 text-ink-dim">
            {hook.available ? (
              <>
                The keyboard hook sees <span className="font-medium text-ink">key-up</span> events,
                which Electron's global shortcuts can't. It watches for your combination only; other
                keys are counted as typing — nothing is recorded.
              </>
            ) : (
              <span className="text-red-400">
                Keyboard hook unavailable{hook.reason ? `: ${hook.reason}` : ""}.
              </span>
            )}
          </p>
        )}
        <Row label="Cancel shortcut">
          <Kbd>Esc</Kbd>
        </Row>
      </Card>
      {message && (
        <p className="mt-4 rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm text-ink-dim">
          {message}
        </p>
      )}
    </section>
  );
}
