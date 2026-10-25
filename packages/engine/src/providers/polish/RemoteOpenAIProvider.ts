/**
 * BYO OpenAI-compatible polish endpoint. Hard-blocked when the local-only
 * privacy lock is enabled — the check runs at call time, not construction.
 */
import type { WhisperFlowConfig } from "@whisperflow/shared";
import type { PolishInput } from "../../text/promptBuilder.js";
import { buildPolishMessages } from "../../text/promptBuilder.js";
import type { PolishProvider } from "./PolishProvider.js";

export class RemoteOpenAIProvider implements PolishProvider {
  readonly id = "openai-compat" as const;

  constructor(private readonly config: () => WhisperFlowConfig) {}

  async available(): Promise<boolean> {
    const cfg = this.config();
    if (cfg.privacy.localOnly) return false;
    return Boolean(cfg.polish.remote.baseUrl && cfg.polish.remote.model);
  }

  async *polish(input: PolishInput): AsyncGenerator<string> {
    const cfg = this.config();
    if (cfg.privacy.localOnly) {
      throw new Error("Local-only mode is enabled — remote providers are blocked.");
    }
    const { baseUrl, apiKey, model: remoteModel } = cfg.polish.remote;
    if (!baseUrl || !remoteModel) {
      throw new Error("Remote polish is not configured (base URL / model missing).");
    }

    const messages = buildPolishMessages(input);
    const res = await fetch(baseUrl.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: remoteModel,
        temperature: cfg.polish.temperature,
        stream: false,
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`polish endpoint HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("polish endpoint returned an empty completion");
    yield text;
  }
}
