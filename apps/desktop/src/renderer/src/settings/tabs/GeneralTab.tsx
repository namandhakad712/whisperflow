import { useEffect, useState } from "react";
import type { ModelStatus } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Card, PageHeader, Toggle } from "../../shared/ui";
import { ThemePicker } from "../ThemePicker";
import { PressPrefsCard } from "./PressPrefsCard";
import { useAppVersion } from "../../shared/useAppVersion";

/** Setup card: progress bar + checklist, wired to REAL app state. */
function SetupChecklist() {
  const statuses = useSettings((s) => s.statuses);
  const config = useSettings((s) => s.config);
  const progress = useSettings((s) => s.progress);
  const history = useSettings((s) => s.history);
  const loadModels = useSettings((s) => s.loadModels);
  const loadHistory = useSettings((s) => s.loadHistory);
  const bindProgress = useSettings((s) => s.bindProgress);
  const [done, setDone] = useState<Record<string, boolean>>({});
  /** Once every step is done the checklist collapses to a single
   *  "press ready" strip; the user can dismiss it for good. */
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("wf-setup-done") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sttCloud = config?.stt.provider === "cloud";
    const engineReady = statuses.some((s) => s.entryId === "whisper-bin-x64" && s.state === "downloaded");
    const modelReady =
      sttCloud ||
      statuses.some((s) => s.entryId === config?.stt.modelId && s.state === "downloaded");
    setDone({
      // The hotkey is only really "tested" once a dictation exists — history
      // fills only after real use, so a fresh install shows no false progress.
      hotkey: history.length > 0,
      engine: sttCloud || engineReady,
      models: sttCloud || modelReady,
      dictionary: (config?.dictionary.length ?? 0) > 0,
      snippet: (config?.commands.length ?? 0) > 0,
    });
  }, [statuses, config, progress, history]);

  const steps: Array<{ id: string; label: string; hint: string; action: () => void; actionLabel: string }> = [
    { id: "hotkey", label: "Test your hotkey", hint: "Dictate once — the overlay appears, the step checks itself", action: () => (window.location.hash = "#/shortcuts"), actionLabel: "Open" },
    { id: "engine", label: "Get the transcription engine", hint: "whisper.cpp binary (local) — or pick a cloud API in Models", action: () => (window.location.hash = "#/models"), actionLabel: "Open" },
    { id: "models", label: "Download a transcription model", hint: "The active model: " + (config?.stt.modelId ?? "—"), action: () => (window.location.hash = "#/models"), actionLabel: "Open" },
    { id: "dictionary", label: "Add dictionary words", hint: "Names and jargon it should never misspell", action: () => (window.location.hash = "#/dictionary"), actionLabel: "Open" },
    { id: "snippet", label: "Create a snippet", hint: "Text you re-type — email, intro, prompt", action: () => (window.location.hash = "#/commands"), actionLabel: "Open" },
  ];
  const completed = steps.filter((s) => done[s.id]).length;
  const pct = Math.round((completed / steps.length) * 100);
  const allDone = completed === steps.length;

  // ALL DONE → collapse to the ready strip. No more stuck 5/5 list.
  if (allDone || dismissed) {
    if (dismissed) return null;
    return (
      <div data-stage-row className="pk-spotlight card mb-6 flex items-center gap-3 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent bg-accent/15 text-accent" aria-hidden="true">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">The press is ready.</p>
          <p className="mt-0.5 text-xs text-ink-dim">
            All five set up — engine, model, hotkey, dictionary, snippets. Hold{" "}
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">your hotkey</kbd>{" "}
            anywhere and speak.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem("wf-setup-done", "1");
            } catch {
              /* session-only dismiss */
            }
            setDismissed(true);
          }}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-line-strong hover:text-ink"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div data-stage-row className="pk-spotlight card mb-6 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold">Set up WhisperFlow</p>
        <span className="text-xs text-ink-dim">{completed}/{steps.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 space-y-1">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={s.action}
            title={done[s.id] ? "Done — click to revisit" : undefined}
            className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              done[s.id] ? "opacity-70 hover:opacity-100" : ""
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
                done[s.id] ? "border-accent bg-accent text-accent-ink" : "border-line text-transparent"
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${done[s.id] ? "text-ink-dim line-through group-hover:no-underline" : "font-medium"}`}>
                {s.label}
                {done[s.id] && <span className="ml-2 hidden font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint group-hover:inline">revisit →</span>}
              </p>
              <p className="text-xs text-ink-dim">{s.hint}</p>
            </div>
            {!done[s.id] && (
              <span className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition-transform duration-150 group-hover:translate-x-0.5">
                {s.actionLabel}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Settings anatomy: rows of [label + value] with a Change button. */
function ChangeRow({ label, value, onChange }: { label: string; value: React.ReactNode; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 truncate text-xs leading-5 text-ink-dim">{value}</p>
      </div>
      <span className="pk-btn-wrap pk-btn-wrap-sm shrink-0">
        <button
          type="button"
          onClick={onChange}
          className="pk-btn pk-btn-plate"
        >
          <span className="pk-btn-ink" aria-hidden="true" />
          <span className="pk-btn-gloss" aria-hidden="true" />
          <span className="pk-btn-label">Change</span>
        </button>
      </span>
    </div>
  );
}

export function GeneralTab() {
  const config = useSettings((s) => s.config);
  const devices = useSettings((s) => s.devices);
  const version = useAppVersion();
  if (!config) return null;

  const go = (route: string) => {
    window.location.hash = `#/${route}`;
  };

  return (
    <section>
      <PageHeader title="Dictation" tagline="The essentials, in one place." />
      <SetupChecklist />
      <PressPrefsCard />
      <section aria-label="Theme">
        <h2 className="sec-mark mb-3">the theme press</h2>
        <p className="mb-3 max-w-[60ch] text-[12.5px] leading-relaxed text-ink-dim">
          Six prints of the same instrument — each theme is a full palette and a
          type cast (which font plays display). The rail, cards and palette all
          roll over when you pick; nothing else changes.
        </p>
        <ThemePicker />
      </section>
      <Card className="divide-y divide-line/70 p-0">
        <ChangeRow
          label="Shortcuts"
          value={
            config.hotkey.mode === "hold" ? (
              <>
                Hold{" "}
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
                  {config.hotkey.pushToTalk}
                </kbd>{" "}
                and speak; release to finish.
              </>
            ) : (
              <>
                Press{" "}
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
                  {config.hotkey.pushToTalk}
                </kbd>{" "}
                to start; press again or fall silent to finish.
              </>
            )
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
          value={languageSummary(config.stt)}
          onChange={() => go("audio")}
        />
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div>
            <p className="text-sm font-medium">App skin</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-dim">Lab (dark instrument) · Daylight (light)</p>
          </div>
          <select
            value={(() => {
              try {
                const saved = localStorage.getItem("wf-skin");
                if (saved === "lab" || saved === "daylight") return saved;
                // values written by the pre-redesign picker
                if (saved === "dawn" || saved === "nocturne") return saved === "dawn" ? "daylight" : "lab";
                return "lab";
              } catch {
                return "lab";
              }
            })()}
            onChange={(e) => {
              const skin = e.target.value as "lab" | "daylight";
              if (skin === "daylight") document.body.classList.add("light");
              else document.body.classList.remove("light");
              try {
                localStorage.setItem("wf-skin", skin);
              } catch {
                /* private mode */
              }
            }}
            className="rounded-lg border border-line bg-paper-2 px-3 py-2.5 font-mono text-[13px] outline-none transition-colors focus:border-phosphor/60"
          >
            <option value="lab">Lab — dark</option>
            <option value="daylight">Daylight — light</option>
          </select>
        </div>
        <ChangeRow
          label="Overlay & modes"
          value="Shape · position · backdrop · meeting mode · recorder"
          onChange={() => go("overlay")}
        />
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Save dictation history</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-dim">Stored locally only. Never synced.</p>
          </div>
          <Toggle
            checked={config.general.historyEnabled}
            onChange={(v) => void useSettings.getState().patchConfig({ general: { historyEnabled: v } })}
          />
        </div>
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Sync between machines</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-dim">
              {config.general.syncFolder
                ? "Config + dictionary sync to your own cloud folder. Never audio or history."
                : "Pick a OneDrive/Dropbox folder to sync config + dictionary between machines."}
            </p>
            {config.general.syncFolder ? (
              <p className="mt-1 truncate font-mono text-[11px] text-ink-dim/70">{config.general.syncFolder}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            {config.general.syncFolder ? (
              <button
                type="button"
                onClick={() => void useSettings.getState().patchConfig({ general: { syncFolder: "" } })}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium transition-colors hover:border-danger/50"
              >
                Turn off
              </button>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                const picked = await window.whisperflow.app.pickFolder({
                  title: "Choose the sync folder (OneDrive/Dropbox…)",
                });
                if (!picked.canceled && picked.path) {
                  void useSettings.getState().patchConfig({ general: { syncFolder: picked.path } });
                }
              }}
              className="shrink-0 rounded-lg border border-line bg-surface-2 px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent/50"
            >
              {config.general.syncFolder ? "Change…" : "Choose…"}
            </button>
          </div>
        </div>
      </Card>
      <p className="mt-5 text-xs leading-5 text-ink-dim">
        WhisperFlow v{version} · local-first · Apache-2.0 · zero telemetry
      </p>
    </section>
  );
}

/**
 * Summarises the selected language set for the Dictation row: "Auto-detect"
 * unless the user pinned one language with auto-detect off.
 */
export function languageSummary(stt: {
  language: string;
  languages?: string[];
  autoDetect?: boolean;
}): string {
  const langs = stt.languages ?? [];
  if (langs.length === 0)
    return stt.autoDetect === false && stt.language !== "auto" ? stt.language : "Auto-detect";
  if (stt.autoDetect !== false) return `Auto-detect · ${langs.join(", ")}`;
  return langs.length === 1 ? (langs[0] ?? "Auto-detect") : `${langs[0]!} +${langs.length - 1} more`;
}
