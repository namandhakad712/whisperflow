import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface/60 p-5 ${className}`}>{children}</div>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-dim">{hint}</p>}
    </div>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line/60 py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-5 text-ink-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

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
  const styles =
    variant === "primary"
      ? "bg-accent text-bg hover:bg-accent-strong"
      : variant === "danger"
        ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
        : "border border-line bg-surface-2 text-ink hover:border-accent/50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

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
      className={`w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-ink-dim/60 focus:border-accent/60 ${className}`}
    />
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
      className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-14 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-5 text-ink-dim">{body}</p>}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-line border-t-accent ${className}`}
      aria-label="loading"
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">
      {children}
    </kbd>
  );
}
