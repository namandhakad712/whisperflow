import { useState } from "react";
import { useSettings, addDictionaryEntry, removeDictionaryEntry } from "../store";
import { Button, EmptyState, PageHeader, TextInput } from "../../shared/ui";

export function DictionaryTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  if (!config) return null;

  const add = () => {
    const clean = term.trim();
    if (!clean) return;
    setTerm("");
    void addDictionaryEntry(clean).then(loadConfig);
  };

  const entries = config.dictionary.filter((e) => {
    if (filter === "Personal" && e.hint?.includes("team")) return false;
    return !search || e.term.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <section>
      <PageHeader
        title="Dictionary"
        actions={<><Button variant="ghost" onClick={() => void loadConfig()}>Import</Button><Button onClick={add} disabled={!term.trim()}>Add new</Button></>}
        segmented={["All", "Personal"]}
        activeSeg={filter}
        onSegChange={setFilter}
        tagline="WhisperFlow spells the way you do."
        explainer="Correct a spelling once or add it here manually, so your personal terms, project jargon, or uncommon names come out right in every dictation."
      />
      <div className="mb-5 flex gap-2">
        <TextInput
          value={term}
          onChange={setTerm}
          placeholder="Add new word — a name, acronym, or correction (word → replacement)"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <TextInput
          value={search}
          onChange={setSearch}
          placeholder="Search…"
          className="w-40 shrink-0"
        />
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon="📖"
          title={search ? "No matches" : "No words yet"}
          body={
            search
              ? `Nothing in the dictionary matches “${search}”.`
              : "Add the words you say often that models keep misspelling — people's names are the classic case."
          }
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => {
            const [from, to] = entry.term.split("→").map((p) => p.trim());
            return (
              <span
                key={entry.id}
                className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
              >
                <span className="font-medium">{from}</span>
                {to && (
                  <>
                    <span className="text-ink-dim">→</span>
                    <span className="text-ink-dim">{to}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void removeDictionaryEntry(entry).then(loadConfig)}
                  className="rounded p-0.5 text-ink-dim opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  aria-label={`Remove ${entry.term}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      {entries.length > 0 && (
        <p className="mt-5 text-xs leading-5 text-ink-dim">
          Fuzzy correction catches near-misses automatically after transcription, and every term
          is passed to the polish model as context.
        </p>
      )}
    </section>
  );
}
