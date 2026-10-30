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
/* #root must carry the full height or the zone's height:100% collapses and
 * the dash/capsule render at the top of the window instead of the middle. */
#root { width: 100%; height: 100%; }

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

/* Hover capsule — their exact status-bar capsule: a 30px circle that expands
 * to 54px width, vast-950 bg, 1.5px border fading from transparent to
 * vast-900, all on the 0.2s capsule spring. (The invented 416px "Dictate +
 * hotkey" pill is gone — it didn't exist in the reference.) */
.capsule {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 30px;
  width: 30px;
  border-radius: 999px;
  background: #1a1a1a;
  border: 1.5px solid transparent;
  overflow: hidden;
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: width 0.2s var(--spring-easing), border-color 0.05s ease, opacity 0.18s ease;
}
.zone:hover .capsule, .zone[data-hover="true"] .capsule {
  opacity: 1;
  width: 54px;
  border-color: #30302f;
}
.zone:hover .dash, .zone[data-hover="true"] .dash { opacity: 0; }

/* Inner circle button: shade-black with a vast-900 ring; hover fills
 * vast-900 and lightens the ring to vast-700 (their hover). */
.cap-btn {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #000;
  border: 1.5px solid #30302f;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.zone:hover .cap-btn { background: #30302f; border-color: #5b5b59; }

/* The chevron: vast-500, 22px, hover shade-white, rotated per dock edge. */
.cap-chevron {
  width: 22px;
  height: 22px;
  color: #878683;
  transition: color 0.12s ease, transform 0.12s ease;
}
.zone:hover .cap-chevron { color: #fff; }
.zone[data-edge="left"] .cap-chevron { transform: rotate(90deg); }
.zone[data-edge="right"] .cap-chevron { transform: rotate(-90deg); }
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
        {/* Their hover capsule: circle button + chevron; expanding 30→54px. */}
        <div className="capsule" aria-label={`Start dictation (${hotkey})`}>
          <span className="cap-btn">
            <svg className="cap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>
    </>
  );
}
