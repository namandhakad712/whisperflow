import { useEffect, useState } from "react";
import { useSettings } from "../store";
import { Button, Card, EmptyState, SectionTitle, TextInput } from "../../shared/ui";
import { formatDuration, formatRelative } from "../../shared/format";

export function HistoryTab() {
  const history = useSettings((s) => s.history);
  const loadHistory = useSettings((s) => s.loadHistory);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const search = () => void loadHistory(query.trim() || undefined);

  return (
    <section>
      <SectionTitle title="History" hint="Every dictation, stored locally in your user profile. Never synced anywhere." />
      <div className="mb-4 flex gap-2">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Search transcripts…"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button variant="ghost" onClick={search}>
          Search
        </Button>
        <Button
          variant="danger"
          onClick={() => void window.whisperflow.history.clear().then(() => loadHistory())}
        >
          Clear all
        </Button>
      </div>
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
