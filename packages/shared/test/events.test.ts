import { describe, expect, it } from "vitest";
import { canTransition, nextStates } from "../src/index.js";

describe("dictation state machine", () => {
  it("follows the canonical happy path", () => {
    const path = ["idle", "listening", "transcribing", "polishing", "injecting", "done"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("allows skipping polish when disabled", () => {
    expect(canTransition("transcribing", "injecting")).toBe(true);
    expect(canTransition("transcribing", "done")).toBe(true);
  });

  it("lets any active state fail or be cancelled", () => {
    for (const s of ["listening", "transcribing", "polishing", "injecting"] as const) {
      expect(canTransition(s, "cancelled")).toBe(true);
      expect(canTransition(s, "error")).toBe(true);
    }
  });

  it("only allows terminal states to reset to idle", () => {
    for (const s of ["done", "cancelled", "error"] as const) {
      expect(nextStates(s)).toEqual(["idle"]);
    }
    expect(canTransition("idle", "polishing")).toBe(false);
    expect(canTransition("done", "listening")).toBe(false);
  });
});
