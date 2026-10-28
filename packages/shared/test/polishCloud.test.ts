import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, POLISH_CLOUD_PRESETS, WhisperFlowConfigSchema } from "../src/index.js";

describe("cloud polish presets (parity with cloud STT)", () => {
  it("carries a provider → models list for every provider", () => {
    for (const [id, preset] of Object.entries(POLISH_CLOUD_PRESETS)) {
      expect(preset.label.length).toBeGreaterThan(2);
      expect(typeof preset.baseUrl).toBe("string");
      if (id !== "custom") {
        expect(preset.models.length).toBeGreaterThan(0);
        expect(preset.models).toContain(preset.defaultModel);
      }
    }
  });

  it("defaults to custom so existing baseUrl/model configs keep working", () => {
    const parsed = WhisperFlowConfigSchema.parse({
      polish: {
        provider: "openai-compat",
        remote: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", apiKey: "k" },
      },
    });
    expect(parsed.polish.remote.provider).toBe("custom");
    expect(parsed.polish.remote.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(parsed.polish.remote.model).toBe("openai/gpt-oss-120b");
  });

  it("nests under polish in the default config", () => {
    expect(DEFAULT_CONFIG.polish?.remote?.provider).toBe("custom");
  });
});
