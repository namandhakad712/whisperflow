import { useEffect, useRef } from "react";

/**
 * Scramble-decode — the Signal Standard's signature hover motion
 * (MOTION.md): text cycles the glyph ramp ` .·:;=+x%#@`, settling
 * left→right at 42ms/frame, ≤ len+9 frames total. Ported from the
 * website's Header.astro verbatim grammar, wrapped as a React hook.
 *
 * Under `prefers-reduced-motion` nothing runs — the label just is.
 */

const RAMP = " .·:;=+x%#@";

export function useScramble<T extends HTMLElement>(text: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let frame = 0;
    let running = false;

    const tick = () => {
      frame++;
      // settle left→right: `frame/2` glyphs decoded, the rest cycle
      const settled = Math.floor(frame / 2);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        out +=
          i < settled || ch === " "
            ? ch
            : (RAMP[Math.floor(Math.random() * RAMP.length)] ?? ch);
      }
      el.textContent = out;
      if (settled < text.length) {
        raf = requestAnimationFrame(tick);
      } else {
        el.textContent = text;
        running = false;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      frame = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      running = false;
      el.textContent = text;
    };

    el.addEventListener("pointerenter", start);
    el.addEventListener("focus", start);
    el.addEventListener("pointerleave", stop);
    return () => {
      el.removeEventListener("pointerenter", start);
      el.removeEventListener("focus", start);
      el.removeEventListener("pointerleave", stop);
      cancelAnimationFrame(raf);
    };
  }, [text]);

  return ref;
}

/** The span form: `<Scramble text="audio" />` scrambles on hover. */
export function Scramble({ text, className }: { text: string; className?: string }) {
  const ref = useScramble<HTMLSpanElement>(text);
  return (
    <span ref={ref} className={`wf-scramble ${className ?? ""}`}>
      {text}
    </span>
  );
}
