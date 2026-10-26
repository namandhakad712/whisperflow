import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLOUD_STT_PRESETS,
  WhisperFlowConfigSchema,
  type DictationStateEvent,
} from "@whisperflow/shared";
import { ConfigStore } from "../src/config/ConfigStore.js";
import { ModelManager } from "../src/models/manager.js";
import { CloudSttProvider } from "../src/providers/stt/CloudSttProvider.js";
import { withSttFallback } from "../src/providers/stt/withFallback.js";
import { DictationSession, type DictationSessionDeps, type SttAdapter } from "../src/orchestrator/DictationSession.js";
import { createHistoryStore } from "../src/history/historyStore.js";

const FRAME = 1024;

function speechFrame(amplitude = 0.4): Float32Array {
  const f = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) f[i] = Math.sin((i / FRAME) * Math.PI * 8) * amplitude;
  return f;
}
function silenceFrame(): Float32Array {
  return new Float32Array(FRAME).map(() => (Math.random() - 0.5) * 0.002);
}
function speakAndPause(session: DictationSession): void {
  for (let i = 0; i < 12; i++) session.feed(silenceFrame());
  for (let i = 0; i < 8; i++) session.feed(speechFrame());
  for (let i = 0; i < 8; i++) session.feed(silenceFrame());
}

describe("extended config schema", () => {
  it("defaults the cloud STT section to Groq with empty overrides", () => {
    const cfg = WhisperFlowConfigSchema.parse({});
    expect(cfg.stt.provider).toBe("whispercpp-local");
    expect(cfg.stt.cloud.provider).toBe("groq");
    expect(cfg.stt.cloud.apiKey).toBe("");
    expect(cfg.stt.cloud.model).toBe("");
  });

  it("defaults the new general switches (meeting mode, audio saving)", () => {
    const cfg = WhisperFlowConfigSchema.parse({});
    expect(cfg.general.meetingMode).toBe(false);
    expect(cfg.general.saveAudio).toBe(false);
    expect(cfg.general.recordingsDir).toBe("");
    expect(cfg.models.custom).toEqual([]);
  });

  it("keeps cloud config through a partial merge", () => {
    const cfg = WhisperFlowConfigSchema.parse({ stt: { cloud: { apiKey: "gsk_test" } } });
    expect(cfg.stt.cloud.provider).toBe("groq");
    expect(cfg.stt.cloud.apiKey).toBe("gsk_test");
  });
});

describe("CloudSttProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function configWith(overrides: Record<string, unknown> = {}) {
    return () =>
      WhisperFlowConfigSchema.parse({
        privacy: { localOnly: false },
        ...overrides,
      });
  }

  it("transcribes by POSTing a multipart WAV to the resolved endpoint", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ text: "hello world" }), { status: 200 });
    }) as typeof fetch;

    const provider = new CloudSttProvider(configWith({ stt: { cloud: { apiKey: "k1" } } }));
    const text = await provider.transcribe(new Float32Array(1600), { language: "en" });

    expect(text).toBe("hello world");
    expect(calls[0]!.url).toBe(`${CLOUD_STT_PRESETS.groq.baseUrl}/audio/transcriptions`);
    const body = calls[0]!.init.body as FormData;
    expect(body.get("model")).toBe(CLOUD_STT_PRESETS.groq.defaultModel);
    expect(String(body.get("language"))).toBe("en");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer k1");
  });

  it("honors a user base URL and model override", async () => {
    const seen: string[] = [];
    globalThis.fetch = (async (url: URL | string) => {
      seen.push(String(url));
      return new Response(JSON.stringify({ text: "ok" }), { status: 200 });
    }) as typeof fetch;

    const provider = new CloudSttProvider(
      configWith({ stt: { cloud: { apiKey: "k", baseUrl: "https://my.server/v1", model: "m1" } } }),
    );
    await provider.transcribe(new Float32Array(100), { language: "auto" });
    expect(seen[0]).toBe("https://my.server/v1/audio/transcriptions");
  });

  it("is blocked while the local-only lock is on", async () => {
    const provider = new CloudSttProvider(
      () => WhisperFlowConfigSchema.parse({ privacy: { localOnly: true }, stt: { cloud: { apiKey: "k" } } }),
    );
    await expect(provider.transcribe(new Float32Array(10), { language: "en" })).rejects.toThrow(/local-only/i);
    expect(provider.isReady()).toBe(false);
  });

  it("reports a rejected key from the test ping", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    const provider = new CloudSttProvider(configWith({ stt: { cloud: { apiKey: "bad" } } }));
    const r = await provider.testConnection();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/401/);
  });
});

