/**
 * Modes: per-app polish profiles. Dictate into an app that matches a mode's
 * pattern and the mode's overrides win over the global polish settings —
 * e.g. "slack" → casual, no trailing periods; "code" → raw, no cleanup.
 */
import { useState } from "react";
import type { ModeProfile } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Button, EmptyState, PageHeader, Select, SettingGroup, Switch, TextInput } from "../../shared/ui";

type Tone = ModeProfile["tone"];
type Cleanup = ModeProfile["cleanup"];
type Format = ModeProfile["format"];
type EmailSignature = ModeProfile["emailSignature"];

const TONES: Array<{ value: Tone; label: string }> = [
  { value: "auto", label: "Auto (global setting)" },
  { value: "neutral", label: "Neutral" },
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "custom", label: "Custom instructions only" },
];
const CLEANUPS: Array<{ value: Cleanup; label: string }> = [
  { value: "auto", label: "Auto (global setting)" },
  { value: "none", label: "None — raw transcript" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "full", label: "Full" },
];
const FORMATS: Array<{ value: Format; label: string }> = [
  { value: "auto", label: "Auto (global setting)" },
  { value: "casual", label: "Casual prose" },
  { value: "formatted", label: "Formatted" },
  { value: "raw", label: "Raw" },
  { value: "lowercase", label: "Lowercase" },
];
const SIGNATURES: Array<{ value: EmailSignature; label: string }> = [
  { value: "auto", label: "Auto (global setting)" },
  { value: "on", label: "Always add" },
  { value: "off", label: "Never add" },
];

function blank(): ModeProfile {
  return {
    id: `mode-${Date.now().toString(36)}`,
    name: "",
    match: "",
    tone: "auto",
    cleanup: "auto",
    format: "auto",
    customInstructions: "",
    dictionary: [],
    emailSignature: "auto",
    enabled: true,
  };
}

/** Corrections are edited as one term per line; each becomes a dictionary
 *  entry matched (fuzzily) only when this mode is active. */
function correctionsText(p: ModeProfile): string {
  return p.dictionary.map((e) => e.term).join("\n");
}

function parseCorrections(text: string, modeId: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((term, i) => ({ id: `${modeId}-c${i}`, term }));
}

