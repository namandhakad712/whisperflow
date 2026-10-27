import { useState } from "react";
import { POLISH_PRESETS, type WhisperFlowConfig } from "@whisperflow/shared";
import { useSettings } from "../store";
import { Button, Card, PageHeader, Row, Select, TextInput, Toggle } from "../../shared/ui";

/** Style contexts — reference app's "Make it sound like you" board, mapped to our config:
 *  each context picks the polish tone; custom instructions override per context. */
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
        explainer="Pick a writing style per context. Say it once — every dictation follows the tone you chose."
      />

      <Card className="mb-5">
        <Row
          label="Auto cleanup"
          hint="Remove filler words and fix punctuation on every dictation."
        >
          <Toggle
            checked={autoCleanup}
            onChange={(v) => void patch({ polish: { provider: v ? "llama-local" : "none" } })}
          />
        </Row>
        <Row
          label="Cleanup strength"
          hint='How much of the spoken messiness to remove. "Light" drops filler words; "Strong" also tightens repetitions and false starts.'
        >
          <Select
            value={config.polish.cleanup}
            onChange={(v) => void patch({ polish: { cleanup: v as "off" | "light" | "strong" } })}
            options={[
              { value: "off", label: "Off — keep every word" },
              { value: "light", label: "Light — remove filler words" },
              { value: "strong", label: "Strong — tighten repetitions too" },
            ]}
          />
        </Row>
        <Row
          label={`Tone for ${context.toLowerCase()}`}
          hint={context === "Other" ? "Custom instructions steer the polish model." : undefined}
        >
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
      </Card>

      <Card>
        <Row label="Polish engine" hint="Local llama.cpp (default) or any OpenAI-compatible endpoint.">
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
        {provider === "openai-compat" && (
          <div className="space-y-3 border-t border-line/60 pt-4">
            <p className="text-xs text-ink-dim">
              Groq, OpenRouter, Ollama, vLLM — anything speaking the OpenAI chat format.
              Requires the local-only lock (Privacy) to be OFF.
            </p>
            {/* one-click presets — verified endpoints, no typing required */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(POLISH_PRESETS) as Array<keyof typeof POLISH_PRESETS>).map((id) => {
                const preset = POLISH_PRESETS[id];
                const active =
                  config.polish.remote.baseUrl === preset.baseUrl && config.polish.remote.model === preset.model;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      void patch({ polish: { remote: { baseUrl: preset.baseUrl, model: preset.model } } })
                    }
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-accent/70 bg-accent/10"
                        : "border-line bg-surface-2/60 hover:border-accent/40"
                    }`}
                  >
                    <span className="block text-[12px] font-semibold">{preset.label}</span>
                    <span className="block text-[10px] text-ink-dim">{preset.hint}</span>
                  </button>
                );
              })}
            </div>
            <TextInput
              value={config.polish.remote.baseUrl}
              onChange={(v) => void patch({ polish: { remote: { baseUrl: v } } })}
              placeholder="https://api.groq.com/openai/v1"
            />
            <TextInput
              value={config.polish.remote.model}
              onChange={(v) => void patch({ polish: { remote: { model: v } } })}
              placeholder="model id"
            />
            <TextInput
              type="password"
              value={config.polish.remote.apiKey}
              onChange={(v) => void patch({ polish: { remote: { apiKey: v } } })}
              placeholder="API key (stored locally only)"
            />
            <Row
              label="Fall back to the local model"
              hint="If the endpoint fails (quota, network, 5xx), retry on the downloaded GGUF. With it off, a failure drops straight to offline cleanup."
            >
              <Toggle
                checked={config.polish.fallbackToLocal}
                onChange={(v) => void patch({ polish: { fallbackToLocal: v } })}
              />
            </Row>
          </div>
        )}
      </Card>
    </section>
  );
}
