import { useEffect, useState } from "react";
import type { ModelCatalogEntry } from "@whisperflow/shared";
import { useSettings } from "./store";
import { Button, Card, Spinner } from "../shared/ui";
import { formatBytes } from "../shared/format";

const STEPS = ["Microphone", "Speech engine", "Downloads", "Your first dictation"] as const;

const LANGUAGES = [
  ["auto", "Auto-detect (recommended)"],
  ["en", "English"],
  ["hi", "Hindi"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
] as const;

const SENSITIVITY_PRESETS: Array<{ label: string; hint: string; value: number }> = [
  { label: "Gentle", hint: "quiet rooms", value: 0.3 },
  { label: "Balanced", hint: "recommended", value: 0.5 },
  { label: "Eager", hint: "noisy spaces", value: 0.75 },
];

/** Approximate device RAM in GiB (Chromium caps the value). */
function deviceRamGb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? 8;
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  // Reference-style skip-ahead card: quick version vs full tour.
  if (!skipped) {
    return (
      <div className="mx-auto flex h-screen max-w-md flex-col justify-center px-6">
        <div className="card p-8">
          <h1 className="font-display text-3xl">New here?</h1>
          <p className="mt-3 text-sm leading-6 text-ink-dim">
            Want the quick version? We'll set up the essentials and let you explore the rest
            later — or take the full tour with every option explained.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setSkipped(true);
              }}
            >
              Show me everything
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.setItem("wf-onboarded", "1");
                window.location.hash = "/general";
              }}
            >
              Skip onboarding
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-screen max-w-xl flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i <= step ? "bg-accent text-bg" : "bg-surface-2 text-ink-dim"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-xs ${i === step ? "text-ink" : "text-ink-dim"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
          </div>
        ))}
      </div>
      <div className="card p-8">
        {step === 0 && <MicStep onDone={() => setStep(1)} />}
        {step === 1 && <ConfigureStep onDone={() => setStep(2)} />}
        {step === 2 && <ModelsStep onDone={() => setStep(3)} />}
        {step === 3 && <FinishStep />}
      </div>
    </div>
  );
}

function MicStep({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  const test = async () => {
    setState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setState("ok");
    } catch {
      setState("fail");
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold">Allow the microphone</h1>
      <p className="mt-2 text-sm leading-6 text-ink-dim">
        Audio is processed on this machine only. Windows may ask for a privacy permission — that
        prompt comes from the OS, not us.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => void test()} disabled={state === "testing"}>
          {state === "testing" ? <Spinner /> : state === "ok" ? "Test again" : "Test microphone"}
        </Button>
        {state === "ok" && <span className="text-sm text-accent">✓ Microphone works</span>}
        {state === "fail" && (
          <span className="text-sm text-red-400">Blocked — check Windows Settings → Privacy → Microphone</span>
        )}
        <Button variant="ghost" onClick={onDone} disabled={state !== "ok"}>
          Continue
        </Button>
      </div>
    </div>
  );
}

/** Step 2 — the full ASR configuration board before first launch. */
function ConfigureStep({ onDone }: { onDone: () => void }) {
  const config = useSettings((s) => s.config);
  const catalog = useSettings((s) => s.catalog);
  const loadModels = useSettings((s) => s.loadModels);
  const patch = useSettings((s) => s.patchConfig);
  const ramGb = deviceRamGb();

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  if (!config) return null;

  const sttModels = catalog.filter((e) => e.role === "stt" && e.format === "ggml");
  const suggested = ramGb <= 8 ? "whisper-base.en" : ramGb <= 16 ? "whisper-small" : "whisper-large-v3-turbo";

  return (
    <div>
      <h1 className="text-xl font-bold">Configure your speech engine</h1>
      <p className="mt-2 text-sm leading-6 text-ink-dim">
        Everything runs locally with open models. This machine reports ~{ramGb} GB RAM — you can
        change any of this later in Settings.
      </p>

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">Engine</p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["whispercpp-local", "On this machine — whisper.cpp (downloads ~500 MB)"],
            ["cloud", "Cloud API — bring your own key (Groq free tier works)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => void patch({ stt: { provider: value } })}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              config.stt.provider === value
                ? "border-accent/70 bg-accent/10"
                : "border-line bg-surface-2/50 hover:border-accent/40"
            }`}
          >
            {value === "whispercpp-local" ? "Local" : "Cloud (BYOK)"}
            <span className="mt-1 block text-xs leading-4 text-ink-dim">{label}</span>
          </button>
        ))}
      </div>

      {config.stt.provider === "cloud" && (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2/50 p-4">
          <p className="text-xs leading-5 text-ink-dim">
            Paste a Groq API key (console.groq.com/keys — free tier is generous and fast). Your key is
            stored on this machine only. You can fine-tune this later in Settings → Models.
          </p>
          <input
            type="password"
            value={config.stt.cloud.apiKey}
            onChange={(e) => void patch({ stt: { cloud: { apiKey: e.target.value } } })}
            placeholder="gsk_…"
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </div>
      )}

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">Language</p>
      <div className="grid grid-cols-3 gap-2">
        {LANGUAGES.slice(0, 6).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => void patch({ stt: { language: value } })}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              config.stt.language === value
                ? "border-accent/70 bg-accent/10 text-ink"
                : "border-line bg-surface-2/60 text-ink-dim hover:border-accent/40"
            }`}
          >
            {label.split(" (")[0]}
          </button>
        ))}
      </div>
      <select
        value={config.stt.language}
        onChange={(e) => void patch({ stt: { language: e.target.value } })}
        className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
      >
        {LANGUAGES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">
        Transcription model
      </p>
      <div className="space-y-2">
        {sttModels.map((model: ModelCatalogEntry) => (
          <button
            key={model.id}
            type="button"
            onClick={() => void patch({ stt: { modelId: model.id } })}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
              config.stt.modelId === model.id
                ? "border-accent/70 bg-accent/10"
                : "border-line bg-surface-2/50 hover:border-accent/40"
            }`}
          >
            <span>
              <span className="block text-sm font-medium">{model.name}</span>
              <span className="block text-xs text-ink-dim">{model.notes}</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-ink-dim">
              {model.id === suggested && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">
                  suggested
                </span>
              )}
              {formatBytes(model.sizeBytes)}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">
        Microphone sensitivity
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SENSITIVITY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => void patch({ audio: { vad: { sensitivity: preset.value } } })}
            className={`rounded-lg border px-3 py-2 text-center transition-colors ${
              config.audio.vad.sensitivity === preset.value
                ? "border-accent/70 bg-accent/10"
                : "border-line bg-surface-2/60 hover:border-accent/40"
            }`}
          >
            <span className="block text-sm">{preset.label}</span>
            <span className="block text-[11px] text-ink-dim">{preset.hint}</span>
          </button>
        ))}
      </div>

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">AI polish</p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["llama-local", "On — clean up filler & punctuation (downloads a ~2 GB model)"],
            ["none", "Off — minimal offline cleanup only (lightest)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => void patch({ polish: { provider: value } })}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
              config.polish.provider === value
                ? "border-accent/70 bg-accent/10"
                : "border-line bg-surface-2/50 hover:border-accent/40"
            }`}
          >
            {value === "llama-local" ? "Polish on" : "Polish off"}
            <span className="mt-1 block text-xs leading-4 text-ink-dim">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-7">
        <Button onClick={onDone}>Continue to downloads</Button>
      </div>
    </div>
  );
}

