import { useCallback, useEffect, useState } from "react";
import type { DiagnosticCheckDto, AppDiagnoseResponse } from "@whisperflow/shared";
import { Card, PageHeader, Spinner } from "../../shared/ui";

/**
 * Health — the first screen to open when dictation misbehaves.
 *
 * Built because the only previous recourse was reading log files. Every check
 * says what it looked at, and every failing check carries the fix plus a link
 * to the screen that resolves it.
 */

const LEVEL_ORDER: Record<DiagnosticCheckDto["level"], number> = { fail: 0, warn: 1, ok: 2 };

const LEVEL_STYLE = {
  fail: {
    ring: "border-red-500/40 bg-red-500/5",
    dot: "bg-red-400",
    label: "Blocking",
    labelCx: "text-red-400",
  },
  warn: {
    ring: "border-amber-500/40 bg-amber-500/5",
    dot: "bg-amber-400",
    label: "Degraded",
    labelCx: "text-amber-400",
  },
  ok: {
    ring: "border-line bg-surface",
    dot: "bg-emerald-400",
    label: "Ready",
    labelCx: "text-emerald-400",
  },
} as const;

export function DiagnoseTab() {
  const [report, setReport] = useState<AppDiagnoseResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [micCount, setMicCount] = useState<number | undefined>(undefined);

  /** The renderer is the only place with mediaDevices, so it answers the
   *  microphone question and the main process takes that as input. */
  const run = useCallback(async () => {
    setBusy(true);
    let available = true;
    let count: number | undefined;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      count = inputs.length;
      available = inputs.length > 0;
    } catch {
      available = false;
    }
    setMicCount(count);
    try {
      const next = await window.whisperflow.app.diagnose({ micAvailable: available, micCount: count });
      setReport(next);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const checks = report ? [...report.checks].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]) : [];
  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;

  return (
    <section>
      <PageHeader
        title="Health"
        tagline={
          busy
            ? "Checking…"
            : fails > 0
              ? "Dictation is blocked — fix the items below."
              : warns > 0
                ? "Dictation works. Some extras are degraded."
                : "Everything is ready."
        }
        explainer="Each check names what it looked at and what to do about it. Nothing here leaves your machine."
        actions={
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-full bg-pill px-3 text-[13px] font-medium text-ink transition-opacity hover:opacity-85 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
            Re-run checks
          </button>
        }
      />

      {busy && !report ? (
        <Card className="flex items-center gap-3 p-5 text-[13px] text-ink-dim">
          <Spinner /> Running setup checks…
        </Card>
      ) : null}

      {report ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">Blocking</p>
              <p className={`font-display mt-1 text-2xl ${fails > 0 ? "text-red-400" : ""}`}>{fails}</p>
            </Card>
            <Card className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">Degraded</p>
              <p className={`font-display mt-1 text-2xl ${warns > 0 ? "text-amber-400" : ""}`}>{warns}</p>
            </Card>
            <Card className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">Microphones</p>
              <p className="font-display mt-1 text-2xl">{micCount ?? "—"}</p>
            </Card>
          </div>

          <div className="flex flex-col gap-2.5">
            {checks.map((check) => {
              const style = LEVEL_STYLE[check.level];
              return (
                <div key={check.id} className={`rounded-xl border p-4 ${style.ring}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <p className="text-[14px] font-medium leading-5">{check.title}</p>
                        <span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${style.labelCx}`}>
                          {style.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-6 text-ink-dim">{check.detail}</p>
                      {check.fix ? (
                        <p className="mt-1.5 text-[13px] leading-6">
                          <span className="font-medium">Fix: </span>
                          {check.fix}
                          {check.tab ? (
                            <a
                              href={`#/${check.tab}`}
                              className="ml-1.5 font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
                            >
                              Open settings
                            </a>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">
            {checks.length} checks · re-run after changing anything
          </p>
        </>
      ) : null}
    </section>
  );
}
