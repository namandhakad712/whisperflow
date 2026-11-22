import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * THE PRESS KIT — console v0.1.48.
 *
 * The free-world grammar (reactbits / canvasui / 21st.dev — browsed Nov
 * 2026, nothing installed; lineage in INSPIRATION.md) spoken in our print
 * language: ink floods instead of gloss sweeps, decrypt text from a
 * printer's charset, spotlight as an ink wash. Every value authored here.
 * Reduced motion is honored globally (see useReducedMotion).
 */

/** Printer's charset for decrypt/scramble FX — glyphs a press actually owns. */
const PRESS_CHARS = "·:•%#%@&*=+÷¬√∑µ¶§";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */
/* PrintButton — the primary action: ink floods the label L→R on hover
 * (a roller pass), a specular hairline chases the cursor on focus,
 * press stamps (scale .97 + ink-bleed). Variants: fill (primary),
 * plate (secondary), ghost (tertiary), danger (coral ink).            */
/* ------------------------------------------------------------------ */

export function PrintButton({
  children,
  onClick,
  variant = "fill",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "fill" | "plate" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`pk-btn pk-btn-${variant} ${className}`}
    >
      <span className="pk-btn-ink" aria-hidden="true" />
      <span className="pk-btn-gloss" aria-hidden="true" />
      <span className="pk-btn-label">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* SpotlightCard — cursor-tracking ink wash inside the hairline frame.
 * rAF-smoothed, no re-render per move; wash = accent at low alpha
 * through a dither mask so it reads as ink, not a glow gradient.     */
/* ------------------------------------------------------------------ */

export function SpotlightCard({
  children,
  className = "",
  radius = 320,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Wash radius in px. */
  radius?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);
  const target = useRef({ x: -1e4, y: -1e4 });
  const pos = useRef({ x: -1e4, y: -1e4 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      target.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      el.style.setProperty("--pk-spot-o", "1");
    };
    const onLeave = () => el.style.setProperty("--pk-spot-o", "0");
    const tick = () => {
      // ease toward the cursor — the wash lags like wet ink
      pos.current.x += (target.current.x - pos.current.x) * 0.12;
      pos.current.y += (target.current.y - pos.current.y) * 0.12;
      el.style.setProperty("--pk-spot-x", `${pos.current.x}px`);
      el.style.setProperty("--pk-spot-y", `${pos.current.y}px`);
      raf.current = requestAnimationFrame(tick);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    raf.current = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`pk-spotlight ${className}`}
      style={{ "--pk-spot-r": `${radius}px` } as CSSProperties}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PillNav — 40px tabs with a sliding accent indicator. The indicator
 * is layout-measured (offsetLeft/width), so labels of any width ride
 * the same rail. Ids keep keys stable across route changes.          */
/* ------------------------------------------------------------------ */

export function PillNav<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel?: string;
}) {
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [ind, setInd] = useState({ x: 0, w: 0, ready: false });

  const measure = () => {
    const el = refs.current[value];
    if (!el) return;
    setInd({ x: el.offsetLeft, w: el.offsetWidth, ready: true });
  };
  useEffect(measure, [value]);
  useEffect(() => {
    const t = setTimeout(measure, 60); // after fonts settle
    return () => clearTimeout(t);
  });

  return (
    <nav className="pk-pillnav" aria-label={ariaLabel}>
      <span
        className="pk-pillnav-ind"
        style={{ transform: `translateX(${ind.x}px)`, width: ind.w, opacity: ind.ready ? 1 : 0 }}
        aria-hidden="true"
      />
      {options.map((o) => (
        <a
          key={o.value}
          ref={(el) => {
            refs.current[o.value] = el;
          }}
          href={`#${o.value}`}
          aria-current={o.value === value ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            onChange(o.value);
          }}
          className={`pk-pillnav-tab ${o.value === value ? "on" : ""}`}
        >
          {o.label}
        </a>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* DecryptText — text resolves from the printer's charset. One-shot on
 * mount (page titles) or keyed re-runs (route changes) via `runKey`. */
/* ------------------------------------------------------------------ */

export function DecryptText({
  text,
  className = "",
  duration = 520,
  delay = 0,
  runKey,
}: {
  text: string;
  className?: string;
  duration?: number;
  delay?: number;
  /** Change to re-run the resolve. */
  runKey?: string | number;
}) {
  const [shown, setShown] = useState(text);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setShown(text);
      return;
    }
    let raf = 0;
    let timer = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      // chars lock in L→R; unlocked positions show press glyphs
      const locked = Math.floor(t * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === " " || i < locked) out += ch;
        else if (t > 0 && Math.random() > 0.5)
          out += PRESS_CHARS[Math.floor(Math.random() * PRESS_CHARS.length)]!;
        else out += ch;
      }
      setShown(out);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setShown(text);
    };
    timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 0);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [text, duration, delay, reduced, runKey]);

  return <span className={`pk-decrypt ${className}`}>{shown}</span>;
}

