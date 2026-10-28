import { describe, expect, it } from "vitest";
import { resolveSttLanguage, type WhisperFlowConfig } from "../src/index.js";

const stt = (over: Partial<WhisperFlowConfig["stt"]> = {}) =>
  ({
    provider: "whispercpp-local",
    modelId: "whisper-small",
    language: "auto",
    languages: [],
    autoDetect: true,
    cloud: { provider: "openai", apiKey: "", model: "whisper-large-v3-turbo" },
    fallback: "none",
    ...over,
  }) as WhisperFlowConfig["stt"];

describe("resolveSttLanguage (the reference app's language model)", () => {
  it("auto-detects by default, even with languages selected", () => {
    expect(resolveSttLanguage(stt())).toBe("auto");
    expect(resolveSttLanguage(stt({ languages: ["en", "es"] }))).toBe("auto");
  });

  it("uses a single selected language explicitly when auto-detect is off", () => {
    expect(resolveSttLanguage(stt({ autoDetect: false, languages: ["de"] }))).toBe("de");
  });

  it("still auto-detects when several languages are selected with auto-detect off — the set is hints, not a forced pick", () => {
    // whisper.cpp has no hint list, so it degrades to auto; a native hint-capable
    // adapter would take the whole set.
    expect(resolveSttLanguage(stt({ autoDetect: false, languages: ["en", "es"] }))).toBe("auto");
  });

  it("effective languages (their runtime widget override) win over the stored set", () => {
    expect(resolveSttLanguage(stt({ languages: ["en"] }), ["fr", "de"])).toBe("auto");
    expect(resolveSttLanguage(stt({ autoDetect: false, languages: ["en"] }), ["fr"])).toBe("fr");
  });

  it("falls back to the legacy single field when no set is configured", () => {
    expect(resolveSttLanguage(stt({ autoDetect: false, language: "pt" }))).toBe("pt");
  });
});
