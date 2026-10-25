import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, TextInput } from "../../shared/ui";

interface Note {
  id: string;
  text: string;
  updatedAt: number;
}

const KEY = "wf-scratchpad-notes";

function load(): Note[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Note[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(notes: Note[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* private mode */
  }
}

/** Quick local notes — capture now, polish into dictations later. */
export function ScratchpadTab() {
  const [notes, setNotes] = useState<Note[]>(() => load());
  const [draft, setDraft] = useState("");

  useEffect(() => {
    save(notes);
  }, [notes]);

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    setNotes((n) => [{ id: crypto.randomUUID(), text: clean, updatedAt: Date.now() }, ...n]);
    setDraft("");
  };

  return (
    <section>
      <PageHeader
        title="Scratchpad"
        tagline="Your safe space to dump, draft, and explore."
        explainer="Drop a to-do list, brain-dump an idea, park a thought. Notes never leave this machine."
      />
      <div className="mb-5 flex gap-2">
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder="Start a note…"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={!draft.trim()}>
          New note
        </Button>
      </div>
      {notes.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No notes yet"
          body="Quick thoughts you want to come back to — everything here stays local."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((note) => (
            <Card key={note.id} className="p-4">
              <textarea
                value={note.text}
                onChange={(e) =>
                  setNotes((all) =>
                    all.map((n) => (n.id === note.id ? { ...n, text: e.target.value, updatedAt: Date.now() } : n)),
                  )
                }
                rows={4}
                className="w-full resize-none bg-transparent text-sm leading-6 outline-none"
              />
              <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2">
                <span className="text-[11px] text-ink-dim">
                  {new Date(note.updatedAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => setNotes((all) => all.filter((n) => n.id !== note.id))}
                  className="rounded px-2 py-0.5 text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