function ModelsStep({ onDone }: { onDone: () => void }) {
  const config = useSettings((s) => s.config);
  const catalog = useSettings((s) => s.catalog);
  const statuses = useSettings((s) => s.statuses);
  const progress = useSettings((s) => s.progress);
  const loadModels = useSettings((s) => s.loadModels);
  const bindProgress = useSettings((s) => s.bindProgress);

  useEffect(() => {
    void loadModels();
    return bindProgress();
  }, [loadModels, bindProgress]);

  const isCloud = config?.stt.provider === "cloud";
  const wanted = isCloud ? [] : ["whisper-bin-x64", config?.stt.modelId ?? "whisper-small"];
  const required = catalog.filter((e) => wanted.includes(e.id));
  const ready = isCloud || (required.length > 0 && required.every((e) => statuses.find((s) => s.entryId === e.id)?.state === "downloaded"));
  const downloading = required.some((e) => progress[e.id]?.state === "downloading");

  return (
    <div>
      <h1 className="text-xl font-bold">{isCloud ? "Cloud engine ready" : "Download your engine"}</h1>
      <p className="mt-2 text-sm leading-6 text-ink-dim">
        {isCloud
          ? "Transcription runs on your cloud key — nothing to download. Press continue when you're set."
          : "Straight from HuggingFace / whisper.cpp to this machine — resumable, cached, yours offline forever."}
      </p>
      <div className="mt-5 space-y-3">
        {required.map((entry) => {
          const done = statuses.find((s) => s.entryId === entry.id)?.state === "downloaded";
          const prog = progress[entry.id];
          return (
            <div key={entry.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2/50 px-4 py-3">
              <div className="min-w-0 pr-4">
                <p className="truncate text-sm font-medium">{entry.name}</p>
                <p className="text-xs text-ink-dim">{formatBytes(entry.sizeBytes)}</p>
                {prog?.state === "downloading" && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full bg-accent"
                      style={{
                        width: `${Math.min(100, (prog.receivedBytes / (prog.totalBytes ?? entry.sizeBytes ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              {done ? (
                <span className="text-sm text-accent">✓</span>
              ) : (
                <Button onClick={() => void window.whisperflow.models.download({ id: entry.id })}>
                  {prog?.state === "downloading" ? "Downloading…" : "Download"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        <Button onClick={onDone} disabled={!ready || downloading}>
          {ready ? "Continue" : downloading ? "Downloading…" : "Download everything to continue"}
        </Button>
      </div>
    </div>
  );
}

function FinishStep() {
  const config = useSettings((s) => s.config);
  return (
    <div>
      <h1 className="text-xl font-bold">You're ready</h1>
      <p className="mt-2 text-sm leading-6 text-ink-dim">
        Open any app with a text field — Notepad counts — and press the hotkey. Speak a sentence,
        pause, and polished text appears at your cursor. Press it again mid-dictation to finish
        early; <span className="text-ink">Esc</span> cancels.
      </p>
      <div className="mt-5 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-widest text-ink-dim">Your dictation hotkey</p>
        <p className="mt-1 font-mono text-lg">{config?.hotkey.pushToTalk ?? "Control+Shift+Space"}</p>
      </div>
      <div className="mt-6">
        <Button
          onClick={() => {
            localStorage.setItem("wf-onboarded", "1");
            window.location.hash = "/general";
          }}
        >
          Start dictating
        </Button>
      </div>
    </div>
  );
}
