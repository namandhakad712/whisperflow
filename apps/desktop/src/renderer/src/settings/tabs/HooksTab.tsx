import { useState } from "react";
import { useSettings } from "../store";
import { Button, Card, EmptyState, PageHeader, Switch, TextInput } from "../../shared/ui";
import type { HookItem } from "@whisperflow/shared";

/**
 * Hooks: fire-and-forget automation after a dictation completes.
 * Commands spawn without a shell and get the transcript on STDIN; webhooks
 * receive it as JSON. Nothing here can break a dictation.
 */
export function HooksTab() {
  const config = useSettings((s) => s.config);
  const patchConfig = useSettings((s) => s.patchConfig);
  const [draft, setDraft] = useState<HookItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!config) return null;
  const hooks = config.hooks?.items ?? [];
  const editing = draft !== null;

  const save = () => {
    const h = draft!;
    if (!h.name.trim() || !h.target.trim()) {
      setNotice("Give the hook a name and a target.");
      window.setTimeout(() => setNotice(null), 4000);
      return;
    }
    const others = hooks.filter((x) => x.id !== h.id);
    void patchConfig({ hooks: { items: [...others, h] } }).then(() => setDraft(null));
  };

  const remove = (id: string) => {
    void patchConfig({ hooks: { items: hooks.filter((x) => x.id !== id) } });
  };

  const toggle = (h: HookItem, enabled: boolean) => {
    void patchConfig({ hooks: { items: hooks.map((x) => (x.id === h.id ? { ...x, enabled } : x)) } });
  };

  const blank = (): HookItem => ({
    id: `hook-${Date.now().toString(36)}`,
    name: "",
    event: "dictation",
    kind: "command",
    target: "",
    format: "text",
    enabled: true,
  });

  return (
    <section>
      <PageHeader
        title="Hooks"
        actions={<Button onClick={() => setDraft(blank())}>Add a hook</Button>}
        tagline="Automation after each dictation."
        explainer="A hook fires when a dictation completes: run a command (the transcript arrives on STDIN) or POST it to a webhook. Hooks never block a dictation and failures only land in the log."
      />

      {editing && draft && (
        <Card className="mb-4">
          <div className="flex flex-col gap-3 px-4 py-3">
            <TextInput
              value={draft.name}
              onChange={(v) => setDraft({ ...draft, name: v })}
              placeholder="Hook name — “append to notes”"
            />
            <div className="flex gap-3">
              <label className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-dim">
                Kind
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as "command" | "webhook" })}
                  className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
                >
                  <option value="command">Command (transcript on STDIN)</option>
                  <option value="webhook">Webhook (POST JSON)</option>
                </select>
              </label>
            </div>
            <TextInput
              value={draft.target}
              onChange={(v) => setDraft({ ...draft, target: v })}
              placeholder={
                draft.kind === "command"
                  ? "Command — e.g. `C:\\scripts\\append-notes.bat` or `pwsh -File C:\\scripts\\notes.ps1`"
                  : "Webhook URL — POSTed `{ app, event, text, timestamp }`"
              }
            />
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-dim">
              Transcript format
              <select
                value={draft.format ?? "text"}
                onChange={(e) => setDraft({ ...draft, format: e.target.value as "text" | "json" })}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
              >
                <option value="text">Plain text (raw transcript)</option>
                <option value="json">JSON ({`{"text": "…", "timestamp": …}`})</option>
              </select>
            </label>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={save}>Save hook</Button>
            </div>
          </div>
        </Card>
      )}

      {hooks.length === 0 && !editing && (
        <EmptyState
          icon="⚡"
          title="No hooks yet"
          body="Add one to run a command or POST a webhook after each dictation."
        />
      )}

      {hooks.map((h) => (
        <Card key={h.id} className="mb-2">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{h.name}</p>
              <p className="truncate font-mono text-xs text-ink-dim">
                {h.kind === "command" ? `command · ${h.target}` : `webhook · ${h.target}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch checked={h.enabled} onChange={(v) => toggle(h, v)} />
              <Button variant="ghost" onClick={() => setDraft({ ...h })}>Edit</Button>
              <Button variant="ghost" onClick={() => remove(h.id)}>Remove</Button>
            </div>
          </div>
        </Card>
      ))}

      {notice && <p className="mt-2 text-xs text-ink-dim">{notice}</p>}
    </section>
  );
}