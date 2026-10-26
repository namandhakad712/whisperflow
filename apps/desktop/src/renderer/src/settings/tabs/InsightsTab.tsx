import { useEffect, useMemo, useState } from "react";
import type { TranscriptItem } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Card, PageHeader } from "../../shared/ui";

/** Words-per-day bars from local history — the privacy-safe version of "Insights". */
export function InsightsTab() {
  const history = useSettings((s) => s.history);
  const loadHistory = useSettings((s) => s.loadHistory);
  const [items, setItems] = useState<TranscriptItem[]>([]);

  useEffect(() => {
    void loadHistory().then(() => setItems(useSettings.getState().history));
  }, [loadHistory]);

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
          <Card key={label} className="p-5">
            <p className="font-display text-4xl">{big}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">{label}</p>
          </Card>
        ))}
      </div>
      <Card>
        <p className="mb-4 text-sm font-semibold">Last 7 days</p>
        <div className="flex h-36 items-end gap-3">
          {stats.days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-accent transition-all"
                  style={{ height: `${Math.max(3, (d.words / max) * 100)}%`, opacity: d.words ? 1 : 0.25 }}
                  title={`${d.words} words · ${d.count} dictations`}
                />
              </div>
              <span className="text-[11px] text-ink-dim">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <Heatmap items={items} />
      {items.length === 0 && (
        <p className="mt-4 text-xs text-ink-dim">
          No dictations yet — press the hotkey and speak; this page fills itself in.
        </p>
      )}
    </section>
  );
}

/** GitHub-style activity grid: 12 weeks × 7 days, one cell per day of dictation. */
function Heatmap({ items }: { items: TranscriptItem[] }) {
  const cols = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const t of items) {
      const d = new Date(t.createdAt);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
      const words = (t.finalText || t.rawText || "").split(/\s+/).filter(Boolean).length;
      byDay.set(key, (byDay.get(key) ?? 0) + words);
    }
    // Columns of 7 days, oldest left — ending today.
    const cols: Array<Array<{ key: string; words: number }>> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (7 * 12 - 1) - today.getDay()); // align to weeks
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

  const level = (words: number) =>
    words === 0 ? "bg-surface-2" : words < 20 ? "bg-accent/25" : words < 60 ? "bg-accent/50" : words < 150 ? "bg-accent/75" : "bg-accent";

  return (
    <Card className="mt-5">
      <p className="mb-4 text-sm font-semibold">Activity — last 12 weeks</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1.5">
            {col.map((cell) => (
              <div
                key={cell.key}
                className={`h-3.5 w-3.5 rounded-sm transition-colors ${level(cell.words)}`}
                title={`${cell.key}${cell.words ? ` — ${cell.words} words` : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
        <span>less</span>
        {["bg-surface-2", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"].map((l, i) => (
          <span key={i} className={`h-3 w-3 rounded-sm ${l}`} />
        ))}
        <span>more</span>
      </div>
    </Card>
  );
}
