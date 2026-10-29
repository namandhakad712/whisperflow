/**
 * The persistent resting "flow bar" — their exact rest dash (from their
 * compiled CSS):
 *
 *   rest → 30×6, border-radius 6, background rgba(0,0,0,.5),
 *          border 1.5px hsla(0,0%,100%,.5), no shadow
 *
 * On hover it morphs into the mini dictation pill (416×48 #1f1f1f system —
 * same values as the overlay) with the hotkey hint, then back. Clicking it
 * starts a dictation.
 */
import { useEffect, useState } from "react";

const SPRING_EASING =
  "linear(0, 0.0015, 0.0057 1.07%, 0.0214 2.13%, 0.0739 4.26%, 0.1638 6.93%, 0.479 15.46%, 0.5791 18.66%, 0.6512 21.32%, 0.7243, 0.784, 0.832 30.92%, 0.8757 34.65%, 0.9126 38.91%, 0.9418 43.71%, 0.9633 49.04%, 0.9781 54.9%, 0.9882 61.83%, 0.9948 70.89%, 0.9982 82.09%, 0.9997 99.68%)";

const CSS = `
:root { --spring-easing: ${SPRING_EASING}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; background: transparent; overflow: hidden;
  font-family: "Inter", "Figtree", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

.zone { position: relative; width: 100%; height: 100%; cursor: pointer;
  display: flex; align-items: center; justify-content: center; }

/* Rest dash — their exact values (rotated for side docks via data-edge). */
.dash {
  width: 30px;
  height: 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  border: 1.5px solid hsla(0, 0%, 100%, 0.5);
  transition: all 0.42s var(--spring-easing);
}
.zone[data-edge="left"] .dash, .zone[data-edge="right"] .dash {
  width: 6px;
  height: 30px;
}

/* Hover morph: the pill grows to a rounded capsule and shows the hotkey hint.
 * Their window widens with it; ours morphs the dash alone — width transitions
 * within this 56px hit zone would clip, so the pill overlay is a fixed-size
 * element that fades/scales in on hover. */
.pill {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(0.6);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 30px;
  max-width: none;
  border-radius: 999px;
  background: #1f1f1f;
  border: 1.5px solid #30302f;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.38);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.42s var(--spring-easing);
  z-index: 2;
}
.zone:hover .pill, .zone[data-hover="true"] .pill {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
.zone:hover .dash, .zone[data-hover="true"] .dash { opacity: 0; }

.hint { font-size: 12px; line-height: 18px; color: #fcfcfb; font-weight: 500; }
.key { font-size: 11px; color: #71716e; }
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
        <span className="dash" />
        <div className="pill">
          <span className="hint">Dictate</span>
          <span className="key">{hotkey}</span>
        </div>
      </div>
    </>
  );
}
