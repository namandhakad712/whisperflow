import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  WhisperFlowConfigSchema,
  type WhisperFlowConfig,
} from "../src/index.js";

describe("WhisperFlowConfigSchema", () => {
  it("parses {} into a fully-defaulted valid config", () => {
    const config: WhisperFlowConfig = WhisperFlowConfigSchema.parse({});
    expect(config.hotkey.pushToTalk).toBe("Control+Shift+Space");
    expect(config.audio.vad.kind).toBe("rms");
    expect(config.audio.vad.silenceMs).toBe(700);
    expect(config.stt.modelId).toBe("whisper-small");
    expect(config.polish.provider).toBe("llama-local");
    expect(config.privacy.localOnly).toBe(true);
    expect(config.dictionary).toEqual([]);
    expect(config.commands).toEqual([]);
  });

  it("DEFAULT_CONFIG equals a fresh parse of {}", () => {
    expect(DEFAULT_CONFIG).toEqual(WhisperFlowConfigSchema.parse({}));
  });

  it("round-trips a config with user data through JSON", () => {
    const config = WhisperFlowConfigSchema.parse({
      hotkey: { pushToTalk: "Alt+Q" },
      dictionary: [{ id: "d1", term: "WhisperFlow" }],
      commands: [{ id: "c1", phrase: "scratch that", action: "undo" }],
      polish: { remote: { baseUrl: "https://x.example/v1", apiKey: "k", model: "m" } },
    });
    const revived = WhisperFlowConfigSchema.parse(JSON.parse(JSON.stringify(config)));
    expect(revived).toEqual(config);
  });

  it("upgrades partial/legacy config transparently via defaults", () => {
    const config = WhisperFlowConfigSchema.parse({ stt: { language: "en" } });
    expect(config.stt.language).toBe("en");
    expect(config.stt.modelId).toBe("whisper-small"); // default filled in
  });

  it("rejects invalid values loudly", () => {
    expect(() => WhisperFlowConfigSchema.parse({ privacy: { localOnly: "yes" } })).toThrow();
    expect(() => WhisperFlowConfigSchema.parse({ audio: { vad: { silenceMs: 5 } } })).toThrow();
    expect(() =>
      WhisperFlowConfigSchema.parse({ commands: [{ id: "x", phrase: "" , action: "undo" }] }),
    ).toThrow();
  });
});