describe("ModelManager custom catalog + auto-activate", () => {
  function mkManager() {
    const dir = mkdtempSync(join(tmpdir(), "wf-mgr-"));
    const config = new ConfigStore(join(dir, "config.json"));
    const manager = new ModelManager({ modelsDir: join(dir, "models"), binDir: join(dir, "bin"), config });
    return { manager, config };
  }

  it("merges custom entries into the catalog and status sweep", async () => {
    const { manager, config } = mkManager();
    await config.set({
      models: {
        custom: [
          {
            id: "custom-tiny",
            role: "stt",
            name: "Whisper tiny",
            repo: "ggerganov/whisper.cpp",
            file: "ggml-tiny.bin",
            url: "https://example.invalid/ggml-tiny.bin",
            format: "ggml",
          },
        ],
      },
    });
    const catalog = manager.catalog();
    expect(catalog.some((e) => e.id === "custom-tiny")).toBe(true);
    expect(manager.entry("custom-tiny")?.custom).toBe(true);
    const statuses = await manager.status();
    expect(statuses.some((s) => s.entryId === "custom-tiny")).toBe(true);
  });

  it("auto-activates the first downloaded model for a role", async () => {
    const { manager, config } = mkManager();
    const entry = manager.entry("whisper-small")!;
    // Simulate a completed download without network: write the file, then run the
    // post-download activation step directly.
    await manager["autoActivate"](entry);
    expect(config.get().stt.modelId).toBe("whisper-small");
  });

  it("never auto-activates the whisper.cpp engine binary", async () => {
    const { manager, config } = mkManager();
    const binary = manager.entry("whisper-bin-x64")!;
    await manager["autoActivate"](binary);
    expect(config.get().stt.modelId).not.toBe("whisper-bin-x64");
  });
});

describe("meeting mode (append dictation)", () => {  it("emits each utterance as appendText and skips the final injection", async () => {
    const events: DictationStateEvent[] = [];
    const deps: DictationSessionDeps = {
      config: WhisperFlowConfigSchema.parse({
        audio: { vad: { silenceMs: 300 } },
        general: { historyEnabled: true },
      }),
      stt: {
        async transcribe() {
          return "one more thing";
        },
        modelPathFor: () => "/models/fake.bin",
      },
      polish: null,
      history: createHistoryStore(join(mkdtempSync(join(tmpdir(), "wf-append-")), "history.json")),
      appendMode: true,
      onEvent: (ev) => events.push(ev),
    };
    const session = new DictationSession(deps);

    speakAndPause(session);
    speakAndPause(session);
    const result = await session.stop();

    const appended = events.filter((e) => e.appendText).map((e) => e.appendText);
    expect(appended).toHaveLength(2);
    // offline cleanup fixes casing + punctuation per utterance
    expect(appended.every((t) => t === "One more thing.")).toBe(true);
    // Controller skips injection on empty final; history still archives everything.
    expect(result.final).toBe("");
    expect(deps.history!.list()[0]!.rawText).toContain("one more thing one more thing");
  });
});

describe("stt fallback chain", () => {
  const ok = (text: string): SttAdapter => ({
    async transcribe() {
      return text;
    },
    modelPathFor: () => "/models/x.bin",
  });
  const failing = (): SttAdapter => ({
    async transcribe() {
      throw new Error("quota exceeded");
    },
    modelPathFor: () => "/models/x.bin",
  });

  it("uses the backup when the primary throws", async () => {
    const logs: string[] = [];
    const adapter = withSttFallback(failing(), ok("from-backup"), (m) => logs.push(m))!;
    await expect(adapter.transcribe(new Float32Array(10), { language: "en" })).resolves.toBe("from-backup");
    expect(logs.join(" ")).toMatch(/fallback/i);
  });

  it("never calls the backup when the primary succeeds", async () => {
    let backupCalls = 0;
    const backup: SttAdapter = {
      async transcribe() {
        backupCalls += 1;
        return "backup";
      },
      modelPathFor: () => "/models/x.bin",
    };
    const adapter = withSttFallback(ok("primary"), backup)!;
    await expect(adapter.transcribe(new Float32Array(10), { language: "en" })).resolves.toBe("primary");
    expect(backupCalls).toBe(0);
  });

  it("returns the single available adapter when there is no pair", () => {
    const only = ok("solo");
    expect(withSttFallback(only, null)).toBe(only);
    expect(withSttFallback(null, only)).toBe(only);
    expect(withSttFallback(null, null)).toBeNull();
  });

  it("is ready when either side can serve (cloud has no local path)", () => {
    const cloud: SttAdapter = {
      async transcribe() {
        return "cloud";
      },
      modelPathFor: () => null,
      ready: () => true,
    };
    const localMissingModel: SttAdapter = {
      async transcribe() {
        return "local";
      },
      modelPathFor: () => null,
    };
    const adapter = withSttFallback(cloud, localMissingModel)!;
    expect(adapter.ready?.("whisper-small")).toBe(true);
  });
});

describe("cloud presets reflect verified provider reality", () => {
  it("drops the Groq model id that no longer exists", () => {
    expect([...CLOUD_STT_PRESETS.groq.models]).not.toContain("distil-whisper-large-v3-en");
    expect([...CLOUD_STT_PRESETS.groq.models]).toContain("whisper-large-v3-turbo");
  });

  it("offers Mistral Voxtral with the documented default id", () => {
    expect(CLOUD_STT_PRESETS.mistral.defaultModel).toBe("voxtral-mini-transcribe-3-0");
    expect(CLOUD_STT_PRESETS.mistral.baseUrl).toBe("https://api.mistral.ai/v1");
  });

  it("points OpenAI at the current model, not the deprecated one", () => {
    expect(CLOUD_STT_PRESETS.openai.defaultModel).toBe("gpt-transcribe");
    expect(CLOUD_STT_PRESETS.openai.freeNote).toMatch(/2027-02-26/);
  });
});
