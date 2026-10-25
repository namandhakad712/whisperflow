import { useSettings } from "../store";
import { Card, Row, SectionTitle, Select, TextInput } from "../../shared/ui";
import type { WhisperFlowConfig } from "@whisperflow/shared";

export function AdvancedTab() {
  const config = useSettings((s) => s.config);
  const patch = useSettings((s) => s.patchConfig);
  if (!config) return null;

  const provider = config.polish.provider;

  return (
    <section>
      <SectionTitle
        title="Advanced"
        hint="Polish engine and bring-your-own endpoint. The local-only lock (Privacy tab) overrides everything here."
      />
      <Card>
        <Row label="Polish provider" hint="Local llama.cpp (default) or any OpenAI-compatible endpoint.">
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
              className="w-48 accent-[var(--color-accent)]"
            />
          </Row>
        )}

        {provider === "openai-compat" && (
          <div className="space-y-3 border-t border-line/60 pt-4">
            <p className="text-xs text-ink-dim">
              Point at Groq, OpenRouter, Ollama, vLLM — anything speaking the OpenAI chat format.
              Requires the local-only lock to be OFF.
            </p>
            <TextInput
              value={config.polish.remote.baseUrl}
              onChange={(v) => void patch({ polish: { remote: { baseUrl: v } } })}
              placeholder="https://api.groq.com/openai/v1"
            />
            <TextInput
              value={config.polish.remote.model}
              onChange={(v) => void patch({ polish: { remote: { model: v } } })}
              placeholder="model id, e.g. llama-3.3-70b-versatile"
            />
            <TextInput
              type="password"
              value={config.polish.remote.apiKey}
              onChange={(v) => void patch({ polish: { remote: { apiKey: v } } })}
              placeholder="API key (stored locally only)"
            />
          </div>
        )}
      </Card>
    </section>
  );
}
