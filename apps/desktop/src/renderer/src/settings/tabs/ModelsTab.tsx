import { useEffect, useState } from "react";
import {
  CLOUD_STT_PRESETS,
  POLISH_CLOUD_PRESETS,
  type CustomModelEntry,
  type ModelCatalogEntry,
  type ModelRole,
} from "@whisperflow/shared";
import { useSettings } from "../store";
import { Button, Card, PageHeader, Select, TextInput } from "../../shared/ui";
import { formatBytes } from "../../shared/format";

type SttProvider = "whispercpp-local" | "cloud";

export function ModelsTab() {
  const config = useSettings((s) => s.config);
  const catalog = useSettings((s) => s.catalog);
  const statuses = useSettings((s) => s.statuses);
  const progress = useSettings((s) => s.progress);
  const hardware = useSettings((s) => s.hardware);
  const recommendation = useSettings((s) => s.recommendation);
  const loadModels = useSettings((s) => s.loadModels);
  const loadHardware = useSettings((s) => s.loadHardware);
  const loadConfig = useSettings((s) => s.loadConfig);
  const patch = useSettings((s) => s.patchConfig);
  const bindProgress = useSettings((s) => s.bindProgress);

  useEffect(() => {
    void loadModels();
    void loadHardware();
    void loadConfig();
    const unsub = bindProgress();
    return unsub;
  }, [loadModels, loadHardware, loadConfig, bindProgress]);

  const [showAll, setShowAll] = useState(false);

  if (!config) return null;

  const statusOf = (id: string) => statuses.find((s) => s.entryId === id);
  const downloaded = (id: string) => statusOf(id)?.state === "downloaded";
  const sttProvider: SttProvider = config.stt.provider;

  const isActive = (entry: ModelCatalogEntry): boolean =>
    entry.role === "stt" && entry.format !== "binary"
      ? config.stt.modelId === entry.id && sttProvider === "whispercpp-local"
      : entry.role === "polish"
        ? config.polish.modelId === entry.id && config.polish.provider !== "none"
        : false;

  const canActivate = (entry: ModelCatalogEntry): boolean =>
    (entry.role === "stt" && entry.format !== "binary") || entry.role === "polish";

  /** Entries in the user's tier order: recommended first, then the rest. */
  const ranked = (role: ModelRole | "binary"): ModelCatalogEntry[] => {
    const all = catalog.filter(
      (e) => (role === "binary" ? e.format === "binary" : e.role === role && e.format !== "binary"),
    );
    if (!hardware) return all;
    const want = new Set([recommendation?.stt, recommendation?.polish, recommendation?.vad]);
    return [...all].sort((a, b) => {
      const av = want.has(a.id) ? 0 : a.tiers.includes(hardware.tier) ? 1 : 2;
      const bv = want.has(b.id) ? 0 : b.tiers.includes(hardware.tier) ? 1 : 2;
      return av - bv;
    });
  };

  const downloadOne = (id: string) =>
    void window.whisperflow.models.download({ id }).then(loadModels).then(loadConfig).catch(() => loadModels());

  const recommendedIds = new Set(
    [recommendation?.stt, recommendation?.polish, recommendation?.vad, "whisper-bin-x64"].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const downloadRecommended = () => {
    for (const id of recommendedIds) if (!downloaded(id)) void downloadOne(id);
  };

  return (
    <section>
      <PageHeader
        title="Models"
        tagline="Open weights, straight to your machine."
        explainer="Everything downloads from HuggingFace / whisper.cpp releases. No accounts, no clouds. Or bring your own cloud key below."
      />

      <HardwareCard />

      {/* ---- engine source: local vs BYOK ---- */}
      <Card className="mb-6">
        <p className="text-[15px] font-semibold">Transcription engine</p>
        <p className="mt-1 text-sm text-ink-dim">
          Local keeps every word on this machine. Cloud sends audio to the key you supply — your
          account, your limits, never ours.
        </p>
        {/* segmented switch — the setting people actually flip */}
        <div
          role="radiogroup"
          aria-label="Transcription engine source"
          className="mt-4 inline-flex rounded-xl border border-line bg-surface-2 p-1"
        >
          {(
            [
              ["whispercpp-local", "Local", "whisper.cpp · offline"],
              ["cloud", "BYOK cloud", "your API key"],
            ] as const
          ).map(([value, label, hint]) => {
            const active = sttProvider === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => void patch({ stt: { provider: value as SttProvider } })}
                className={`rounded-lg px-4 py-2 text-left transition-colors ${
                  active ? "bg-accent text-accent-ink" : "text-ink-dim hover:text-ink"
                }`}
              >
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className={`block text-[10px] ${active ? "text-accent-ink/80" : "text-ink-dim/80"}`}>
                  {hint}
                </span>
              </button>
            );
          })}
        </div>

        {sttProvider === "cloud" && <CloudSttCard />}

        {/* fallback chain — explicit, because a silent fallback can leak audio */}
        <div className="mt-5 border-t border-line/60 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">If the engine fails</p>
              <p className="mt-0.5 max-w-md text-xs leading-5 text-ink-dim">
                {fallbackHint(sttProvider, config.stt.fallback)}
              </p>
            </div>
            <Select
              value={config.stt.fallback}
              onChange={(v) =>
                void patch({ stt: { fallback: v as "none" | "local" | "cloud" } })
              }
              options={[
                { value: "none", label: "Nothing — fail loudly" },
                {
                  value: "local",
                  label: sttProvider === "cloud" ? "Local whisper.cpp" : "Local whisper.cpp (already primary)",
                },
                { value: "cloud", label: "Cloud BYO key" },
              ].filter((o) => !(o.value === "local" && sttProvider === "whispercpp-local"))}
            />
          </div>
        </div>
      </Card>

      {sttProvider === "whispercpp-local" && (
        <>
          {hardware && recommendation && (
            <Card className="mb-6 border-accent/40">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold">
                  Recommended for this PC
                  <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {tierLabel(hardware.tier)} tier
                  </span>
                </p>
                <Button variant="ghost" onClick={downloadRecommended}>
                  Download recommended set
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-ink-dim">
                Picked from your RAM tier and the measured quality/size trade-offs. You can override
                any pick — this is a suggestion, not a lock.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Transcription", id: recommendation.stt },
                  { label: "Polish", id: recommendation.polish },
                  { label: "Voice activity", id: recommendation.vad },
                ].map(({ label, id }) => {
                  const entry = catalog.find((e) => e.id === id);
                  if (!entry) return null;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => !downloaded(id) && downloadOne(id)}
                      className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-left transition-colors hover:border-accent/50"
                    >
                      <p className="text-[11px] uppercase tracking-wider text-ink-dim">{label}</p>
                      <p className="mt-0.5 truncate text-sm font-medium">{entry.name.replace(/\s*\(.*\)/, "")}</p>
                      <p className="text-xs text-ink-dim">
                        {downloaded(id) ? "✓ on disk" : formatBytes(entry.sizeBytes)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <ModelGroup
            title="Engine binary"
            hint="The whisper.cpp program that transcribes locally — required, ~9 MB."
            entries={ranked("binary")}
            {...{ progress, downloaded, isActive, canActivate, downloadOne, loadModels, loadConfig }}
          />

          <ModelGroup
            title="Transcription models"
            hint="Whisper GGML weights from HuggingFace."
            entries={showAll ? ranked("stt") : ranked("stt").slice(0, 3)}
            {...{ progress, downloaded, isActive, canActivate, downloadOne, loadModels, loadConfig }}
          />

          <ModelGroup
            title="Polish models"
            hint="Small instruct LLMs (GGUF) that clean up your text — or use a cloud model below."
            entries={showAll ? ranked("polish") : ranked("polish").slice(0, 2)}
            {...{ progress, downloaded, isActive, canActivate, downloadOne, loadModels, loadConfig }}
          />

          <CloudPolishCard />

          <div className="mb-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {showAll ? "Show fewer" : `Show all models (${catalog.length})`}
            </button>
          </div>

          <CustomModelForm onAdded={() => void loadModels().then(() => void loadConfig())} />
          <CleanupCard />
        </>
      )}
      <BestPracticesCard />
    </section>
  );
}

function tierLabel(tier: string): string {
  return tier === "low" ? "Light" : tier === "mid" ? "Standard" : "Power";
}

function fallbackHint(primary: SttProvider, fallback: "none" | "local" | "cloud"): string {
  if (fallback === "none") {
    return primary === "cloud"
      ? "Cloud failures surface as an error and nothing is retried locally — no surprise switching."
      : "Local failures surface as an error. Nothing is ever sent to a network on your behalf.";
  }
  if (fallback === "local") {
    return "If the cloud call fails (quota, network, 5xx), that segment is re-transcribed on this machine. Audio only leaves the box for the attempt that already started.";
  }
  return "If the local engine fails, the segment goes to your cloud key. Requires a key + the local-only lock off.";
}

/** Disk hygiene: downloaded models nobody points at are dead weight. */
function CleanupCard() {
  const statuses = useSettings((s) => s.statuses);
  const config = useSettings((s) => s.config)!;
  const loadModels = useSettings((s) => s.loadModels);
  const loadConfig = useSettings((s) => s.loadConfig);
  const [result, setResult] = useState<string | null>(null);

  const keep = new Set([config.stt.modelId, config.polish.modelId, "whisper-bin-x64"]);
  const unused = statuses.filter((s) => s.state === "downloaded" && !keep.has(s.entryId));

  return (
    <Card className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Disk</p>
          <p className="mt-1 text-sm text-ink-dim">
            {unused.length === 0
              ? "No unused models on disk — everything downloaded is either active or the engine."
              : `${unused.length} downloaded model${unused.length === 1 ? "" : "s"} that nothing points at.`}
          </p>
        </div>
        <Button
          variant="ghost"
          disabled={unused.length === 0}
          onClick={async () => {
            const r = await window.whisperflow.models.deleteUnused();
            setResult(r.deleted.length ? `Removed ${r.deleted.length} model(s).` : "Nothing to remove.");
            await loadModels();
            await loadConfig();
          }}
        >
          Remove unused
        </Button>
      </div>
      {result && <p className="mt-2 text-xs text-accent">{result}</p>}
    </Card>
  );
}

/** Short, opinionated guidance — the things people get wrong first. */
function BestPracticesCard() {
  const items = [
    ["Small beats huge", "For dictation cleanup a 2–4B model is faster and more faithful than a 70B one. Bigger models rewrite your words."],
    ["One model per role", "Keep exactly one transcription model and one polish model active — extras just eat disk."],
    ["Local for sensitive audio", "Turn on the local-only lock (Privacy) when the audio must never touch a network. It hard-blocks cloud STT and remote polish."],
    ["Give the model a warm-up", "The first dictation after launch pays the model load; the second is the real speed. Judge latency on the second."],
    ["Test after switching", "Change a model → dictate one sentence in Notepad. It takes 5 seconds and proves the whole chain (mic → STT → polish → paste)."],
    ["Keep the dictionary small", "10–30 names/jargon terms help; 500 hurt accuracy. The dictionary biases spelling, it isn't a thesaurus."],
  ] as const;

  return (
    <Card className="mb-8">
      <p className="text-[15px] font-semibold">Best practices</p>
      <ul className="mt-3 space-y-3">
        {items.map(([title, body]) => (
          <li key={title} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <p className="text-[13px] leading-5 text-ink-dim">
              <span className="font-semibold text-ink">{title}.</span> {body}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The user's machine, front and center — no guessing what fits. */
function HardwareCard() {
  const hardware = useSettings((s) => s.hardware);
  if (!hardware) return null;
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-dim">Processor</p>
          <p className="text-sm font-medium">{hardware.cpu}</p>
          <p className="text-xs text-ink-dim">{hardware.cores} cores</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-dim">Memory</p>
          <p className="text-sm font-medium">{hardware.totalMemGb} GB</p>
          <p className="text-xs text-ink-dim">
            {hardware.totalMemGb < 8
              ? "light tier — pick small models"
              : hardware.totalMemGb < 17.2
                ? "standard tier"
                : "power tier — anything here fits"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-dim">Graphics</p>
          <p className="text-sm font-medium">{hardware.gpu}</p>
        </div>
      </div>
    </Card>
  );
}

function CloudSttCard() {
  const config = useSettings((s) => s.config)!;
  const patch = useSettings((s) => s.patchConfig);
  const cloud = config.stt.cloud;
  const preset = CLOUD_STT_PRESETS[cloud.provider];
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const models = cloud.provider === "custom" ? [] : preset.models;
  const activeModel = cloud.model || preset.defaultModel;

  return (
    <div className="mt-4 space-y-3 border-t border-line/60 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">Provider</p>
          <Select
            value={cloud.provider}
            onChange={(v) => void patch({ stt: { cloud: { provider: v as typeof cloud.provider } } })}
            options={(Object.keys(CLOUD_STT_PRESETS) as Array<keyof typeof CLOUD_STT_PRESETS>).map((p) => ({
              value: p,
              label: CLOUD_STT_PRESETS[p].label,
            }))}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">Model</p>
          {models.length > 0 ? (
            <Select
              value={activeModel}
              onChange={(v) => void patch({ stt: { cloud: { model: v } } })}
              options={models.map((m) => ({ value: m, label: m }))}
            />
          ) : (
            <TextInput
              value={cloud.model}
              onChange={(v) => void patch({ stt: { cloud: { model: v } } })}
              placeholder="model id, e.g. whisper-large-v3"
            />
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">
            Base URL {cloud.provider !== "custom" && "(blank = default)"}
          </p>
          <TextInput
            value={cloud.baseUrl}
            onChange={(v) => void patch({ stt: { cloud: { baseUrl: v } } })}
            placeholder={preset.baseUrl || "https://your-endpoint/v1"}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">API key</p>
          <TextInput
            type="password"
            value={cloud.apiKey}
            onChange={(v) => void patch({ stt: { cloud: { apiKey: v } } })}
            placeholder="stored locally only"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          disabled={testing || !cloud.apiKey}
          onClick={async () => {
            setTesting(true);
            setResult(null);
            try {
              const r = await window.whisperflow.stt.test();
              setResult(`${r.ok ? "✓" : "✗"} ${r.message}`);
            } catch (err) {
              setResult(`✗ ${String(err).slice(0, 80)}`);
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? "Testing…" : "Test key"}
        </Button>
        {result && <span className="text-xs text-ink-dim">{result}</span>}
        {config.privacy.localOnly && (
          <span className="text-xs text-red-400">Local-only lock is on — cloud STT is blocked.</span>
        )}
      </div>
      <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs leading-5 text-ink-dim">
        <span className="font-semibold text-ink">{preset.label}.</span> {preset.freeNote}
        {preset.docs && (
          <>
            {" "}
            <a href={preset.docs} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Provider docs ↗
            </a>
          </>
        )}
        <span className="block pt-1 text-[10px] uppercase tracking-wider text-ink-dim/70">
          limits verified {preset.verified} — they change; check before relying on them
        </span>
      </p>
      <p className="text-xs leading-5 text-ink-dim">
        Your key is written to your local config only and is sent to nothing but the endpoint above.
        A transcription request posts a short WAV per utterance — no accounts, no identifiers.
      </p>
    </div>
  );
}

/**
 * Cloud polish — the same picker as cloud STT (asked for explicitly: polish
 * models should be available via cloud APIs too). Picking a provider flips
 * the polish engine to the remote endpoint; the local GGUF remains the
 * fallback when "Fall back to the local model" is on (Advanced tab).
 */
function CloudPolishCard() {
  const config = useSettings((s) => s.config)!;
  const patch = useSettings((s) => s.patchConfig);
  const cloud = config.polish.remote;
  const providerId = (cloud.provider ?? "custom") as keyof typeof POLISH_CLOUD_PRESETS;
  const preset = POLISH_CLOUD_PRESETS[providerId];
  const models = providerId === "custom" ? [] : preset.models;
  const activeModel = cloud.model || preset.defaultModel;
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onProvider = (p: keyof typeof POLISH_CLOUD_PRESETS) => {
    const next: Record<string, unknown> = { provider: p };
    if (p !== "custom") {
      next.baseUrl = preset2(p).baseUrl;
      next.model = preset2(p).defaultModel;
    }
    // Choosing a cloud provider activates the remote polish engine; choosing
    // "custom" leaves the engine alone so nothing flips unexpectedly.
    void patch({ polish: { remote: next, ...(p !== "custom" ? { provider: "openai-compat" } : {}) } });
  };
  const preset2 = (p: keyof typeof POLISH_CLOUD_PRESETS) => POLISH_CLOUD_PRESETS[p];

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await window.whisperflowExtras.app.testCloudPolish();
      setResult(`${r.ok ? "✓" : "✗"} ${r.message}`);
    } catch (err) {
      setResult(`✗ ${String(err).slice(0, 80)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t border-line/60 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-ink-dim">…or a cloud polish model</p>
        {config.polish.provider === "openai-compat" ? (
          <span className="text-xs text-accent">In use — remote endpoint active</span>
        ) : (
          <span className="text-xs text-ink-dim">Picking a provider activates it</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">Provider</p>
          <Select
            value={providerId}
            onChange={(v) => onProvider(v as keyof typeof POLISH_CLOUD_PRESETS)}
            options={(Object.keys(POLISH_CLOUD_PRESETS) as Array<keyof typeof POLISH_CLOUD_PRESETS>).map((p) => ({
              value: p,
              label: POLISH_CLOUD_PRESETS[p].label,
            }))}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">Model</p>
          {models.length > 0 ? (
            <Select
              value={activeModel}
              onChange={(v) => void patch({ polish: { remote: { model: v } } })}
              options={models.map((m) => ({ value: m, label: m }))}
            />
          ) : (
            <TextInput
              value={cloud.model}
              onChange={(v) => void patch({ polish: { remote: { model: v } } })}
              placeholder="model id, e.g. gpt-6-luna"
            />
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">
            Base URL {providerId !== "custom" && "(blank = default)"}
          </p>
          <TextInput
            value={cloud.baseUrl}
            onChange={(v) => void patch({ polish: { remote: { baseUrl: v } } })}
            placeholder={preset.baseUrl || "https://your-endpoint/v1"}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">API key</p>
          <TextInput
            type="password"
            value={cloud.apiKey}
            onChange={(v) => void patch({ polish: { remote: { apiKey: v } } })}
            placeholder="stored locally only"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" disabled={testing} onClick={() => void test()}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {result && <span className="text-xs text-ink-dim">{result}</span>}
        {config.privacy.localOnly && (
          <span className="text-xs text-red-400">Local-only lock is on — cloud polish is blocked.</span>
        )}
      </div>
      <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs leading-5 text-ink-dim">
        <span className="font-semibold text-ink">{preset.label}.</span> {preset.freeNote}
      </p>
    </div>
  );
}

interface ModelGroupProps {
  title: string;
  hint: string;
  entries: ModelCatalogEntry[];
  progress: ReturnType<typeof useSettings.getState>["progress"];
  downloaded: (id: string) => boolean;
  isActive: (e: ModelCatalogEntry) => boolean;
  canActivate: (e: ModelCatalogEntry) => boolean;
  downloadOne: (id: string) => void;
  loadModels: () => Promise<void>;
  loadConfig: () => Promise<void>;
}

function ModelGroup({
  title,
  hint,
  entries,
  progress,
  downloaded,
  isActive,
  canActivate,
  downloadOne,
  loadModels,
  loadConfig,
}: ModelGroupProps) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-8">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-dim">{title}</h3>
      <p className="mb-3 text-xs text-ink-dim/80">{hint}</p>
      <div className="space-y-3">
        {entries.map((entry) => {
          const prog = progress[entry.id];
          const busy = prog?.state === "downloading";
          const active = isActive(entry);
          return (
            <Card key={entry.id} className={active ? "border-accent/60" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {entry.name}
                    {active && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        ACTIVE
                      </span>
                    )}
                    {downloaded(entry.id) && !active && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-dim">
                        downloaded
                      </span>
                    )}
                    {entry.custom && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-dim">custom</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-dim">
                    {formatBytes(entry.sizeBytes)} · {entry.license ?? "?"} · {entry.repo}
                  </p>
                  {entry.notes && <p className="mt-1 text-xs text-ink-dim/80">{entry.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {busy ? (
                    <span className="text-xs text-ink-dim">
                      {Math.round((prog.receivedBytes / (prog.totalBytes ?? entry.sizeBytes ?? 1)) * 100 || 0)}%
                    </span>
                  ) : downloaded(entry.id) ? (
                    <>
                      {canActivate(entry) && !active && (
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
                      <Button
                        variant="danger"
                        onClick={() =>
                          void window.whisperflow.models.delete({ id: entry.id }).then(loadModels).then(loadConfig)
                        }
                      >
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => downloadOne(entry.id)}>Download</Button>
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
  );
}

/** User-added model from any HuggingFace repo — glued onto the catalog. */
function CustomModelForm({ onAdded }: { onAdded: () => void }) {
  const patch = useSettings((s) => s.patchConfig);
  const config = useSettings((s) => s.config)!;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    repo: "",
    file: "",
    role: "stt" as "stt" | "polish",
    note: "",
  });

  const submit = async () => {
    if (!form.name || !form.repo || !form.file) return;
    const entry: CustomModelEntry = {
      id: `custom-${Date.now()}`,
      role: form.role,
      name: form.name,
      repo: form.repo,
      file: form.file,
      url: `https://huggingface.co/${form.repo}/resolve/main/${form.file}`,
      format: form.role === "stt" ? "ggml" : "gguf",
      ...(form.note ? { notes: form.note } : {}),
    };
    await patch({ models: { custom: [...config.models.custom, entry] } });
    setForm({ name: "", repo: "", file: "", role: "stt", note: "" });
    setOpen(false);
    onAdded();
  };

  if (!open) {
    return (
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-dashed border-line py-4 text-sm font-medium text-ink-dim transition-colors hover:border-accent/50 hover:text-ink"
        >
          + Add a custom model from HuggingFace
        </button>
      </div>
    );
  }
  return (
    <Card className="mb-8">
      <p className="text-[15px] font-semibold">Add a custom model</p>
      <p className="mt-1 text-xs text-ink-dim">
        Point at any GGML (STT) or GGUF (polish) file on HuggingFace. It downloads, shows in the
        list, and works exactly like the built-ins.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Name — e.g. Whisper tiny" />
        <TextInput value={form.repo} onChange={(v) => setForm({ ...form, repo: v })} placeholder="HF repo — org/model" />
        <TextInput value={form.file} onChange={(v) => setForm({ ...form, file: v })} placeholder="File — ggml-tiny.bin" />
        <Select
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v as "stt" | "polish" })}
          options={[
            { value: "stt", label: "Transcription (GGML)" },
            { value: "polish", label: "Polish (GGUF)" },
          ]}
        />
      </div>
      <TextInput
        className="mt-3"
        value={form.note}
        onChange={(v) => setForm({ ...form, note: v })}
        placeholder="Note (optional)"
      />
      <div className="mt-4 flex gap-2">
        <Button onClick={() => void submit()}>Add to catalog</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
