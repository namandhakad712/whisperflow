import { useEffect, useState } from "react";
import { useSettings } from "./store";
import { Button, Card, Spinner } from "../shared/ui";
import { formatBytes } from "../shared/format";

const STEPS = ["Microphone", "Models", "Your first dictation"] as const;

export function Onboarding() {
  const [step, setStep] = useState(0);
  return (
    <div className="mx-auto flex h-screen max-w-xl flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step ? "bg-accent text-bg" : "bg-surface-2 text-ink-dim"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-xs ${i === step ? "text-ink" : "text-ink-dim"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-line" />}
          </div>
        ))}
      </div>
      <Card className="p-8">
        {step === 0 && <MicStep onDone={() => setStep(1)} />}
        {step === 1 && <ModelsStep onDone={() => setStep(2)} />}
        {step === 2 && <FinishStep />}
      </Card>
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

function ModelsStep({ onDone }: { onDone: () => void }) {
  const catalog = useSettings((s) => s.catalog);
  const statuses = useSettings((s) => s.statuses);
  const progress = useSettings((s) => s.progress);
  const loadModels = useSettings((s) => s.loadModels);
  const bindProgress = useSettings((s) => s.bindProgress);

  useEffect(() => {
    void loadModels();
    return bindProgress();
  }, [loadModels, bindProgress]);

  const required = catalog.filter((e) => ["whisper-bin-x64", "whisper-small"].includes(e.id));
  const ready =
    required.length === 2 &&
    required.every((e) => statuses.find((s) => s.entryId === e.id)?.state === "downloaded");
  const downloading = required.some((e) => progress[e.id]?.state === "downloading");

  return (
    <div>
      <h1 className="text-xl font-bold">Download the local engine</h1>
      <p className="mt-2 text-sm leading-6 text-ink-dim">
        Two downloads from HuggingFace / whisper.cpp — straight to your machine, resumable, used
        offline forever. Polish models can wait; add them later in Settings → Models.
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
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={onDone} disabled={!ready || downloading}>
          {ready ? "Continue" : downloading ? "Downloading…" : "Download both to continue"}
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
