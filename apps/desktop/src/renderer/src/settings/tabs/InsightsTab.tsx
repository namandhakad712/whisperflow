import { useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptItem } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Card, PageHeader, SettingGroup } from "../../shared/ui";
import { DitherCanvas } from "@whisperflow/signal-engine";
import { getTheme } from "../themes";

/** Words-per-day bars from local history — the privacy-safe version of "Insights".
 *  v0.1.46: the bars are DITHERED (Engine F) — ordered Bayer fills that read
 *  as print, with an entrance sweep, aura bloom and a gliding scrub tooltip. */
export function InsightsTab() {
  const history = useSettings((s) => s.history);
  const loadHistory = useSettings((s) => s.loadHistory);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [themeId, setThemeId] = useState(() => document.documentElement.dataset.theme ?? "lab");
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    void loadHistory().then(() => setItems(useSettings.getState().history));
  }, [loadHistory]);

  useEffect(() => {
    const ob = () => setThemeId(document.documentElement.dataset.theme ?? "lab");
    window.addEventListener("wf-theme-changed", ob);
    return () => window.removeEventListener("wf-theme-changed", ob);
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const days: Array<{ key: string; label: string; words: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        key: d.toDateString(),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        words: 0,
        count: 0,
      });
    }
    let totalWords = 0;
    let todayWords = 0;
    const todayKey = days[days.length - 1]!.key;
    for (const t of items) {
      const words = (t.finalText || t.rawText || "").split(/\s+/).filter(Boolean).length;
      totalWords += words;
      const d = new Date(t.createdAt);
      const bucket = days.find((x) => x.key === new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString());
      if (bucket) {
        bucket.words += words;
        bucket.count += 1;
      }
      if (new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString() === todayKey) todayWords += words;
    }
    return { days, totalWords, todayWords, total: items.length };
  }, [items]);

  const max = Math.max(1, ...stats.days.map((d) => d.words));
  const accent = getTheme(themeId).tokens.accent;
  const spark = stats.days.map((d) => d.words);

  return (
    <section>
      <PageHeader
        title="Insights"
        tagline="Your words, counted on your machine."
        explainer="Computed from local history. Nothing is uploaded — there is no server to upload to."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          [String(stats.total), "dictations stored"],
          [String(stats.todayWords), "words today"],
          [String(stats.totalWords), "words all-time"],
        ].map(([big, label]) => (
          <Card key={label} className="relative overflow-hidden p-5">
            <DitherWash ink={accent} />
            <p className="wf-display relative text-4xl">{big}</p>
            <p className="relative mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">{label}</p>
          </Card>
        ))}
      </div>
      <SettingGroup
        title="Last 7 days"
        hint="Words per day, from your local transcripts — dithered like a print proof."
        actions={
          <button
            type="button"
            onClick={() => setReplay((r) => r + 1)}
            className="rounded border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:border-phosphor/40 hover:text-ink"
          >
            replay
          </button>
        }
      >
        <DitherBarChart
          days={stats.days}
          max={max}
          ink={accent}
          replay={replay}
        />
        <Sparkline data={spark} ink={accent} className="mt-4" />
      </SettingGroup>
      <Heatmap items={items} ink={accent} />
      {items.length === 0 && (
        <p className="mt-4 text-xs text-ink-dim">
          No dictations yet — press the hotkey and speak; this page fills itself in.
        </p>
      )}
    </section>
  );
}

/** The 7-day bars: each bar is a DitherCanvas gradient fill (Bayer 8×8),
 *  entrance sweeps up on out-expo, hover scrubs a gliding tooltip. */
