import { useState } from "react";
import { useSettings, addDictionaryEntry, removeDictionaryEntry } from "../store";
import { Button, Card, EmptyState, SectionTitle, TextInput } from "../../shared/ui";

export function DictionaryTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [term, setTerm] = useState("");
  if (!config) return null;

  const add = () => {
    const clean = term.trim();
    if (!clean) return;
    setTerm("");
    void addDictionaryEntry(clean).then(loadConfig);
  };

  return (
    <section>
      <SectionTitle
        title="Personal dictionary"
        hint="Names, jargon, brand spellings. WhisperFlow fuzzy-corrects near-misses after transcription and tells the polish model your exact spellings."
      />
      <div className="mb-4 flex gap-2">
        <TextInput
          value={term}
          onChange={setTerm}
          placeholder='Add a term, e.g. "WhisperFlow" or "Azure Kubernetes"'
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={!term.trim()}>
          Add
        </Button>
      </div>
      {config.dictionary.length === 0 ? (
        <EmptyState
          icon="📖"
          title="No terms yet"
          body="Add the words you say often that models keep misspelling — people's names are the classic case."
        />
      ) : (
        <Card className="divide-y divide-line/60 p-0">
          {config.dictionary.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.term}</p>
                {entry.hint && <p className="truncate text-xs text-ink-dim">{entry.hint}</p>}
              </div>
              <button
                type="button"
                onClick={() => void removeDictionaryEntry(entry).then(loadConfig)}
                className="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-red-400"
                aria-label={`Delete ${entry.term}`}
              >
                Delete
              </button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
