import { describe, expect, it } from "vitest";
import { buildSttPrompt } from "../src/text/sttPrompt.js";

describe("STT decode prompt (vocabulary biasing)", () => {
  const vocab = ["WhisperFlow", "Parakeet", "GigaAM"];

  it("prepends the vocabulary preamble before the transcript tail", () => {
    const p = buildSttPrompt(vocab, "we shipped the halftone strip", true);
    expect(p).toContain("Terms the speaker uses, spelled exactly: WhisperFlow, Parakeet, GigaAM.");
    expect(p.endsWith("we shipped the halftone strip")).toBe(true);
  });

  it("preamble alone when the dictation just started (no tail yet)", () => {
    const p = buildSttPrompt(vocab, "", true);
    expect(p).toBe("Terms the speaker uses, spelled exactly: WhisperFlow, Parakeet, GigaAM.");
  });

  it("disabled → plain tail, byte-identical to the pre-0.1.54 behavior", () => {
    expect(buildSttPrompt(vocab, "just the tail", false)).toBe("just the tail");
  });

  it("empty dictionary → plain tail even when enabled", () => {
    expect(buildSttPrompt([], "just the tail", true)).toBe("just the tail");
  });

  it("dedupes case-insensitively, keeping the dictionary's casing", () => {
    const p = buildSttPrompt(["WhisperFlow", "whisperflow", "Parakeet"], "tail", true);
    expect(p).toContain("WhisperFlow, Parakeet");
    expect(p).not.toContain("whisperflow,");
  });

  it("caps the preamble at the character budget so the tail context survives", () => {
    const big = Array.from({ length: 80 }, (_, i) => `Term${i}WithALongishName`);
    const p = buildSttPrompt(big, "tail", true);
    const preamble = p.slice(0, p.indexOf("\n"));
    expect(preamble.length).toBeLessThanOrEqual(400 + 120); // budget + label + last term overflow
    expect(p.endsWith("tail")).toBe(true);
  });

  it("trims the tail to the last 220 chars (rolling context)", () => {
    const long = "x".repeat(600) + "THE-END";
    const p = buildSttPrompt([], long, true);
    expect(p.length).toBeLessThanOrEqual(220);
    expect(p.endsWith("THE-END")).toBe(true);
  });

  it("trims whitespace-only terms away", () => {
    expect(buildSttPrompt(["  ", "", "Parakeet"], "", true)).toContain("Parakeet");
  });
});