/* ------------------------------------------------------------------ */
/* CountUp — odometer digits, mono, eased. For stats and version bits. */
/* ------------------------------------------------------------------ */

export function CountUp({
  to,
  duration = 900,
  className = "",
  format,
}: {
  to: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setN(Math.round(to * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduced]);

  return <span className={`pk-countup ${className}`}>{format ? format(n) : n}</span>;
}

/* ------------------------------------------------------------------ */
/* Magnetic — children lean toward the cursor (max 2px here; print
 * restraint). Wrap rail items and primary CTAs.                      */
/* ------------------------------------------------------------------ */

export function Magnetic({
  children,
  strength = 2,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2 || 1);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2 || 1);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    };
    const onLeave = () => {
      el.style.transform = "translate(0,0)";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={`pk-magnetic ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AuroraField — the two-ink aurora behind the content column. Canvas
 * 2D, three blurred radial washes drifting on lissajous paths at ~4%
 * opacity over the bg. Cheap, calm, ditherable later if it reads too
 * smooth.                                                            */
/* ------------------------------------------------------------------ */

export function AuroraField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const io = new IntersectionObserver((e) => {
      alive = e[0]?.isIntersecting ?? true;
      if (alive && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(canvas);

    const accentOf = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() ||
      "#5CE1A9";

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const t0 = performance.now();
    function tick(now: number) {
      raf = 0;
      if (!alive || !canvas || !ctx) return;
      const t = (now - t0) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const accent = accentOf();
      // three lissajous drifters, alpha ≤ 0.045 — a wash, not a poster
      const drifts = [
        { x: w * (0.3 + 0.18 * Math.sin(t * 0.11)), y: h * (0.28 + 0.16 * Math.cos(t * 0.09)), r: Math.max(w, h) * 0.42, a: 0.10 },
        { x: w * (0.72 + 0.14 * Math.cos(t * 0.07 + 2)), y: h * (0.6 + 0.18 * Math.sin(t * 0.12 + 1)), r: Math.max(w, h) * 0.38, a: 0.07 },
        { x: w * (0.5 + 0.22 * Math.sin(t * 0.05 + 4)), y: h * (0.85 + 0.1 * Math.cos(t * 0.08 + 3)), r: Math.max(w, h) * 0.3, a: 0.06 },
      ];
      for (const d of drifts) {
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        g.addColorStop(0, withAlpha(accent, d.a));
        g.addColorStop(1, withAlpha(accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={`pk-aurora ${className}`} aria-hidden="true" />;
}

function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------------ */
/* DotRadar — dot grid where dots grow near the cursor. Right rail's
 * living paper.                                                       */
/* ------------------------------------------------------------------ */

export function DotRadar({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let alive = true;
    let mx = -1e4;
    let my = -1e4;
    let smx = -1e4;
    let smy = -1e4;

    const io = new IntersectionObserver((e) => {
      alive = e[0]?.isIntersecting ?? true;
      if (alive && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(canvas);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    };
    const onLeave = () => {
      mx = -1e4;
      my = -1e4;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("blur", onLeave);

    const inkOf = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-ink-faint").trim() ||
      "#6A6B6C";

    function tick() {
      raf = 0;
      if (!alive || !canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      smx += (mx - smx) * 0.14;
      smy += (my - smy) * 0.14;
      ctx.clearRect(0, 0, w, h);
      const cell = 22;
      const ink = inkOf();
      ctx.fillStyle = ink;
      for (let y = cell / 2; y < h; y += cell) {
        for (let x = cell / 2; x < w; x += cell) {
          const d = Math.hypot(x - smx, y - smy);
          // base 0.8px dot; grows to 2.6px within 130px of the cursor
          const r = reduced ? 0.8 : Math.max(0.8, 2.6 - d / 130 * 1.8);
          ctx.beginPath();
          ctx.arc(x, y, Math.min(2.6, r), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return <canvas ref={ref} className={`pk-dotradar ${className}`} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* AnimatedRows — staggered settle for a group of rows/cards. Wrap the
 * group; children with [data-stage-row] ride the cascade. This lives
 * as a component so tabs can opt in without CSS gymnastics.          */
/* ------------------------------------------------------------------ */

export function AnimatedRows({
  children,
  step = 40,
  className = "",
}: {
  children: ReactNode;
  /** ms between rows. */
  step?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = Array.from(el.querySelectorAll("[data-stage-row]"));
    rows.forEach((r, i) => {
      (r as HTMLElement).style.setProperty("--pk-row-delay", `${i * step}ms`);
      (r as HTMLElement).classList.add("pk-row-in");
    });
  }, [step]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
