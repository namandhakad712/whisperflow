import { useEffect, useState } from "react";
import { Card } from "../../shared/ui";

/**
 * YOUR PRESS (v0.1.49) — renderer-local customization: density, motion,
 * grain. Three dials, each a real CSS variable switch applied as
 * data-attributes on <html> and persisted in localStorage (wf-press),
 * exactly like the theme system — no config schema change, no IPC.
 */

export type Density = "compact" | "regular" | "roomy";
export type MotionScale = "full" | "calm" | "still";
export type GrainScale = "off" | "subtle" | "full";

interface PressPrefs {
  density: Density;
  motion: MotionScale;
  grain: GrainScale;
}

const DEFAULTS: PressPrefs = { density: "regular", motion: "full", grain: "subtle" };
const LS_KEY = "wf-press";

export function readPressPrefs(): PressPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<PressPrefs>;
    return {
      density: p.density ?? DEFAULTS.density,
      motion: p.motion ?? DEFAULTS.motion,
      grain: p.grain ?? DEFAULTS.grain,
    };
  } catch {
    return DEFAULTS;
  }
}

export function applyPressPrefs(p: PressPrefs): void {
  const root = document.documentElement;
  root.dataset.density = p.density;
  root.dataset.motion = p.motion;
  root.dataset.grain = p.grain;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* private mode — prefs live for this session only */
  }
}

/** Boot-time apply (call once from App). */
export function initPressPrefs(): PressPrefs {
  const p = readPressPrefs();
  applyPressPrefs(p);
  return p;
}

function PrefRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-dim">{hint}</p>
      </div>
      <div className="pk-pillnav" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`pk-pillnav-tab ${o.id === value ? "on" : ""}`}
            aria-pressed={o.id === value}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PressPrefsCard() {
  const [prefs, setPrefs] = useState<PressPrefs>(() => readPressPrefs());

  useEffect(() => {
    applyPressPrefs(prefs);
  }, [prefs]);

  return (
    <Card className="mb-6 divide-y divide-line/70 p-0">
      <div className="px-5 pt-5 pb-1">
        <h2 className="sec-mark">your press</h2>
        <p className="mt-1 text-xs leading-5 text-ink-dim">
          Tune the console to your taste — density, motion, and paper grain. Saved on this
          machine, like your theme.
        </p>
      </div>
      <PrefRow
        label="Density"
        hint="Row spacing across every screen — compact fits more, roomy breathes."
        value={prefs.density}
        options={[
          { id: "compact", label: "compact" },
          { id: "regular", label: "regular" },
          { id: "roomy", label: "roomy" },
        ]}
        onChange={(density) => setPrefs((p) => ({ ...p, density }))}
      />
      <PrefRow
        label="Motion"
        hint="full runs the press; calm keeps the essentials; still settles everything."
        value={prefs.motion}
        options={[
          { id: "full", label: "full" },
          { id: "calm", label: "calm" },
          { id: "still", label: "still" },
        ]}
        onChange={(motion) => setPrefs((p) => ({ ...p, motion }))}
      />
      <PrefRow
        label="Paper grain"
        hint="The 1-bit bayer texture on the sheet — the print's tooth."
        value={prefs.grain}
        options={[
          { id: "off", label: "off" },
          { id: "subtle", label: "subtle" },
          { id: "full", label: "full" },
        ]}
        onChange={(grain) => setPrefs((p) => ({ ...p, grain }))}
      />
    </Card>
  );
}
