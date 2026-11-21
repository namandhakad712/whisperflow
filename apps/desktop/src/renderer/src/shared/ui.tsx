import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { DecryptText, SpotlightCard } from "./presskit";

/**
 * Signal Standard primitives.
 * Instrument-panel cards, phosphor accents, LED states, mono metadata.
 * Every value authored for WhisperFlow — see MOTION.md.
 */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  // data-stage-row: screens cascade their cards in on route change (styles.css).
  // v0.1.48: every card is a SpotlightCard — the cursor drags an ink wash.
  return (
    <SpotlightCard data-stage-row className={`card p-5 ${className}`}>
      {children}
    </SpotlightCard>
  );
}

/**
 * An instrument panel — the consistent way to name a group of rows.
 * Header strip with mono label + status LED; one short hint line max.
 */
export function SettingGroup({
  title,
  hint,
  actions,
  children,
  className = "",
  led = "off",
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  led?: "live" | "busy" | "off";
}) {
  return (
    <Card className={className}>
      <div className="mb-1 flex items-start justify-between gap-3 border-b border-line-soft pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={`led mt-1.5 ${led === "live" ? "led-breathe" : ""}`}
            data-on={led}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="font-mono text-[13px] font-medium uppercase tracking-[0.06em]">{title}</h3>
            {hint && <p className="mt-0.5 text-xs leading-5 text-ink-dim">{hint}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  );
}

/**
 * Progressive disclosure: expert settings stay one click away but out of the
 * default scan path. State is intentionally local — open it, use it, it folds
 * back on the next visit so the simple path stays the default.
 */
export function Disclosure({
  title,
  hint,
  defaultOpen = false,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`card ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-paper-2/40"
      >
        <ChevronRight
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className={`shrink-0 text-ink-dim transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[13px] font-medium">{title}</p>
          {hint && <p className="mt-0.5 text-xs leading-5 text-ink-dim">{hint}</p>}
        </div>
      </button>
      {open && <div className="border-t border-line-soft px-5 pb-4 pt-3">{children}</div>}
    </div>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-lg">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-dim">{hint}</p>}
    </div>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line-soft py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-5 text-ink-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * The boolean control — a phosphor signal switch. The track glows while on
 * (live signal), dims to a well while off. The only thing that should ever
 * appear at the right edge of a Row.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "bg-phosphor/25 shadow-[inset_0_0_8px_rgba(92,225,169,0.25)]"
          : "bg-ink/15 ring-1 ring-inset ring-line"
      }`}
    >
      {/* knob: phosphor when live (carries the glow), paper when off */}
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          checked
            ? "translate-x-[20px] scale-[0.92] bg-phosphor shadow-[0_0_10px_rgba(92,225,169,0.8)]"
            : "translate-x-0 scale-100 bg-paper-2 ring-1 ring-black/20"
        }`}
      />
    </button>
  );
}

/** Canonical name for the boolean control — same signal switch. */
export const Switch = Toggle;

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  // v0.1.48: the ink-flood roller pass. primary = fill, ghost = plate
  // (secondary), danger = coral. Same API, so every tab upgrades at once.
  const v = variant === "primary" ? "fill" : variant === "danger" ? "danger" : "plate";
  return (
    <span className={`pk-btn-wrap ${className}`}>
      <PrintButtonInline variant={v} disabled={disabled} onClick={onClick}>
        {children}
      </PrintButtonInline>
    </span>
  );
}

/** Local re-export so the file keeps one import surface. */
import { PrintButton as PrintButtonInline } from "./presskit";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`w-full rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-dim/60 focus:border-phosphor/60 focus:ring-2 focus:ring-phosphor/20 ${className}`}
    />
  );
}

/**
 * Mutually-exclusive option picker. The selected segment lights phosphor
 * (the live path); the rest wait in mono grey.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-paper-2 p-0.5" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3.5 py-1.5 font-mono text-[12px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60 disabled:cursor-not-allowed disabled:opacity-40 ${
            o.value === value ? "bg-paper-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-ink-dim hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-paper-2 px-3 py-2 font-mono text-[13px] outline-none transition-colors focus:border-phosphor/60 focus:ring-2 focus:ring-phosphor/20"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-14 text-center">
      <span className="font-mono text-2xl text-ink" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-5 text-ink-dim">{body}</p>}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  // v0.1.49: the spinner is now the PressLoader — five halftone dots
  // warming the press. Same API, so every busy state upgrades at once.
  return (
    <span className={`press-loader ${className}`} role="status" aria-label="loading">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** PlateSweep — the plate crossing the press bed: a comet of bayer dots
 *  on a 2px rule. For long busy states (model downloads, engine boot). */
export function PlateSweep({ className = "" }: { className?: string }) {
  return <div className={`plate-sweep ${className}`} role="status" aria-label="working" />;
}

/** Mono kbd chip — inset well. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-dim shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
      {children}
    </kbd>
  );
}

/** Settings page header: /// channel marker, display H1 + actions, optional
 *  segmented filter + tagline. The marker is the brand signature — every
 *  screen opens on it, same as the website's section eyebrows. */
export function PageHeader({
  title,
  actions,
  segmented,
  tagline,
  explainer,
  activeSeg,
  onSegChange,
}: {
  title: string;
  actions?: ReactNode;
  segmented?: string[];
  tagline?: string;
  explainer?: string;
  activeSeg?: string;
  onSegChange?: (v: string) => void;
}) {
  return (
    <div className="mb-6" data-stage-row>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl leading-tight">
            <DecryptText text={title} duration={560} />
          </h1>
          {tagline && <p className="font-display mt-1.5 text-xl">{tagline}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {segmented && (
        <div className="mt-4 inline-flex rounded-lg border border-line bg-paper-2 p-0.5">
          {segmented.map((seg) => (
            <button
              key={seg}
              type="button"
              onClick={() => onSegChange?.(seg)}
              className={`rounded-md px-3.5 py-1.5 font-mono text-[12px] transition-colors ${
                seg === activeSeg ? "bg-paper-3 text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      )}
      {explainer && <p className="mt-1.5 max-w-lg text-[13px] leading-6 text-ink-dim">{explainer}</p>}
    </div>
  );
}