function DitherBarChart({
  days,
  max,
  ink,
  replay,
}: {
  days: Array<{ key: string; label: string; words: number; count: number }>;
  max: number;
  ink: string;
  replay: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative flex h-44 items-end gap-3" onMouseLeave={() => setHover(null)}>
      {days.map((d, i) => {
        const h = Math.max(3, (d.words / max) * 100);
        return (
          <div
            key={d.key}
            className="group relative flex min-w-0 flex-1 flex-col items-center gap-2"
            onMouseEnter={() => setHover(i)}
          >
            {/* gliding scrub tooltip — follows the hovered bar */}
            <div
              className={`pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-line-strong bg-paper px-2 py-1 font-mono text-[10px] text-ink shadow-lg transition-all duration-150 ${
                hover === i ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
              }`}
            >
              {d.words} words · {d.count} dictations
            </div>
            <div className="flex h-32 w-full items-end">
              <div className="relative w-full overflow-hidden rounded-t-md border border-line/50" style={{ height: `${h}%` }}>
                <DitherBar ink={ink} replay={replay} delay={i * 55} dimmed={!d.words} />
              </div>
            </div>
            <span className={`text-[11px] transition-colors ${hover === i ? "text-ink" : "text-ink-dim"}`}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DitherBar({ ink, delay, replay, dimmed }: { ink: string; delay: number; replay: number; dimmed?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const eng = useRef<DitherCanvas | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!ref.current) return;
    if (!eng.current) {
      eng.current = new DitherCanvas(ref.current, {
        ink,
        variant: "gradient",
        direction: "up",
        bloom: true,
        cell: 4,
      });
      eng.current.mount();
    } else {
      eng.current.setOptions({
        ink,
        variant: "gradient",
        direction: "up",
        bloom: true,
        cell: 4,
      });
    }
    if (firstRun.current) {
      firstRun.current = false;
      const t = window.setTimeout(() => eng.current?.animate(), delay);
      return () => window.clearTimeout(t);
    }
    eng.current.animate(); // replay token changed: re-sweep
  }, [ink, delay, replay]);

  return (
    <canvas
      ref={ref}
      className="h-full w-full transition-opacity duration-200"
      style={{ opacity: dimmed ? 0.35 : 1 }}
      aria-hidden="true"
    />
  );
}

/** Tiny decorative spark — the week's shape in one line of dots. */
function Sparkline({ data, ink, className }: { data: number[]; ink: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 280;
    const h = 44;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...data);
    const step = w / Math.max(1, data.length - 1);
    // aura under the spark
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, `${ink}22`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - 4 - (v / max) * (h - 10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    // the dots on the line — bayer-spaced by index parity, radius by value
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - 4 - (v / max) * (h - 10);
      ctx.fillStyle = v > 0 ? ink : "transparent";
      if (v > 0) {
        ctx.beginPath();
        ctx.arc(x, y, v === max ? 2.6 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [data, ink]);
  return (
    <div className={className}>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        the week, one line — fig. 02
      </p>
      <canvas ref={ref} className="h-11 w-full" aria-hidden="true" />
    </div>
  );
}

/** A quiet dithered wash behind stat cards — texture, not noise. */
function DitherWash({ ink }: { ink: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const eng = new DitherCanvas(canvas, { ink, variant: "dotted", cell: 5, direction: "up" });
    eng.mount();
    return () => eng.dispose();
  }, [ink]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-40" aria-hidden="true" />;
}

/** GitHub-style activity grid: 12 weeks × 7 days, one cell per day of dictation.
 *  v0.1.46: cells are dither-density steps, not flat alpha — five prints of
 *  the same ink, exactly like a press ramp. */
function Heatmap({ items, ink }: { items: TranscriptItem[]; ink: string }) {
  const cols = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const t of items) {
      const d = new Date(t.createdAt);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
      const words = (t.finalText || t.rawText || "").split(/\s+/).filter(Boolean).length;
      byDay.set(key, (byDay.get(key) ?? 0) + words);
    }
    const cols: Array<Array<{ key: string; words: number }>> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (7 * 12 - 1) - today.getDay());
    for (let c = 0; c < 12; c++) {
      const col: Array<{ key: string; words: number }> = [];
      for (let r = 0; r < 7; r++) {
        const d = new Date(start);
        d.setDate(d.getDate() + c * 7 + r);
        const key = d.toDateString();
        col.push({ key, words: byDay.get(key) ?? 0 });
      }
      cols.push(col);
    }
    return cols;
  }, [items]);

  // density steps: 0 → surface, then 20/45/70/100% of the bayer threshold
  const level = (words: number) => {
    const t = words === 0 ? 0 : words < 20 ? 0.22 : words < 60 ? 0.45 : words < 150 ? 0.7 : 1;
    return { t, words };
  };

  return (
    <SettingGroup title="Activity — last 12 weeks" hint="One cell per day — dot density is the word count." className="mt-5">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1.5">
            {col.map((cell) => {
              const { t } = level(cell.words);
              return (
                <div
                  key={cell.key}
                  className="h-3.5 w-3.5 rounded-sm border border-line/40 transition-colors"
                  style={
                    t > 0
                      ? {
                          backgroundImage: `radial-gradient(${ink} ${t * 100}%, transparent ${t * 100 + 30}%)`,
                          backgroundSize: "3px 3px",
                        }
                      : { background: "var(--color-surface-2)" }
                  }
                  title={`${cell.key}${cell.words ? ` — ${cell.words} words` : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
        <span>less</span>
        {[0.22, 0.45, 0.7, 1].map((t) => (
          <span
            key={t}
            className="h-3 w-3 rounded-sm border border-line/40"
            style={{ backgroundImage: `radial-gradient(${ink} ${t * 100}%, transparent ${t * 100 + 30}%)`, backgroundSize: "3px 3px" }}
          />
        ))}
        <span>more</span>
      </div>
    </SettingGroup>
  );
}
