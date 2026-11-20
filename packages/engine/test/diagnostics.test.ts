import { describe, expect, it } from "vitest";
import { WhisperFlowConfigSchema } from "@whisperflow/shared";
import { diagnose, type DiagnosticsInput } from "../src/diagnostics/diagnose.js";

/** A config that is fully working — each test breaks exactly one thing. */
function baseline(overrides: Parameters<typeof WhisperFlowConfigSchema.parse>[0] = {}) {
  return WhisperFlowConfigSchema.parse({
    stt: { provider: "whispercpp-local", modelId: "whisper-small" },
    polish: { enabled: true, provider: "llama-local", modelId: "qwen3.5-2b-q4" },
    privacy: { localOnly: true },
    ...overrides,
  });
}

function input(overrides: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    config: baseline(),
    models: [
      { entryId: "whisper-small", state: "downloaded" },
      { entryId: "qwen3.5-2b-q4", state: "downloaded" },
    ],
    hookAvailable: true,
    micAvailable: true,
    micCount: 1,
    ...overrides,
  };
}

describe("diagnose", () => {
  it("reports healthy when everything is configured", () => {
    const report = diagnose(input());
    expect(report.healthy).toBe(true);
    expect(report.checks.every((c) => c.level !== "fail")).toBe(true);
    expect(report.checks.find((c) => c.id === "stt")?.detail).toContain("whisper-small");
  });

  it("fails on the hotkey hook first — it is the one failure that stops everything", () => {
    const report = diagnose(input({ hookAvailable: false, hookUnavailableReason: "uiohook failed to load" }));
    const first = report.checks[0]!;
    expect(first.id).toBe("hook");
    expect(first.level).toBe("fail");
    expect(first.detail).toBe("uiohook failed to load");
    expect(first.fix).toBeTruthy();
    expect(report.healthy).toBe(false);
  });

  it("fails when the selected local STT model is not downloaded", () => {
    const report = diagnose(
      input({
        config: baseline({ stt: { provider: "whispercpp-local", modelId: "whisper-large-v3" } }),
      }),
    );
    const stt = report.checks.find((c) => c.id === "stt")!;
    expect(stt.level).toBe("fail");
    expect(stt.detail).toContain("whisper-large-v3");
    expect(stt.tab).toBe("models");
  });

  it("fails when cloud STT is selected with no API key", () => {
    const report = diagnose(
      input({
        config: baseline({
          stt: { provider: "cloud", modelId: "whisper-small", cloud: { provider: "groq", apiKey: "" } },
          privacy: { localOnly: false },
        }),
      }),
    );
    const stt = report.checks.find((c) => c.id === "stt")!;
    expect(stt.level).toBe("fail");
    expect(stt.detail).toContain("no API key");
    expect(stt.fix).toContain("API key");
  });

  it("does not demand local weights when cloud STT is configured properly", () => {
    const report = diagnose(
      input({
        config: baseline({
          stt: { provider: "cloud", modelId: "whisper-small", cloud: { provider: "groq", apiKey: "k" } },
          privacy: { localOnly: false },
        }),
        // Deliberately no local models on disk at all.
        models: [],
      }),
    );
    const stt = report.checks.find((c) => c.id === "stt")!;
    expect(stt.level).toBe("ok");
  });

  it("flags cloud STT that local-only mode would block", () => {
    const report = diagnose(
      input({
        config: baseline({
          stt: { provider: "cloud", modelId: "whisper-small", cloud: { provider: "groq", apiKey: "k" } },
          privacy: { localOnly: true },
        }),
      }),
    );
    const stt = report.checks.find((c) => c.id === "stt")!;
    expect(stt.level).toBe("fail");
    expect(stt.detail).toContain("local-only");
  });

  it("warns (never fails) about a missing polish model — polish is optional", () => {
    const report = diagnose(
      input({
        config: baseline({ polish: { enabled: true, provider: "llama-local", modelId: "qwen3-8b-q4" } }),
      }),
    );
    const polish = report.checks.find((c) => c.id === "polish")!;
    expect(polish.level).toBe("warn");
    // Still healthy: a missing polisher must not block dictation.
    expect(report.healthy).toBe(true);
  });

  it("says polish is off when it is disabled, and does not nag", () => {
    const report = diagnose(input({ config: baseline({ polish: { enabled: false } }) }));
    const polish = report.checks.find((c) => c.id === "polish")!;
    expect(polish.level).toBe("ok");
    expect(polish.detail).toContain("Off");
  });

  it("fails when no microphone exists", () => {
    const report = diagnose(input({ micAvailable: false }));
    const mic = report.checks.find((c) => c.id === "mic")!;
    expect(mic.level).toBe("fail");
    expect(mic.fix).toContain("microphone");
  });

  it("orders fails before warns before oks", () => {
    const report = diagnose(
      input({
        hookAvailable: false,
        micAvailable: false,
        config: baseline({ polish: { enabled: true, provider: "llama-local", modelId: "not-downloaded" } }),
      }),
    );
    const levels = report.checks.map((c) => c.level);
    const failCount = levels.filter((l) => l === "fail").length;
    const warnCount = levels.filter((l) => l === "warn").length;
    expect(levels.slice(0, failCount).every((l) => l === "fail")).toBe(true);
    expect(levels.slice(failCount, failCount + warnCount).every((l) => l === "warn")).toBe(true);
  });
});
