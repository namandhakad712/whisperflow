import { useEffect, useState } from "react";
import type { ModelStatus } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Card, PageHeader } from "../../shared/ui";

/** Reference-pattern setup card: progress bar + checklist, wired to REAL app state. */
function SetupChecklist() {
  const statuses = useSettings((s) => s.statuses);
  const config = useSettings((s) => s.config);
  const loadModels = useSettings((s) => s.loadModels);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    const engineReady = statuses.some((s) => s.entryId === "whisper-bin-x64" && s.state === "downloaded");
    const modelReady = statuses.some((s) => s.entryId === config?.stt.modelId && s.state === "downloaded");
    setDone({
      hotkey: true,
      models: engineReady && modelReady,
      dictionary: (config?.dictionary.length ?? 0) > 0,
      snippet: (config?.commands.length ?? 0) > 0,
    });
  }, [statuses, config]);

  const steps: Array<{ id: string; label: string; hint: string; action: () => void; actionLabel: string }> = [
    { id: "hotkey", label: "Test your hotkey", hint: "Press it anywhere — the overlay appears", action: () => (window.location.hash = "#/shortcuts"), actionLabel: "Open" },
    { id: "models", label: "Download the engine", hint: "whisper.cpp binary + your transcription model", action: () => (window.location.hash = "#/models"), actionLabel: "Open" },
    { id: "dictionary", label: "Add dictionary words", hint: "Names and jargon it should never misspell", action: () => (window.location.hash = "#/dictionary"), actionLabel: "Open" },
    { id: "snippet", label: "Create a snippet", hint: "Text you re-type — email, intro, prompt", action: () => (window.location.hash = "#/commands"), actionLabel: "Open" },
  ];
  const completed = steps.filter((s) => done[s.id]).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="card mb-6 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold">Set up WhisperFlow</p>
        <span className="text-xs text-ink-dim">{completed}/{steps.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 space-y-1">
        {steps.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                done[s.id] ? "border-accent bg-accent text-accent-ink" : "border-line text-transparent"
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${done[s.id] ? "text-ink-dim line-through" : "font-medium"}`}>{s.label}</p>
              <p className="text-xs text-ink-dim">{s.hint}</p>
            </div>
            {!done[s.id] && (
              <button type="button" onClick={s.action} className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink">
                {s.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reference-measured settings anatomy: rows of [label + value] with a Change button. */
function ChangeRow({ label, value, onChange }: { label: string; value: React.ReactNode; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-5">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{label}</p>
        <p className="mt-1 truncate text-sm text-ink-dim">{value}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Change
      </button>
    </div>
  );
}

export function GeneralTab() {
  const config = useSettings((s) => s.config);
  const devices = useSettings((s) => s.devices);
  if (!config) return null;

  const go = (route: string) => {
    window.location.hash = `#/${route}`;
  };

  return (
    <section>
      <PageHeader title="Dictation" tagline="The essentials, in one place." />
      <SetupChecklist />
      <Card className="divide-y divide-line/70 p-0">
        <ChangeRow
          label="Shortcuts"
          value={
            <>
              Hold{" "}
              <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
                {config.hotkey.pushToTalk}
              </kbd>{" "}
              and speak.
            </>
          }
          onChange={() => go("shortcuts")}
        />
        <ChangeRow
          label="Microphone"
          value={
            devices.find((d) => d.deviceId === config.audio.deviceId)?.label ||
            (config.audio.deviceId === "default" ? "Auto-detect" : config.audio.deviceId)
          }
          onChange={() => go("audio")}
        />
        <ChangeRow
          label="My languages"
          value={config.stt.language === "auto" ? "Auto-detect" : config.stt.language}
          onChange={() => go("audio")}
        />
        <div className="flex items-center justify-between gap-6 px-5 py-5">
          <div>
            <p className="text-[15px] font-semibold">App theme</p>
            <p className="mt-1 text-sm text-ink-dim">Nocturne (dark) · Dawn (light) · Classic</p>
          </div>
          <select
            value={(() => {
              try {
                return localStorage.getItem("wf-skin") || "nocturne";
              } catch {
                return "nocturne";
              }
            })()}
            onChange={(e) => {
              const skin = e.target.value as "nocturne" | "classic" | "dawn";
              const root = document.documentElement;
              if (skin === "classic") {
                root.dataset.theme = "classic";
                document.body.classList.remove("light");
              } else if (skin === "dawn") {
                delete root.dataset.theme;
                document.body.classList.add("light");
              } else {
                delete root.dataset.theme;
                document.body.classList.remove("light");
              }
              try {
                localStorage.setItem("wf-skin", skin);
              } catch {
                /* private mode */
              }
            }}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          >
            <option value="nocturne">Nocturne — dark</option>
            <option value="dawn">Dawn — light</option>
            <option value="classic">Classic</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-6 px-5 py-5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Custom overlay backdrop</p>
            <p className="mt-1 truncate text-sm text-ink-dim">
              {config.general.overlayBackdrop || "None — paste an image/GIF path or URL"}
            </p>
          </div>
          <input
            type="text"
            value={config.general.overlayBackdrop}
            placeholder="C:\\pics\\wave.gif"
            onChange={(e) => void useSettings.getState().patchConfig({ general: { overlayBackdrop: e.target.value } })}
            className="w-52 shrink-0 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          />
        </div>
        <div className="flex items-center justify-between gap-6 px-5 py-5">
          <div>
            <p className="text-[15px] font-semibold">Save dictation history</p>
            <p className="mt-1 text-sm text-ink-dim">Stored locally only. Never synced.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !config.general.historyEnabled;
              void useSettings.getState().patchConfig({ general: { historyEnabled: next } });
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              config.general.historyEnabled ? "bg-accent" : "bg-line"
            }`}
            role="switch"
            aria-checked={config.general.historyEnabled}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow transition-transform ${
                config.general.historyEnabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </Card>
      <p className="mt-5 text-xs leading-5 text-ink-dim">
        WhisperFlow v0.1.0 · local-first · Apache-2.0 · zero telemetry
      </p>
    </section>
  );
}
