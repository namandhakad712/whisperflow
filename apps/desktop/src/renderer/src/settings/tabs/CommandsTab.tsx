import { useState } from "react";
import type { VoiceCommand } from "@whisperflow/shared";
import { useSettings, addCommand, removeCommand } from "../store";
import { Button, Card, EmptyState, SectionTitle, Select, TextInput } from "../../shared/ui";

const ACTIONS: Array<{ value: VoiceCommand["action"]; label: string }> = [
  { value: "undo", label: "Undo — discard the dictation" },
  { value: "insert", label: "Insert text" },
  { value: "replace", label: "Replace everything with text" },
];

export function CommandsTab() {
  const config = useSettings((s) => s.config);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [phrase, setPhrase] = useState("");
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

  return (
    <section>
      <SectionTitle
        title="Voice commands"
        hint="Speak a phrase to trigger an action. Say it first in a dictation to keep the rest as text."
      />
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">"scratch that"</p>
            <p className="mt-0.5 text-xs text-ink-dim">Built-in — cancels the current dictation without typing anything.</p>
          </div>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-dim">built-in</span>
        </div>
      </Card>

      <div className="mb-4 space-y-2 rounded-2xl border border-line bg-surface/60 p-4">
        <TextInput value={phrase} onChange={setPhrase} placeholder='Spoken phrase, e.g. "sign off"' />
        <div className="flex gap-2">
          <Select value={action} onChange={(v) => setAction(v as VoiceCommand["action"])} options={ACTIONS} />
          {action !== "undo" && (
            <TextInput value={payload} onChange={setPayload} placeholder="Text to insert/replace with" />
          )}
        </div>
        <div>
          <Button onClick={add} disabled={!phrase.trim()}>
            Add command
          </Button>
        </div>
      </div>

      {config.commands.length === 0 ? (
        <EmptyState icon="🎙️" title="No custom commands" body="Try an email signature: phrase “sign off”, action Insert." />
      ) : (
        <Card className="divide-y divide-line/60 p-0">
          {config.commands.map((command) => (
            <div key={command.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">"{command.phrase}"</p>
                <p className="truncate text-xs text-ink-dim">
                  {ACTIONS.find((a) => a.value === command.action)?.label}
                  {command.payload ? ` — "${command.payload}"` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeCommand(command).then(loadConfig)}
                className="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-red-400"
                aria-label={`Delete ${command.phrase}`}
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
