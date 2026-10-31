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

describe("hotkey.mode (single source of truth)", () => {
  it("defaults to toggle: one press starts, silence or the next press finishes", () => {
    const config: WhisperFlowConfig = WhisperFlowConfigSchema.parse({});
    expect(config.hotkey.mode).toBe("toggle");
    expect(config.hotkey.holdMode).toBe(false);
    expect(config.hotkey.toggleMode).toBe(true);
  });

  it("reads a legacy holdMode:true config as hold", () => {
    const config = WhisperFlowConfigSchema.parse({ hotkey: { holdMode: true } });
    expect(config.hotkey.mode).toBe("hold");
    expect(config.hotkey.holdMode).toBe(true);
    expect(config.hotkey.toggleMode).toBe(false);
  });

  it("reads legacy toggleMode (true or false) as toggle", () => {
    for (const toggleMode of [true, false]) {
      const config = WhisperFlowConfigSchema.parse({ hotkey: { toggleMode } });
      expect(config.hotkey.mode).toBe("toggle");
      expect(config.hotkey.holdMode).toBe(false);
      expect(config.hotkey.toggleMode).toBe(true);
    }
  });

  it("mode drives the derived flags, so the pair can never disagree", () => {
    const hold = WhisperFlowConfigSchema.parse({ hotkey: { mode: "hold" } });
    expect(hold.hotkey).toMatchObject({ mode: "hold", holdMode: true, toggleMode: false });
    const toggle = WhisperFlowConfigSchema.parse({ hotkey: { mode: "toggle" } });
    expect(toggle.hotkey).toMatchObject({ mode: "toggle", holdMode: false, toggleMode: true });
  });

  it("mode wins over contradictory legacy flags (stale patch merged over an old file)", () => {
    // e.g. deepMerge({holdMode: true}, {mode: "toggle"}) — the newer intent wins.
    const config = WhisperFlowConfigSchema.parse({ hotkey: { holdMode: true, mode: "toggle" } });
    expect(config.hotkey.mode).toBe("toggle");
    expect(config.hotkey.holdMode).toBe(false);
    const flipped = WhisperFlowConfigSchema.parse({ hotkey: { holdMode: false, mode: "hold" } });
    expect(flipped.hotkey.mode).toBe("hold");
    expect(flipped.hotkey.toggleMode).toBe(false);
  });

  it("drops a bogus mode instead of rejecting the whole config", () => {
    const config = WhisperFlowConfigSchema.parse({ hotkey: { mode: "scream", pushToTalk: "Alt+Q" } });
    expect(config.hotkey.mode).toBe("toggle");
    expect(config.hotkey.pushToTalk).toBe("Alt+Q");
  });

  it("round-trips mode and the derived flags through JSON", () => {
    const config = WhisperFlowConfigSchema.parse({ hotkey: { mode: "hold" } });
    const revived = WhisperFlowConfigSchema.parse(JSON.parse(JSON.stringify(config)));
    expect(revived).toEqual(config);
  });
});
