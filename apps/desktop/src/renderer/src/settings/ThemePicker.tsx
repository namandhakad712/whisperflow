import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { THEMES, getTheme, readThemeId, applyTheme, type Theme } from "./themes";

/**
 * The Theme Press picker — six themes as print specimens.
 *
 * Each card is a mini proof sheet: the theme's ASCII specimen set in its
 * own mono, its accent as a swatch strip, serif/grotesk cast noted in the
 * eyebrow. Clicking rolls the whole console over on `scope` (380ms).
 *
 * Selection is instant-apply (a press proof you can hold), and the choice
 * persists via applyTheme's localStorage write.
 */
export function ThemePicker() {
  const [current, setCurrent] = useState<string>(() => readThemeId());

  // Keep in sync if the theme is changed from the palette or topbar elsewhere.
  useEffect(() => {
    const ob = () => setCurrent(readThemeId());
    window.addEventListener("wf-theme-changed", ob);
    return () => window.removeEventListener("wf-theme-changed", ob);
  }, []);

  const pick = (id: string) => {
    applyTheme(id);
    setCurrent(id);
    window.dispatchEvent(new Event("wf-theme-changed"));
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {THEMES.map((t) => (
        <ThemeCard key={t.id} theme={t} active={t.id === current} onPick={() => pick(t.id)} />
      ))}
    </div>
  );
}

function ThemeCard({ theme, active, onPick }: { theme: Theme; active: boolean; onPick: () => void }) {
  const serif = theme.cast.display.includes("Instrument Serif");
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={`card corner-brackets wf-theme-swap dither-tex group flex flex-col gap-2.5 p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60 ${
        active ? "border-line-strong" : "hover:border-line-strong"
      }`}
      style={
        active
          ? { boxShadow: `inset 0 0 0 1px ${theme.tokens.accent}55` }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          {serif ? "serif × grotesk" : "grotesk × mono"}
        </span>
        {active && (
          <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-phosphor">
            <Check size={11} strokeWidth={2.5} /> on press
          </span>
        )}
      </div>

      {/* the specimen: the theme's mark, its own palette in preview */}
      <div
        className="rounded-md border border-line px-2.5 py-2"
        style={{ background: theme.tokens.bg, color: theme.tokens.inkDim }}
      >
        <pre className="ascii-specimen" style={{ color: theme.tokens.inkDim }}>
          {theme.specimen.map((line, i) => (
            <div key={i}>
              {line.split("").map((ch, j) =>
                "⦁●".includes(ch) ? (
                  <span key={j} style={{ color: theme.tokens.accent }}>
                    {ch}
                  </span>
                ) : (
                  <span key={j}>{ch}</span>
                ),
              )}
            </div>
          ))}
        </pre>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="wf-display text-[15px] leading-tight text-ink">{theme.label}</span>
        {/* swatch strip: the theme's accent + ink, hairline separated */}
        <span className="flex items-center gap-1" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: theme.tokens.accent }} />
          <i className="h-2.5 w-2.5 rounded-[2px]" style={{ background: theme.tokens.ink }} />
          <i
            className="h-2.5 w-2.5 rounded-[2px] border border-line"
            style={{ background: theme.tokens.paper }}
          />
        </span>
      </div>
      <span className="text-[11.5px] leading-snug text-ink-dim">{theme.blurb}</span>
    </button>
  );
}