export function ModesTab() {
  const config = useSettings((s) => s.config);
  const patchConfig = useSettings((s) => s.patchConfig);
  const [draft, setDraft] = useState<ModeProfile | null>(null);
  const [corrections, setCorrections] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const catalog = useSettings((s) => s.catalog);
  // STT models from the catalog (role "stt"), excluding cloud-adapter ids.
  const sttModels = catalog
    .filter((e) => e.role === "stt")
    .map((e) => e.id)
    .sort();
  const LANGUAGES = ["auto", "en", "es", "fr", "de", "it", "pt", "nl", "ja", "ko", "zh", "hi", "ru", "ar"];
  const newMode = () => {
    setDraft(blank());
    setCorrections("");
  };
  if (!config) return null;

  const profiles = config.modes?.profiles ?? [];
  const editing = draft !== null;

  const save = () => {
    const m = draft!;
    if (!m.name.trim() || !m.match.trim()) {
      setNotice("Give the mode a name and a match pattern.");
      window.setTimeout(() => setNotice(null), 4000);
      return;
    }
    const others = profiles.filter((p) => p.id !== m.id);
    // Normalize the stt block: empty model + empty language = absent.
    const stt = m.stt && (m.stt.modelId || m.stt.language) ? m.stt : undefined;
    const withCorrections = { ...m, stt, dictionary: parseCorrections(corrections, m.id) };
    void patchConfig({ modes: { profiles: [...others, withCorrections] } }).then(() => setDraft(null));
  };

  const edit = (p: ModeProfile) => {
    setDraft({ ...p });
    setCorrections(correctionsText(p));
  };

  const remove = (id: string) => {
    void patchConfig({ modes: { profiles: profiles.filter((p) => p.id !== id) } });
  };

  const toggle = (p: ModeProfile, enabled: boolean) => {
    void patchConfig({
      modes: { profiles: profiles.map((x) => (x.id === p.id ? { ...x, enabled } : x)) },
    });
  };

  const overrideBadges = (p: ModeProfile): string[] => {
    const out: string[] = [];
    if (p.tone !== "auto") out.push(TONES.find((t) => t.value === p.tone)?.label ?? p.tone);
    if (p.cleanup !== "auto") out.push(`cleanup: ${p.cleanup}`);
    if (p.format !== "auto") out.push(`format: ${p.format}`);
    if (p.emailSignature !== "auto") out.push(`signature: ${p.emailSignature}`);
    if (p.customInstructions.trim()) out.push("extra instructions");
    if (p.dictionary.length > 0) out.push(`${p.dictionary.length} correction${p.dictionary.length === 1 ? "" : "s"}`);
    if (p.stt?.modelId) out.push(`STT: ${p.stt.modelId}`);
    if (p.stt?.language) out.push(`lang: ${p.stt.language}`);
    return out;
  };

  return (
    <section className="min-w-0 max-w-full">
      <PageHeader
        title="Modes"
        tagline="Per-app formatting. The first mode whose pattern matches the app you're dictating into wins; everything set to Auto falls back to the global polish settings."
      />
      <SettingGroup title="Your modes">
        {profiles.length === 0 && !editing && (
          <>
            <EmptyState
              icon="🎙️"
              title="No modes yet"
              body="Add one — e.g. match “slack” for casual chat formatting, or “gmail” for a different tone in email."
            />
            <div className="flex justify-center py-3">
              <Button onClick={newMode}>Add a mode</Button>
            </div>
          </>
        )}
        {profiles.map((p) => (
          <div
            key={p.id}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1 basis-[200px]">
              <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                <span className="truncate">{p.name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-dim">
                  {p.match}
                </span>
                {!p.enabled && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-dim">
                    off
                  </span>
                )}
              </p>
              {overrideBadges(p).length > 0 && (
                <p className="mt-1 flex min-w-0 flex-wrap gap-1.5 text-[11px] text-ink-dim">
                  {overrideBadges(p).map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent ring-1 ring-inset ring-accent/20"
                    >
                      {b}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <Switch checked={p.enabled} onChange={(v) => toggle(p, v)} aria-label={`Enable ${p.name}`} />
            <Button variant="ghost" onClick={() => edit(p)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => remove(p.id)}>
              Delete
            </Button>
          </div>
        ))}
      </SettingGroup>

      {editing && (
        <SettingGroup title={profiles.some((p) => p.id === draft!.id) ? "Edit mode" : "New mode"}>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
            <TextInput
              value={draft!.name}
              onChange={(v) => setDraft({ ...draft!, name: v })}
              placeholder="Mode name — e.g. Chat"
              className="min-w-0 flex-1 basis-[120px]"
            />
            <TextInput
              value={draft!.match}
              onChange={(v) => setDraft({ ...draft!, match: v })}
              placeholder="Match — app name, title, or URL"
              className="min-w-0 flex-1 basis-[160px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-2">
            {([
              ["Tone", TONES, "tone"],
              ["Cleanup", CLEANUPS, "cleanup"],
              ["Format", FORMATS, "format"],
              ["Email signature", SIGNATURES, "emailSignature"],
            ] as const).map(([label, options, field]) => (
              <label key={label} className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-dim">
                {label}
                <Select
                  value={draft![field]}
                  options={options}
                  onChange={(v) => setDraft({ ...draft!, [field]: v })}
                />
              </label>
            ))}
            <div className="sm:col-span-2">
              <TextInput
                value={draft!.customInstructions}
                onChange={(v) => setDraft({ ...draft!, customInstructions: v })}
                placeholder="Extra instructions — “reply in bullets”, “keep it under 3 sentences”…"
                className="w-full"
              />
            </div>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-dim">
              STT model (empty = global)
              <select
                value={draft!.stt?.modelId ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft!,
                    stt: { modelId: e.target.value, language: draft!.stt?.language ?? "" },
                  })
                }
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
              >
                <option value="">Use my global model</option>
                {sttModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-dim">
              Language (empty = global)
              <select
                value={draft!.stt?.language ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft!,
                    stt: { language: e.target.value, modelId: draft!.stt?.modelId ?? "" },
                  })
                }
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
              >
                <option value="">Use my global language</option>
                <option value="auto">Auto-detect</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-dim sm:col-span-2">
              Corrections for this app — one per line
              <textarea
                value={corrections}
                onChange={(e) => setCorrections(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={"WhisperFlow\nkubernetes"}
                className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
              />
              <span className="text-[11px] text-ink-dim/70">
                Matched fuzzily, only while dictating into this app — so “kube” can be one thing in Slack and another in your IDE.
              </span>
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save mode</Button>
          </div>
        </SettingGroup>
      )}

      {!editing && profiles.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-ink-dim">{notice}</p>
          <Button onClick={newMode}>Add a mode</Button>
        </div>
      )}
    </section>
  );
}
