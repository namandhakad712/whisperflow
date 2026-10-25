import { useEffect } from "react";
import type { ModelCatalogEntry, ModelRole } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Button, Card, PageHeader, Spinner } from "../../shared/ui";
import { formatBytes } from "../../shared/format";

const GROUPS: Array<{ role: ModelRole | "binary"; title: string; hint: string }> = [
  { role: "binary", title: "Engine binary", hint: "The whisper.cpp program that transcribes locally." },
  { role: "stt", title: "Transcription models", hint: "Whisper GGML weights from HuggingFace." },
  { role: "polish", title: "Polish models", hint: "Small instruct LLMs (GGUF) that clean up your text." },
  { role: "vad", title: "Voice detection (optional)", hint: "Upgrade over the built-in energy VAD." },
];

export function ModelsTab() {
  const config = useSettings((s) => s.config);
  const catalog = useSettings((s) => s.catalog);
  const statuses = useSettings((s) => s.statuses);
  const progress = useSettings((s) => s.progress);
  const loadModels = useSettings((s) => s.loadModels);
  const loadConfig = useSettings((s) => s.loadConfig);
  const bindProgress = useSettings((s) => s.bindProgress);

  useEffect(() => {
    void loadModels();
    const unsub = bindProgress();
    return unsub;
  }, [loadModels, bindProgress]);

  if (!config) return null;

  const statusOf = (id: string) => statuses.find((s) => s.entryId === id);
  const downloaded = (id: string) => statusOf(id)?.state === "downloaded";

  const isActive = (entry: ModelCatalogEntry): boolean =>
    entry.role === "stt" && entry.format !== "binary"
      ? config.stt.modelId === entry.id
      : entry.role === "polish"
        ? config.polish.modelId === entry.id && config.polish.provider !== "none"
        : false;

  const canActivate = (entry: ModelCatalogEntry): boolean =>
    (entry.role === "stt" && entry.format !== "binary") || entry.role === "polish";

  const groups = GROUPS.map((g) => ({
    ...g,
    entries: catalog.filter((e) =>
      g.role === "binary" ? e.format === "binary" : e.role === g.role && e.format !== "binary",
    ),
  }));

  return (
    <section>
      <PageHeader
        title="Models"
        tagline="Open weights, straight to your machine."
        explainer="Everything downloads from HuggingFace / whisper.cpp releases. No accounts, no clouds."
      />
      {groups.map((group) =>
        group.entries.length === 0 ? null : (
          <div key={group.title} className="mb-8">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-dim">{group.title}</h3>
            <p className="mb-3 text-xs text-ink-dim/80">{group.hint}</p>
            <div className="space-y-3">
              {group.entries.map((entry) => {
                const prog = progress[entry.id];
                const busy = prog?.state === "downloading";
                return (
                  <Card key={entry.id} className={isActive(entry) ? "border-accent/60" : ""}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          {entry.name}
                          {isActive(entry) && (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                              ACTIVE
                            </span>
                          )}
                          {downloaded(entry.id) && !isActive(entry) && (
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-dim">
                              downloaded
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-ink-dim">
                          {formatBytes(entry.sizeBytes)} · {entry.license ?? "?"} · {entry.repo}
                        </p>
                        {entry.notes && <p className="mt-1 text-xs text-ink-dim/80">{entry.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {busy ? (
                          <span className="flex items-center gap-2 text-xs text-ink-dim">
                            <Spinner className="h-3.5 w-3.5" />
                            {Math.round(
                              ((prog.receivedBytes / (prog.totalBytes ?? entry.sizeBytes ?? 1)) * 100 || 0),
                            )}
                            %
                          </span>
                        ) : downloaded(entry.id) ? (
                          <>
                            {canActivate(entry) && !isActive(entry) && (
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  void window.whisperflow.models
                                    .setActive({ role: entry.role, id: entry.id })
                                    .then(loadConfig)
                                }
                              >
                                Set active
                              </Button>
                            )}
                            <Button variant="danger" onClick={() => void window.whisperflow.models.delete({ id: entry.id }).then(loadModels)}>
                              Delete
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => void window.whisperflow.models.download({ id: entry.id }).then(loadModels).catch(() => loadModels())}
                          >
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                    {busy && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-accent transition-[width]"
                          style={{
                            width: `${Math.min(100, (prog.receivedBytes / (prog.totalBytes ?? entry.sizeBytes ?? 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                    {prog?.state === "error" && (
                      <p className="mt-2 text-xs text-red-400">Download failed: {prog.error ?? "unknown error"}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ),
      )}
    </section>
  );
}
