import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../store";
import { Button, Card, EmptyState, PageHeader, TextInput } from "../../shared/ui";
import { formatDuration, formatRelative } from "../../shared/format";
import { DayStrip } from "../../shared/DayStrip";

export function HistoryTab() {
  const history = useSettings((s) => s.history);
  const loadHistory = useSettings((s) => s.loadHistory);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const search = () => void loadHistory(query.trim() || undefined);

  // v0.1.52: today's runs, plotted as the halftone day strip.
  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return history
      .filter((it) => it.createdAt >= start)
      .map((it) => ({
        at: it.createdAt,
        durationMs: it.durationMs,
        excerpt: (it.finalText || it.rawText).slice(0, 42),
      }));
  }, [history]);

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
            <p className="sec-mark">the day, in ink</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {today.length} run{today.length === 1 ? "" : "s"} today · dot size = run length
            </p>
          </div>
          <DayStrip points={today} className="mt-3" />
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
