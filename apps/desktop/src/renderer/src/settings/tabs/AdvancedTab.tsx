import { useState } from "react";
import { POLISH_CLOUD_PRESETS, type PolishCloudProviderId, type WhisperFlowConfig } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Button, PageHeader, Row, Select, SettingGroup, TextInput, Toggle } from "../../shared/ui";

/** Style contexts: each context picks the polish tone; custom instructions
 *  override per context. */
const CONTEXTS = ["Personal messages", "Work messages", "Email", "Other"] as const;
type Context = (typeof CONTEXTS)[number];

const CONTEXT_TONE: Record<Context, WhisperFlowConfig["polish"]["tone"]> = {
  "Personal messages": "casual",
  "Work messages": "professional",
  Email: "neutral",
  Other: "custom",
};

export function AdvancedTab() {
  const config = useSettings((s) => s.config);
  const patch = useSettings((s) => s.patchConfig);
  const [context, setContext] = useState<Context>("Personal messages");
  if (!config) return null;

  const provider = config.polish.provider;
  const autoCleanup = provider !== "none";

  return (
    <section>
      <PageHeader
        title="Style"
        segmented={[...CONTEXTS]}
        activeSeg={context}
        onSegChange={(c) => setContext(c as Context)}
        tagline="Make WhisperFlow sound like you."
        explainer="Pick a writing style per context — say it once, and every dictation follows it."
      />

      <SettingGroup title="Cleanup" hint="How the polish model shapes what you said.">
        <Row label="Auto cleanup" hint="Remove filler words and fix punctuation on every dictation.">
          <Toggle
            checked={autoCleanup}
            onChange={(v) => void patch({ polish: { provider: v ? "llama-local" : "none" } })}
          />
        </Row>
        <Row label="Cleanup strength" hint="Choose a level — the labels say what each one does.">
          <Select
            value={config.polish.cleanup}
            onChange={(v) =>
              void patch({ polish: { cleanup: v as "none" | "light" | "medium" | "high" | "full" } })
            }
            options={[
              { value: "none", label: "None — keep every word" },
              { value: "light", label: "Light — remove filler words" },
              { value: "medium", label: "Medium — edit for clarity" },
              { value: "high", label: "High — tighten and restructure" },
              { value: "full", label: "Full — free rewrite" },
            ]}
          />
        </Row>
        <Row label="Transcription format" hint="How the typed text is shaped — 'No AI formatting' skips polish entirely.">
          <Select
            value={config.polish.format}
            onChange={(v) =>
              void patch({
                polish: { format: v as "formatted" | "raw" | "casual" | "lowercase" },
              })
            }
            options={[
              { value: "formatted", label: "Apply AI formatting" },
              { value: "raw", label: "No AI formatting" },
              { value: "casual", label: "Casual messaging" },
              { value: "lowercase", label: "All lowercase" },
            ]}
          />
        </Row>
        <Row label="Email signature" hint="Appended once, only when dictating into a detected email client.">
          <Toggle
            checked={config.polish.emailSignature ?? false}
            onChange={(v) => void patch({ polish: { emailSignature: v } })}
          />
        </Row>
        {config.polish.emailSignature && (
          <Row label="Signature text" hint="Appended after a blank line at the end of the email.">
            <TextInput
              value={config.polish.emailSignatureText ?? "— Sent with WhisperFlow"}
              onChange={(v) => void patch({ polish: { emailSignatureText: v } })}
              className="w-72"
            />
          </Row>
        )}
      </SettingGroup>

      <SettingGroup
        title={`Tone for ${context.toLowerCase()}`}
        hint="Applies the preset below; the last tone you set is used everywhere until you change it."
        className="mt-5"
      >
        <Row hint={context === "Other" ? "Custom instructions steer the polish model." : undefined} label="Preset">
          <span className="rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-medium capitalize">
            {CONTEXT_TONE[context]}
          </span>
          <Button
            variant="ghost"
            className="ml-2"
            onClick={() => void patch({ polish: { tone: CONTEXT_TONE[context] } })}
          >
            Start now
          </Button>
        </Row>
        {context === "Other" && (
          <div className="border-t border-line/60 pt-4">
            <TextInput
              value={config.polish.customInstructions}
              onChange={(v) => void patch({ polish: { customInstructions: v } })}
              placeholder="e.g. Keep it terse, bullet points, no greetings"
            />
          </div>
        )}
      </SettingGroup>

      <SettingGroup title="Polish engine" className="mt-5">
        <Row label="Engine" hint="Local llama.cpp (default) or any OpenAI-compatible endpoint.">
          <Select
            value={provider}
            onChange={(v) =>
              void patch({ polish: { provider: v as WhisperFlowConfig["polish"]["provider"] } })
            }
            options={[
              { value: "llama-local", label: "Local — llama.cpp" },
              { value: "openai-compat", label: "Remote — OpenAI-compatible" },
              { value: "none", label: "None — offline cleanup only" },
            ]}
          />
        </Row>
        {provider === "llama-local" && (
          <Row label="Temperature" hint="Lower is more faithful to what you said.">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.polish.temperature}
              onChange={(e) => void patch({ polish: { temperature: Number(e.target.value) } })}
              className="w-48"
            />
          </Row>
        )}
        {provider === "openai-compat" && <CloudPolishCard />}
      </SettingGroup>
    </section>
  );
}

/**
 * Cloud polish — the same experience as cloud STT: pick a provider, pick one
 * of that provider's models, override the base URL if you self-host, paste a
 * key, then Test with a one-token probe.
 */
function CloudPolishCard() {
  const config = useSettings((s) => s.config)!;
  const patch = useSettings((s) => s.patchConfig);
  const cloud = config.polish.remote;
  const preset = POLISH_CLOUD_PRESETS[cloud.provider ?? "custom"];
  const models = (cloud.provider ?? "custom") === "custom" ? [] : preset.models;
  const activeModel = cloud.model || preset.defaultModel;
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onProvider = (provider: PolishCloudProviderId) => {
    // Prefill the provider's default endpoint + model so a first-time pick is
    // testable immediately; a saved override survives a re-select.
    const next = { provider, ...(provider !== "custom" ? { baseUrl: preset2(provider).baseUrl, model: preset2(provider).defaultModel } : {}) };
    void patch({ polish: { remote: next } });
  };
  const preset2 = (p: PolishCloudProviderId) => POLISH_CLOUD_PRESETS[p];

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await window.whisperflowExtras.app.testCloudPolish();
      setResult((res.ok ? "✓ " : "✗ ") + res.message);
    } catch (err) {
      setResult("✗ " + String(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-line/60 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-dim">Provider</p>
          <Select
            value={cloud.provider ?? "custom"}
            onChange={(v) => onProvider(v as PolishCloudProviderId)}
            options={(Object.keys(POLISH_CLOUD_PRESETS) as Array<PolishCloudProviderId>).map((p) => ({
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
            Base URL {cloud.provider !== "custom" && "(blank = default)"}
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
      {preset.freeNote && <p className="text-xs leading-5 text-ink-dim">{preset.freeNote}</p>}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => void test()} disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {result && <span className="text-xs text-ink-dim">{result}</span>}
      </div>
      <Row
        label="Fall back to the local model"
        hint="Retry on the downloaded GGUF when the endpoint fails; off means failures drop to offline cleanup."
      >
        <Toggle
          checked={config.polish.fallbackToLocal}
          onChange={(v) => void patch({ polish: { fallbackToLocal: v } })}
        />
      </Row>
    </div>
  );
}
