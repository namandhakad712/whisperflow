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
      {items.length === 0 && (
        <p className="mt-4 text-xs text-ink-dim">
          No dictations yet — press the hotkey and speak; this page fills itself in.
        </p>
      )}
    </section>
  );
}
