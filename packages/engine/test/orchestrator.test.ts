import { describe, expect, it } from "vitest";
import { DictationSession, type DictationSessionDeps } from "../src/orchestrator/DictationSession.js";
import { createHistoryStore } from "../src/history/historyStore.js";
import { WhisperFlowConfigSchema, type DictationStateEvent } from "@whisperflow/shared";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FRAME = 1024;

function speechFrame(amplitude = 0.4): Float32Array {
  const f = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) f[i] = Math.sin((i / FRAME) * Math.PI * 8) * amplitude;
  return f;
}

function silenceFrame(): Float32Array {
  return new Float32Array(FRAME).map(() => (Math.random() - 0.5) * 0.002);
}

function makeDeps(overrides: Partial<DictationSessionDeps> = {}): DictationSessionDeps {
  const config = WhisperFlowConfigSchema.parse({
    audio: { vad: { silenceMs: 300 } },
    general: { historyEnabled: true },
    dictionary: [{ id: "d1", term: "WhisperFlow" }],
  });
  return {
    config,
    stt: {
      async transcribe() {
        return "um hello wishperflow world";
      },
      modelPathFor: () => "/models/fake.bin",
    },
    polish: {
      id: "llama-local",
      async *polish() {
        yield "POLISHED";
      },
      async available() {
        return true;
      },
    },
    history: createHistoryStore(join(mkdtempSync(join(tmpdir(), "wf-orch-")), "history.json")),
    onEvent: () => {},
    ...overrides,
  };
}

function speakAndPause(session: DictationSession): void {
  for (let i = 0; i < 12; i++) session.feed(silenceFrame()); // noise calibration
  for (let i = 0; i < 8; i++) session.feed(speechFrame());
  for (let i = 0; i < 8; i++) session.feed(silenceFrame()); // closes the segment
}

describe("DictationSession", () => {
  it("runs the full pipeline: stt → dictionary → polish → history", async () => {
    const events: DictationStateEvent[] = [];
    const deps = makeDeps({ onEvent: (ev) => events.push(ev) });
    const session = new DictationSession(deps);

    speakAndPause(session);
    const result = await session.stop();

    expect(result.raw).toBe("um hello wishperflow world");
    // dictionary corrected the raw text, then the fake polish replaced it
    expect(result.final).toBe("POLISHED");
    expect(result.transcriptId).toBeDefined();
    expect(deps.history!.list()[0]!.rawText).toBe("um hello wishperflow world");

    const states = events.map((e) => e.state);
    expect(states[0]).toBe("listening");
    expect(states).toContain("transcribing");
    expect(states).toContain("polishing");
  });

  it("falls back to offline polish when the provider throws", async () => {
    const deps = makeDeps({
      polish: {
        id: "llama-local",
        async *polish() {
          throw new Error("boom");
        },
        async available() {
          return true;
        },
      },
    });
    const session = new DictationSession(deps);
    speakAndPause(session);
    const result = await session.stop();
    // dictionary correction + offline cleanup, no throw
    expect(result.final).toMatch(/Hello WhisperFlow world\.$/i);
  });

  it("uses offline cleanup when polish is disabled", async () => {
    const deps = makeDeps();
    deps.config.polish.provider = "none";
    const session = new DictationSession(deps);
    speakAndPause(session);
    const result = await session.stop();
    expect(result.final).toMatch(/hello WhisperFlow world/i);
    expect(result.final.startsWith("Um")).toBe(false); // filler removed
  });

  it("honors the built-in undo command", async () => {
    const deps = makeDeps({
      stt: {
        async transcribe() {
          return "scratch that";
        },
        modelPathFor: () => "/models/fake.bin",
      },
    });
    const session = new DictationSession(deps);
    speakAndPause(session);
    const result = await session.stop();
    expect(result.action).toBe("undo");
    expect(result.final).toBe("");
  });

  it("stop() after cancel() throws instead of returning stale text", async () => {
    const session = new DictationSession(makeDeps());
    session.feed(speechFrame());
    session.cancel();
    await expect(session.stop()).rejects.toThrow(/already stopped/);
  });

  it("survives a missing STT provider (returns empty result)", async () => {
    const deps = makeDeps({ stt: null });
    const session = new DictationSession(deps);
    speakAndPause(session);
    const result = await session.stop();
    expect(result.raw).toBe("");
    expect(result.final).toBe("");
  });

  it("drops a whisper.cpp [BLANK_AUDIO]-only segment instead of pasting the tag", async () => {
    const deps = makeDeps({
      stt: {
        async transcribe() {
          return "[BLANK_AUDIO]";
        },
        modelPathFor: () => "/models/fake.bin",
      },
    });
    const session = new DictationSession(deps);
    speakAndPause(session);
    const result = await session.stop();
    // Nothing was said: no text to paste, and no empty history row.
    expect(result.raw).toBe("");
    expect(result.final).toBe("");
    expect(result.transcriptId).toBeUndefined();
    expect(deps.history!.list()).toEqual([]);
  });

  it("strips whisper.cpp tags embedded in otherwise-good text", async () => {
    const deps = makeDeps({
      stt: {
        async transcribe() {
          return "[BEG] hello [NOISE] wishperflow [END]";
        },
        modelPathFor: () => "/models/fake.bin",
      },
    });
    const session = new DictationSession(deps);
    speakAndPause(session);
    const result = await session.stop();
    expect(result.raw).toBe("hello wishperflow");
    expect(result.final).toBe("POLISHED");
    expect(deps.history!.list()[0]!.rawText).toBe("hello wishperflow");
  });

  it("auto-ends a toggle-mode turn on silence, never a hold-mode one", async () => {
    function run(triggerSource: "ptt" | "popo") {
      const deps = makeDeps({
        config: WhisperFlowConfigSchema.parse({
          audio: { vad: { silenceMs: 300, autoStopMs: 500 } },
          general: { historyEnabled: true },
        }),
        triggerSource,
      });
      let autoEnded = 0;
      deps.onAutoEnd = () => autoEnded++;
      const session = new DictationSession(deps);
      speakAndPause(session);
      // Keep feeding silence past the autoStopMs budget (500 ms ≈ 8 frames).
      for (let i = 0; i < 30; i++) session.feed(silenceFrame());
      return { autoEnded, session };
    }
    const toggle = run("popo");
    expect(toggle.autoEnded).toBe(1); // exactly once; stop() still ends the turn
    const hold = run("ptt");
    expect(hold.autoEnded).toBe(0); // hold ends on key release, not silence
  });
});
