import { useState } from "react";
import { useSettings, addDictionaryEntry, removeDictionaryEntry } from "../store";
import { Button, EmptyState, PageHeader, TextInput } from "../../shared/ui";

export function DictionaryTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  if (!config) return null;

  const add = () => {
    const clean = term.trim();
    if (!clean) {
      setNotice("Type a word first — then press Add (or Enter).");
      setTimeout(() => setNotice(null), 4000);
      return;
    }
    // The placeholder promises "word → replacement": honour it by splitting
    // the arrow form into term + pronunciation instead of storing the raw
    // line as the term itself.
    const arrow = clean.match(/^(.+?)\s*(?:->|→|=>)\s*(.+)$/);
    const entryTerm = arrow ? arrow[1]!.trim() : clean;
    const pronunciation = arrow ? arrow[2]!.trim() : undefined;
    setTerm("");
    void addDictionaryEntry(entryTerm, pronunciation)
      .then(loadConfig)
      .then(() => {
        setNotice(`Added “${entryTerm}” to the dictionary.`);
        setTimeout(() => setNotice(null), 4000);
      })
      .catch(() => {
        setNotice("Couldn't add that word — check the logs folder (Settings → About).");
        setTimeout(() => setNotice(null), 6000);
      });
  };

  /** Imports a word list: one term per line, optional "word → replacement". */
  const importList = async () => {
    const picked = await window.whisperflowExtras.app.pickFile({
      title: "Import a dictionary word list",
      filters: [{ name: "Text", extensions: ["txt", "csv", "md"] }],
      readText: true,
    });
    if (picked.canceled || !picked.content) return;
    const lines = picked.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    let added = 0;
    for (const line of lines) {
      await addDictionaryEntry(line);
      added++;
    }
    await loadConfig();
    setNotice(
      added > 0
        ? `Imported ${added} term${added === 1 ? "" : "s"}${picked.path ? ` from ${picked.path.split(/[\\/]/).pop()}` : ""}.`
        : "That file had no lines to import.",
    );
    setTimeout(() => setNotice(null), 5000);
  };

  const entries = config.dictionary.filter((e) => {
    if (filter === "Personal" && e.hint?.includes("team")) return false;
    return !search || e.term.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <section>
      <PageHeader
        title="Dictionary"
        actions={<><Button variant="ghost" onClick={() => void importList()}>Import</Button><Button onClick={add}>Add new</Button></>}
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
      {notice && (
        <p className="mb-5 rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm text-ink-dim">
          {notice}
        </p>
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
