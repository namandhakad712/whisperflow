import { afterEach, describe, expect, it, vi } from "vitest";
import { applyLearnedWords, observeEdits } from "../src/main/learning/editObserver";

const TICK = 20;

describe("observeEdits", () => {
  const timers: Array<() => void> = [];
  afterEach(() => timers.forEach((d) => d()));

  const run = (reads: (string | null)[]) =>
    new Promise<{ endReason: string; candidates: { word: string; observedSource: string }[]; editDistance?: number }>(
      (resolve) => {
        let n = 0;
        const d = observeEdits(
          {
            dictated: "i will call john tomorrow",
            dictionary: [],
            pollMs: TICK,
            maxMs: 60 * TICK,
            readContents: async () => reads[Math.min(n++, reads.length - 1)] ?? null,
          },
          (r) => resolve({ endReason: r.endReason, candidates: r.candidates, editDistance: r.editDistance }),
        );
        timers.push(d);
      },
    );

  it("settles as unchanged when the box holds the dictated text", async () => {
    const res = await run(["i will call john tomorrow", "i will call john tomorrow", "i will call john tomorrow"]);
    expect(res.endReason).toBe("unchanged");
    expect(res.candidates).toEqual([]);
  });

  it("learns corrected words when the user edits the text", async () => {
    const res = await run([
      "i will call john tomorrow",
      "I will call Jon tomorrow",
      "I will call Jon tomorrow",
    ]);
    expect(res.endReason).toBe("edited");
    expect(res.candidates).toEqual([{ word: "Jon", observedSource: "john" }]);
    expect(res.editDistance).toBeGreaterThan(0);
  });

  it("reports emptied when the text vanishes (sent/reset)", async () => {
    const res = await run(["i will call john tomorrow", "", ""]);
    expect(res.endReason).toBe("emptied");
  });

  it("reports unreadable when there is no editable target", async () => {
    const res = await run([null, null]);
    expect(res.endReason).toBe("unreadable");
  });

  it("honours the autoLearn=false switch (observe, don't learn)", async () => {
    const res = await new Promise<{ endReason: string; candidates: { word: string }[] }>((resolve) => {
      let n = 0;
      const reads = ["i will call john tomorrow", "I will call Jon tomorrow", "I will call Jon tomorrow"];
      const d = observeEdits(
        {
          dictated: "i will call john tomorrow",
          dictionary: [],
          autoLearn: false,
          pollMs: TICK,
          maxMs: 60 * TICK,
          readContents: async () => reads[Math.min(n++, reads.length - 1)],
        },
        (r) => resolve({ endReason: r.endReason, candidates: r.candidates }),
      );
      timers.push(d);
    });
    expect(res.endReason).toBe("edited");
    expect(res.candidates).toEqual([]);
  });
});

describe("applyLearnedWords", () => {
  it("adds new entries and skips ones already in the dictionary", () => {
    const { added, next } = applyLearnedWords(
      [{ id: "1", term: "WhisperFlow" }],
      [
        { word: "WhisperFlow", observedSource: "whisper flow" },
        { word: "Jon", observedSource: "john" },
      ],
    );
    expect(added).toEqual(["Jon"]);
    expect(next.find((d) => d.term === "Jon")?.observedSource).toBe("john");
  });
});
