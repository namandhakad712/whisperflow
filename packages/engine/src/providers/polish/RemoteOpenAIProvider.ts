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

    // pi-ai path: unified adapter with automatic provider discovery (optional dep).
    if (!baseUrl) {
      const viaPi = await this.polishViaPiAi(input);
      if (viaPi !== null) {
        yield viaPi;
        return;
      }
      throw new Error("Remote polish is not configured (base URL / model missing).");
    }
    if (!remoteModel) {
      throw new Error("Remote polish is not configured (model missing).");
    }
    yield await this.polishViaOpenAi(input, cfg);
  }

  /** Best-effort pi-ai (unified multi-provider adapter). Returns null when unavailable. */
  private async polishViaPiAi(input: PolishInput): Promise<string | null> {
    try {
      const mod = (await import("@earendil-works/pi-ai")) as unknown as {
        Chat?: new (opts: Record<string, unknown>) => {
          complete(opts: Record<string, unknown>): Promise<string>;
        };
        prompt: (parts: Array<{ role: string; content: string }>) => unknown;
      };
      const messages = buildPolishMessages(input);
      const chat = new mod.Chat!({});
      return await chat.complete({
        prompt: mod.prompt([
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ]),
      });
    } catch {
      return null;
    }
  }

  private async polishViaOpenAi(input: PolishInput, cfg: WhisperFlowConfig): Promise<string> {
    const { baseUrl, apiKey, model: remoteModel } = cfg.polish.remote;
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
    return text;
  }
}
