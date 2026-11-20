/**
 * Local LLM polish via node-llama-cpp (optional dependency, lazy-loaded).
 * The GGUF path is resolved from the active catalog id at polish time.
 */
import type { PolishInput } from "../../text/promptBuilder.js";
import { buildPolishMessages } from "../../text/promptBuilder.js";
import type { PolishProvider } from "./PolishProvider.js";

/**
 * How long a loaded local model stays resident after the last dictation.
 * A GGUF context holds hundreds of MB of weights + KV cache; dictation bursts
 * are seconds long, so keeping it hot through a long idle is a bad RAM trade.
 * The next polish re-loads lazily (hundreds of ms) — an acceptable cost once
 * every few minutes.
 */
const IDLE_UNLOAD_MS = 5 * 60_000;

// Minimal structural types over the dynamically imported module.
interface LlamaModel {
  dispose(): void;
}
interface LlamaChatSession {
  prompt(prompt: string, opts: { systemPrompt?: string; temperature?: number; maxTokens?: number }): Promise<string>;
  dispose(): void;
}
interface LlamaContext {
  loadModel(opts: { modelPath: string }): Promise<LlamaModel>;
}
interface LlamaModule {
  getLlama(): Promise<LlamaContext>;
  LlamaChatSession: new (opts: { model: LlamaModel }) => LlamaChatSession;
}

export class LocalLlamaProvider implements PolishProvider {
  readonly id = "llama-local" as const;
  private llama: LlamaModule | null = null;
  private model: LlamaModel | null = null;
  private loadedModelPath = "";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly opts: {
      /** Resolves a catalog id to an on-disk GGUF path (null when absent). */
      resolveModelPath: (modelId: string) => string | null;
      temperature: () => number;
      logger?: (msg: string) => void;
    },
  ) {}

  async available(): Promise<boolean> {
    try {
      await import("node-llama-cpp");
      return true;
    } catch {
      return false;
    }
  }

  async *polish(input: PolishInput): AsyncGenerator<string> {
    const modelPath = this.opts.resolveModelPath(input.modelId);
    if (!modelPath) {
      throw new Error("polish model not downloaded — get it in Settings → Models");
    }
    this.cancelIdleUnload();
    await this.ensureLoaded(modelPath);
    const messages = buildPolishMessages(input);

    const session = new this.llama!.LlamaChatSession({ model: this.model! });
    try {
      const text = await session.prompt(messages.user, {
        systemPrompt: messages.system,
        temperature: this.opts.temperature(),
        maxTokens: Math.max(256, Math.ceil(input.raw.length * 2)),
      });
      yield text.trim();
    } finally {
      session.dispose();
      this.scheduleIdleUnload();
    }
  }

  dispose(): void {
    this.cancelIdleUnload();
    this.model?.dispose();
    this.model = null;
    this.loadedModelPath = "";
  }

  /** Frees the resident model once dictation has been quiet for a while. */
  private scheduleIdleUnload(): void {
    this.cancelIdleUnload();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.model) this.opts.logger?.("polish: idle — unloading the local model");
      this.model?.dispose();
      this.model = null;
      this.loadedModelPath = "";
    }, IDLE_UNLOAD_MS);
    // The timer must never keep the process alive on quit.
    if (typeof this.idleTimer === "object" && "unref" in this.idleTimer) this.idleTimer.unref();
  }

  private cancelIdleUnload(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async ensureLoaded(modelPath: string): Promise<void> {
    if (this.model && this.loadedModelPath === modelPath) return;
    this.dispose();
    const mod = (await import("node-llama-cpp")) as unknown as LlamaModule;
    this.llama = mod;
    const llama = await mod.getLlama();
    this.model = await llama.loadModel({ modelPath });
    this.loadedModelPath = modelPath;
  }
}
