import { describe, expect, it } from "vitest";
import {
  DEFERRED_STATUSES,
  recoveryBackoffMs,
  recoveryStep,
  SurfaceRecovery,
  type RecoverableSurface,
} from "../src/main/windows/surfaceRecovery";

describe("recoveryBackoffMs", () => {
  it("follows their 10min * 2^(n-1) ladder capped at 60 minutes", () => {
    expect(recoveryBackoffMs(1)).toBe(10 * 60_000);
    expect(recoveryBackoffMs(2)).toBe(20 * 60_000);
    expect(recoveryBackoffMs(3)).toBe(40 * 60_000);
    expect(recoveryBackoffMs(4)).toBe(60 * 60_000);
    expect(recoveryBackoffMs(10)).toBe(60 * 60_000); // the 36e5 cap
  });
});

describe("recoveryStep", () => {
  it("escalates invalidate → hideShow → rebuild", () => {
    expect(recoveryStep(1)).toBe("invalidate");
    expect(recoveryStep(2)).toBe("hideShow");
    expect(recoveryStep(3)).toBe("rebuild");
    expect(recoveryStep(9)).toBe("rebuild");
  });
});

describe("SurfaceRecovery", () => {
  const mk = (overrides: Partial<RecoverableSurface> = {}): RecoverableSurface & { calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      isAlive: () => true,
      invalidate: () => calls.push("invalidate"),
      pulse: () => {
        calls.push("pulse");
        return null;
      },
      hideShow: () => calls.push("hideShow"),
      rebuild: () => calls.push("rebuild"),
      ...overrides,
    };
  };

  it("deferred while a dictation is mid-flight, then runs the first step", async () => {
    let busy = true;
    const s = mk();
    const rec = new SurfaceRecovery(s, () => busy, 15);
    rec.trigger();
    await new Promise((r) => setTimeout(r, 30));
    expect(s.calls).toEqual([]); // deferred while busy
    busy = false;
    await new Promise((r) => setTimeout(r, 60));
    expect(s.calls).toContain("invalidate");
    rec.cancel();
  });

  it("skips a dead surface", async () => {
    const s = mk({ isAlive: () => false });
    const rec = new SurfaceRecovery(s, () => false, 15);
    rec.trigger();
    await new Promise((r) => setTimeout(r, 20));
    expect(s.calls).toEqual([]);
  });

  it("treats their deferred statuses as busy", () => {
    expect(DEFERRED_STATUSES.has("listening")).toBe(true);
    expect(DEFERRED_STATUSES.has("processing")).toBe(true);
    expect(DEFERRED_STATUSES.has("idle")).toBe(false);
    expect(DEFERRED_STATUSES.has("done")).toBe(false);
  });
});
