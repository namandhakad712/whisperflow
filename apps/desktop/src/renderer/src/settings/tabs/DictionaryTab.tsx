import { useState } from "react";
import { useSettings, addDictionaryEntry, removeDictionaryEntry } from "../store";
import { Button, Card, EmptyState, PageHeader, TextInput } from "../../shared/ui";

export function DictionaryTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const patchConfig = useSettings((s) => s.patchConfig);
  const [term, setTerm] = useState("");
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

  /** Imports a word list or a vocabulary PACK (JSON): one term per line for
   *  .txt/.csv/.md, or a pack file `{ app, dictionary: [...] }` / bare array
   *  for .json — the shareable form that Export writes. */
  const importList = async () => {
    const picked = await window.whisperflowExtras.app.pickFile({
      title: "Import a dictionary word list or vocabulary pack",
      filters: [
        { name: "Vocabulary pack (JSON)", extensions: ["json"] },
        { name: "Text word list", extensions: ["txt", "csv", "md"] },
      ],
      readText: true,
    });
    if (picked.canceled || !picked.content) return;
    const trimmed = picked.content.trim();
    if (picked.path?.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
      await importPack(trimmed, picked.path);
      return;
    }
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

  /** Merges a pack into the dictionary. Existing terms (case-insensitive) are
   *  never duplicated — the pack's metadata enriches them, new ones appended. */
  const importPack = async (raw: string, path?: string) => {
    let incoming: Array<{ id?: string; term?: string; pronunciation?: string; hint?: string; observedSource?: string }> = [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      const maybe = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === "object" && Array.isArray((parsed as { dictionary?: unknown }).dictionary)
            ? (parsed as { dictionary: typeof incoming }).dictionary
            : null);
      if (!maybe) throw new Error("not a pack");
      incoming = maybe.filter((e) => e && typeof e.term === "string" && e.term.trim());
    } catch {
      setNotice("That file isn’t a vocabulary pack (expected a JSON array or `{\"dictionary\": [...]}`).");
      setTimeout(() => setNotice(null), 6000);
      return;
    }
    const existing = new Map(config.dictionary.map((e) => [e.term.toLowerCase(), e]));
    let merged = 0;
    let added = 0;
    for (const e of incoming) {
      const term = (e.term as string).trim();
      const prior = existing.get(term.toLowerCase());
      if (prior) {
        // Enrich, but never overwrite something the user set by hand.
        existing.set(term.toLowerCase(), {
          ...prior,
          pronunciation: prior.pronunciation ?? e.pronunciation,
          hint: prior.hint ?? e.hint,
          observedSource: prior.observedSource ?? e.observedSource,
        });
        merged++;
      } else {
        existing.set(term.toLowerCase(), {
          id: `pack-${Date.now().toString(36)}-${added}`,
          term,
          ...(e.pronunciation ? { pronunciation: e.pronunciation } : {}),
          ...(e.hint ? { hint: e.hint } : {}),
          ...(e.observedSource ? { observedSource: e.observedSource } : {}),
        });
        added++;
      }
    }
    if (added + merged === 0) {
      setNotice("That pack had no terms.");
      setTimeout(() => setNotice(null), 5000);
      return;
    }
    await patchConfig({ dictionary: [...existing.values()] });
    await loadConfig();
    setNotice(
      `Pack imported: +${added} new${merged > 0 ? `, ${merged} enriched` : ""}${path ? ` from ${path.split(/[\\/]/).pop()}` : ""}.`,
    );
    setTimeout(() => setNotice(null), 6000);
  };

  /** Writes the dictionary as a shareable vocabulary pack (JSON). */
  const exportPack = async () => {
    const result = await window.whisperflowExtras.app.exportDictionary();
    if (result.exported) {
      setNotice(`Pack exported — ${result.count} terms → ${result.path?.split(/[\\/]/).pop() ?? "file"}.`);
      setTimeout(() => setNotice(null), 6000);
    } else if (result.message) {
      setNotice(result.message);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const entries = config.dictionary.filter(
    (e) => !search || e.term.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section>
      <PageHeader
        title="Dictionary"
        actions={<><Button variant="ghost" onClick={() => void exportPack()}>Export pack</Button><Button variant="ghost" onClick={() => void importList()}>Import</Button><Button onClick={add}>Add new</Button></>}
        tagline="WhisperFlow spells the way you do."
        explainer="Correct a spelling once or add it here — personal terms, jargon, and names come out right every time."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <TextInput
          value={term}
          onChange={setTerm}
          placeholder="Add a word — name, acronym, or correction (word → replacement)"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="min-w-0 flex-1"
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
        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold">Your words</h3>
            <span className="text-xs text-ink-dim">{entries.length} term{entries.length === 1 ? "" : "s"}</span>
          </div>
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
        </Card>
      )}
      {notice && (
        <p className="mt-4 rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm text-ink-dim">
          {notice}
        </p>
      )}
      {entries.length > 0 && (
        <p className="mt-4 text-xs leading-5 text-ink-dim">
          Fuzzy correction catches near-misses after transcription; every term is also passed to the polish model as context.
        </p>
      )}
    </section>
  );
}
