import { useState } from "react";
import type { VoiceCommand } from "@whisperflow/shared";
import { useSettings, addCommand, removeCommand } from "../store";
import { Button, EmptyState, PageHeader, Select, TextInput } from "../../shared/ui";

const ACTIONS: Array<{ value: VoiceCommand["action"]; label: string }> = [
  { value: "insert", label: "Insert text" },
  { value: "replace", label: "Replace everything" },
  { value: "undo", label: "Undo — discard dictation" },
];

const SHOWCASE: Array<[string, string]> = [
  ["“my email”", "naman@yourdomain.com"],
  ["“sign off”", "Best,\nNaman"],
  ["“organize this”", "Rewrite these rough notes into clear, polished prose…"],
];

export function CommandsTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [filter, setFilter] = useState("All");
  const [phrase, setPhrase] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<VoiceCommand["action"]>("insert");
  const [payload, setPayload] = useState("");
  if (!config) return null;

  const add = () => {
    const clean = phrase.trim();
    if (!clean) return;
    setPhrase("");
    setPayload("");
    void addCommand(clean, action, payload.trim() || undefined).then(loadConfig);
  };

  const commands = config.commands.filter((c) => {
    if (filter === "Personal" && c.phrase.startsWith("team:")) return false;
    return (
      !search ||
      c.phrase.toLowerCase().includes(search.toLowerCase()) ||
      (c.payload ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <section>
      <PageHeader
        title="Snippets"
        actions={<><Button variant="ghost" onClick={() => void loadConfig()}>Import</Button><Button onClick={add} disabled={!phrase.trim()}>Add new</Button></>}
        segmented={["All", "Personal"]}
        activeSeg={filter}
        onSegChange={setFilter}
        tagline="The stuff you shouldn't have to re-type."
        explainer="Save text you type often — an email, intro, or prompt — then say a word to drop it in instantly."
      />

      {/* showcase: phrase → expansion, like the reference board */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {SHOWCASE.map(([p, v]) => (
          <div key={p} className="rounded-xl border border-dashed border-line bg-surface/60 p-4">
            <p className="text-sm font-medium">{p}</p>
            <p className="mt-1 text-ink-dim">↓</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-ink-dim">{v}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 space-y-2 rounded-2xl border border-line bg-surface/60 p-4">
        <TextInput value={phrase} onChange={setPhrase} placeholder="Spoken phrase, e.g. “sign off”" />
        <div className="flex gap-2">
          <Select value={action} onChange={(v) => setAction(v as VoiceCommand["action"])} options={ACTIONS} />
          {action !== "undo" && (
            <TextInput value={payload} onChange={setPayload} placeholder="Text to insert / replace with" />
          )}
        </div>
        <TextInput value={search} onChange={setSearch} placeholder="Search snippets…" className="w-56" />
      </div>

      {commands.length === 0 ? (
        <EmptyState
          icon="🎙️"
          title={search ? "No matches" : "No snippets yet"}
          body={
            search
              ? `Nothing matches “${search}”.`
              : 'Try your email signature: phrase “sign off”, action Insert. Built-in "scratch that" (undo) always works.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {commands.map((command) => (
            <div
              key={command.id}
              className="group flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <p className="w-44 shrink-0 truncate text-sm font-medium">“{command.phrase}”</p>
              <span className="text-ink-dim">→</span>
              <p className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">
                {command.action === "undo" ? "discard the dictation" : command.payload}
              </p>
              <button
                type="button"
                onClick={() => void removeCommand(command).then(loadConfig)}
                className="rounded p-1 text-ink-dim opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                aria-label={`Delete ${command.phrase}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
