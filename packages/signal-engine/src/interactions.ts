/**
 * Signal Standard text micro-interactions.
 * - scramble(): hover/decode effect — letters cycle the glyph ramp, then settle.
 * - ScrambleText: web-component-free helper that binds scramble to elements.
 */
import { GLYPH_RAMP } from "./ascii";

export interface ScrambleOptions {
  /** Cycles per character before settling (default 3). */
  cycles?: number;
  /** Frame ms (default 42). */
  interval?: number;
  /** Run once without hover binding. */
  immediate?: boolean;
}

const CHARS = GLYPH_RAMP.replace(" ", "") + "/\\|~-";

/** Scramble-decode a string. Returns a cancel function. */
export function scramble(el: HTMLElement, finalText: string, opts: ScrambleOptions = {}): () => void {
  const cycles = opts.cycles ?? 3;
  const interval = opts.interval ?? 42;
  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    el.textContent = finalText;
    return () => {};
  }
  let frame = 0;
  const maxFrames = finalText.length * 1 + cycles * 3;
  const timer = window.setInterval(() => {
    frame++;
    const settled = Math.floor((frame / maxFrames) * finalText.length);
    let out = "";
    for (let i = 0; i < finalText.length; i++) {
      const ch = finalText[i]!;
      if (ch === " " || i < settled) {
        out += ch;
      } else {
        out += CHARS[Math.floor(Math.random() * CHARS.length)]!;
      }
    }
    el.textContent = out;
    if (settled >= finalText.length) {
      el.textContent = finalText;
      window.clearInterval(timer);
    }
  }, interval);
  return () => window.clearInterval(timer);
}

/** Bind hover-scramble to every [data-scramble] element under root. */
export function bindScrambles(root: ParentNode = document): () => void {
  const cleanups: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>("[data-scramble]").forEach((el) => {
    const finalText = el.getAttribute("data-scramble") || el.textContent || "";
    let cancel: (() => void) | null = null;
    const start = () => {
      cancel?.();
      cancel = scramble(el, finalText);
    };
    el.addEventListener("pointerenter", start);
    cleanups.push(() => {
      el.removeEventListener("pointerenter", start);
      cancel?.();
    });
  });
  return () => cleanups.forEach((fn) => fn());
}

/**
 * The "press & hold" hero demo driver — no microphone needed (and the real
 * mic variant is opt-in): holding SPACE (or pointer-down on the keycap)
 * raises the drive level; release triggers the polish sweep on the demo
 * transcript. Used by the website hero.
 */
export interface HoldDemoOptions {
  onDrive(level: number): void;
  onRelease(elapsed: number): void;
}

export function holdDemo(target: HTMLElement, opts: HoldDemoOptions): () => void {
  let holding = false;
  let raf = 0;
  let level = 0;
  let heldSince = 0;

  const setLevel = (v: number) => {
    level = v;
    opts.onDrive(v);
  };

  const press = () => {
    if (holding) return;
    holding = true;
    heldSince = performance.now();
    target.setAttribute("data-holding", "");
    const tick = () => {
      if (!holding) return;
      const t = (performance.now() - heldSince) / 1000;
      // amplitude rises fast then oscillates like a speaking voice
      const wobble = 0.55 + 0.45 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
      setLevel(Math.min(1, 0.25 + t * 0.9) * wobble);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  const release = () => {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(raf);
    target.removeAttribute("data-holding");
    const elapsed = (performance.now() - heldSince) / 1000;
    setLevel(0);
    opts.onRelease(elapsed);
  };

  target.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    press();
  });
  window.addEventListener("pointerup", release);

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let keyHeld = false;
  const onKeyDown = (e: KeyboardEvent) => {
    if (reduced || e.code !== "Space" || e.repeat || keyHeld) return;
    // only when the hero is on screen and nothing editable is focused
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const r = target.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    e.preventDefault();
    keyHeld = true;
    // a focused button would also "click" on Space — suppress that so the
    // key always drives the demo, never a double trigger
    if (document.activeElement === target) e.stopPropagation();
    press();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== "Space" || !keyHeld) return;
    keyHeld = false;
    release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointerup", release);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
