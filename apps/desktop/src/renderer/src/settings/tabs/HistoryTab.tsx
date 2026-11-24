import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../store";
import { Button, Card, EmptyState, PageHeader, TextInput } from "../../shared/ui";
import { formatDuration, formatRelative } from "../../shared/format";
import { DayStrip, type DayStripRange } from "../../shared/DayStrip";

const RANGE_LABELS: Record<DayStripRange, string> = {
  day: "today",
  week: "week",
  month: "month",
};

export function HistoryTab() {
  const history = useSettings((s) => s.history);
  const loadHistory = useSettings((s) => s.loadHistory);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DayStripRange>("day");

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const search = () => void loadHistory(query.trim() || undefined);

  // v0.1.53: runs inside the selected range window, plotted as the strip.
  const strip = useMemo(() => {
    const now = new Date();
    let start: number;
    if (range === "day") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (range === "week") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dow = (d.getDay() + 6) % 7; // Monday = 0
      start = d.getTime() - dow * 86_400_000;
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    return history
      .filter((it) => it.createdAt >= start)
      .map((it) => ({
        at: it.createdAt,
        durationMs: it.durationMs,
        excerpt: (it.finalText || it.rawText).slice(0, 42),
      }));
  }, [history, range]);

  return (
    <section>
      <PageHeader title="History" tagline="Everything you said, only on your machine." explainer="Every dictation, stored locally. Never synced anywhere." />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Search transcripts…"
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="min-w-0 flex-1"
        />
        <Button variant="ghost" onClick={search} className="shrink-0">
          Search
        </Button>
        <Button
          variant="danger"
          onClick={() => void window.whisperflow.history.clear().then(() => loadHistory())}
          className="shrink-0"
        >
          Clear all
        </Button>
      </div>
      {history.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-baseline justify-between">
            <p className="sec-mark">the {range === "day" ? "day" : range === "week" ? "week" : "month"}, in ink</p>
            <div className="flex items-center gap-1" role="group" aria-label="Strip range">
              {(Object.keys(RANGE_LABELS) as DayStripRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    range === r ? "bg-surface-2 text-ink" : "text-ink-faint hover:bg-surface-2/60 hover:text-ink-dim"
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {strip.length} run{strip.length === 1 ? "" : "s"} · dot size = run length
              </span>
            </div>
          </div>
          <DayStrip points={strip} range={range} className="mt-3" />
        </Card>
      )}
      {history.length === 0 ? (
        <EmptyState icon="🗂️" title={query ? "No matches" : "Nothing dictated yet"} body="Your transcripts will appear here after your first dictation." />
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Card key={item.id}>
              <div className="flex items-center gap-3 text-xs text-ink-dim">
                <span>{formatRelative(item.createdAt)}</span>
                {item.app && <span>· {item.app}</span>}
                {item.durationMs !== undefined && <span>· {formatDuration(item.durationMs)}</span>}
                <span className="ml-auto flex gap-1">
                  {item.audioPath && (
                    <button
                      type="button"
                      onClick={() => void window.whisperflow.app.openPath({ path: item.audioPath! })}
                      className="rounded-md px-2 py-1 transition-colors hover:bg-surface-2 hover:text-ink"
                      title={`Play recording — ${item.audioPath}`}
                    >
                      ▶ Play
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(item.finalText ?? item.rawText)}
                    className="rounded-md px-2 py-1 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void window.whisperflow.history.delete({ id: item.id }).then(() => loadHistory(query || undefined))
                    }
                    className="rounded-md px-2 py-1 transition-colors hover:bg-surface-2 hover:text-red-400"
                  >
                    Delete
                  </button>
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.finalText || item.rawText}</p>
              {item.finalText && item.rawText !== item.finalText && (
                <p className="mt-2 border-t border-line/60 pt-2 text-xs italic leading-5 text-ink-dim/80">
                  raw: {item.rawText}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
