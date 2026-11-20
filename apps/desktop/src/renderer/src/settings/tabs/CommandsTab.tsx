import { useState } from "react";
import type { VoiceCommand } from "@whisperflow/shared";
import { useSettings, addCommand, removeCommand } from "../store";
import { Button, EmptyState, PageHeader, Select, SettingGroup, TextInput } from "../../shared/ui";

const ACTIONS: Array<{ value: VoiceCommand["action"]; label: string }> = [
  { value: "insert", label: "Insert text" },
  { value: "replace", label: "Replace everything" },
  { value: "undo", label: "Undo — discard dictation" },
];

/** One worked example per column: phrase you say → text that gets typed. */
const SHOWCASE: Array<[string, string]> = [
  ["“my email”", "you@example.com"],
  ["“sign off”", "Best regards"],
  ["“organize this”", "Rewrite these rough notes into clear, polished prose…"],
];

export function CommandsTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [phrase, setPhrase] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [action, setAction] = useState<VoiceCommand["action"]>("insert");
  const [payload, setPayload] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  if (!config) return null;

  const add = () => {
    const clean = phrase.trim();
    if (!clean) {
      setNotice("Type the phrase you'll say, then press Add.");
      setTimeout(() => setNotice(null), 4000);
      return;
    }
    // An insert/replace command with no text would fire and do nothing when
    // spoken — refuse it up front instead of storing a dead command.
    if ((action === "insert" || action === "replace") && !payload.trim()) {
      setNotice(action === "insert" ? "Insert needs the text to insert." : "Replace needs the replacement text.");
      setTimeout(() => setNotice(null), 4000);
      return;
    }
    setPhrase("");
    setPayload("");
    void addCommand(clean, action, payload.trim() || undefined)
      .then(loadConfig)
      .catch(() => {
        setNotice("Couldn't add that command — check the logs folder (Settings → About).");
        setTimeout(() => setNotice(null), 6000);
      });
  };

  /**
   * Imports snippets from JSON: `[{"phrase": "sign off", "action": "insert",
   * "payload": "Best regards"}, …]`. Malformed entries are skipped, not fatal —
   * a bad file reports how many were imported.
   */
  const importJson = async () => {
    const picked = await window.whisperflowExtras.app.pickFile({
      title: "Import snippets from JSON",
      filters: [{ name: "JSON", extensions: ["json"] }],
      readText: true,
    });
    if (picked.canceled || !picked.content) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(picked.content);
    } catch {
      setNotice("That file isn't valid JSON — nothing was imported.");
      setTimeout(() => setNotice(null), 5000);
      return;
    }
    const rows = Array.isArray(parsed) ? parsed : [];
    let added = 0;
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as { phrase?: unknown; action?: unknown; payload?: unknown };
      if (typeof r.phrase !== "string" || !r.phrase.trim()) continue;
      const a = r.action;
      if (a !== "insert" && a !== "replace" && a !== "undo") continue;
      if (a !== "undo" && typeof r.payload !== "string") continue;
      await addCommand(r.phrase.trim(), a, a === "undo" ? undefined : (r.payload as string));
      added++;
    }
    await loadConfig();
    setNotice(added > 0 ? `Imported ${added} snippet${added === 1 ? "" : "s"}.` : "No usable snippets in that file (expected an array of {phrase, action, payload}).");
    setTimeout(() => setNotice(null), 5000);
  };

  const commands = config.commands.filter(
    (c) =>
      !search ||
      c.phrase.toLowerCase().includes(search.toLowerCase()) ||
      (c.payload ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section>
      <PageHeader
        title="Snippets"
        actions={<><Button variant="ghost" onClick={() => void importJson()}>Import</Button><Button onClick={add}>Add new</Button></>}
        tagline="The stuff you shouldn't have to re-type."
        explainer="Save text you type often — an email, intro, or prompt — then say a word to drop it in."
      />

      <SettingGroup title="How snippets work" hint="Say the phrase mid-dictation; the expansion is typed where your cursor is.">
        <div className="grid gap-3 sm:grid-cols-3">
          {SHOWCASE.map(([p, v]) => (
            <div key={p} className="rounded-xl border border-line bg-surface-2/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">You say</p>
              <p className="mt-1 text-sm font-medium">{p}</p>
              <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">WhisperFlow types</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-dim">{v}</p>
            </div>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title="New snippet" hint="The phrase you'll say, and what happens when you do." className="mt-5">
        <div className="space-y-2">
          <TextInput value={phrase} onChange={setPhrase} placeholder="Spoken phrase, e.g. “sign off”" />
          <div className="flex flex-wrap gap-2">
            <Select value={action} onChange={(v) => setAction(v as VoiceCommand["action"])} options={ACTIONS} />
            {action !== "undo" && (
              <TextInput
                value={payload}
                onChange={setPayload}
                placeholder="Text to insert / replace with"
                className="min-w-0 flex-1"
              />
            )}
          </div>
          <TextInput value={search} onChange={setSearch} placeholder="Search snippets…" className="w-56" />
        </div>
      </SettingGroup>

      {notice && (
        <p className="mt-4 rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm text-ink-dim">
          {notice}
        </p>
      )}
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
        <div className="mt-5 space-y-2.5">
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
