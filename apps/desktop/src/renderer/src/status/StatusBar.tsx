/**
 * The persistent resting "status bar" — Signal Standard edition.
 *
 * Rest state: the same breathing phosphor dot as the overlay's standby LED
 * (one language, everywhere). Hover expands it into a small capsule with the
 * hotkey hint; click starts a dictation. All values authored — see MOTION.md.
 */
import { useEffect, useState } from "react";

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden;
  font-family: "Inter", "Space Grotesk", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#root { width: 100%; height: 100%; }

.zone { position: relative; width: 100%; height: 100%; cursor: pointer;
  display: flex; align-items: center; justify-content: center; }

/* Rest state: the standby LED — a 20px breathing dot. */
.dot {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(17, 19, 24, 0.85);
  border: 1px solid rgba(92, 225, 169, 0.35);
  animation: dot-breathe 3.2s ease-in-out infinite;
  transition: width 0.26s cubic-bezier(0.7, 0, 0.2, 1), height 0.26s cubic-bezier(0.7, 0, 0.2, 1);
}
@keyframes dot-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(92, 225, 169, 0.0), inset 0 0 5px rgba(92, 225, 169, 0.3); }
  50% { box-shadow: 0 0 16px 2px rgba(92, 225, 169, 0.35), inset 0 0 9px rgba(92, 225, 169, 0.65); }
}
@media (prefers-reduced-motion: reduce) {
  .dot { animation: none; box-shadow: inset 0 0 7px rgba(92, 225, 169, 0.5); }
}

/* the core pip, always present; fades when the capsule opens */
.zone .pip {
  position: absolute;
  width: 6px; height: 6px; border-radius: 999px;
  background: #5CE1A9; box-shadow: 0 0 7px rgba(92, 225, 169, 0.9);
  transition: opacity 0.12s ease;
}
.zone:hover .pip { opacity: 0; }

.zone .hint {
  position: absolute;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 10.5px; letter-spacing: 0.06em;
  color: rgba(237, 235, 228, 0.75);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.14s ease 0.08s;
}
.zone:hover .dot {
  width: 108px;
  height: 30px;
  border-color: rgba(237, 235, 228, 0.2);
  animation: none;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
}
.zone:hover .hint { opacity: 1; }

/* side docks rotate the whole bar */
.zone[data-edge="left"], .zone[data-edge="right"] { transform: none; }
.zone[data-edge="left"] .dot, .zone[data-edge="right"] .dot { width: 30px; height: 108px; }
.zone[data-edge="left"] .hint, .zone[data-edge="right"] .hint { display: none; }
`;

const DEFAULT_HOTKEY = "Ctrl+Shift+Space";

function prettyHotkey(accel: string): string {
  return accel
    .split("+")
    .map((p) => (p === "Control" ? "Ctrl" : p === "Super" ? "Win" : p))
    .join("+");
}

export function StatusBar() {
  const [edge, setEdge] = useState<"left" | "right" | "bottom">("bottom");
  const [hotkey, setHotkey] = useState(DEFAULT_HOTKEY);

  useEffect(() => {
    void window.whisperflow.settings.get().then((c) => {
      const g = c?.general as { dockEdge?: "none" | "left" | "right" | "bottom" } | undefined;
      const h = c?.hotkey as { pushToTalk?: string } | undefined;
      if (g?.dockEdge && g.dockEdge !== "none") setEdge(g.dockEdge);
      if (h?.pushToTalk) setHotkey(prettyHotkey(h.pushToTalk));
    });
    const unsubSettings = window.whisperflowExtras.settings.onChanged(() => {
      void window.whisperflow.settings.get().then((c) => {
        const g = c?.general as { dockEdge?: "none" | "left" | "right" | "bottom" } | undefined;
        const h = c?.hotkey as { pushToTalk?: string } | undefined;
        if (g?.dockEdge && g.dockEdge !== "none") setEdge(g.dockEdge);
        if (h?.pushToTalk) setHotkey(prettyHotkey(h.pushToTalk));
      });
    });
    return unsubSettings;
  }, []);

  // Click-through except over the bar itself (same protocol as the overlay).
  useEffect(() => {
    const report = (over: boolean) => window.whisperflowExtras.status.setInteractive(over);
    const onEnter = () => report(true);
    const onLeave = () => report(false);
    const zone = document.getElementById("status-zone");
    zone?.addEventListener("mouseenter", onEnter);
    zone?.addEventListener("mouseleave", onLeave);
    return () => {
      zone?.removeEventListener("mouseenter", onEnter);
      zone?.removeEventListener("mouseleave", onLeave);
      report(false);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div
        id="status-zone"
        className="zone"
        data-edge={edge}
        data-interactive="true"
        onClick={() => void window.whisperflowExtras.status.click()}
        onContextMenu={(e) => {
          e.preventDefault();
          void window.whisperflowExtras.status.contextMenu();
        }}
      >
        <span className="dot" />
        <span className="pip" aria-hidden="true" />
        <span className="hint" aria-hidden="true">{hotkey} · click to dictate</span>
      </div>
    </>
  );
}
