import { describe, expect, it } from "vitest";
import {
  countDictionaryPhrases,
  learnFromEdits,
  STOPWORDS,
} from "../src/text/learnFromEdits.js";
import {
  bestMatchingRegion,
  levenshtein,
  matchesBeforePasteAndAfter,
  normalizedEditDistance,
} from "../src/text/editDistance.js";

describe("editDistance", () => {
  it("computes plain levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  it("normalizes by the dictated length", () => {
    // a 3-char edit on a 10-char dictate = 0.3; on a 100-char dictate = 0.03
    expect(normalizedEditDistance("abcdefghij", "abcXefghij")).toBeCloseTo(0.1, 5);
    expect(normalizedEditDistance("abcdefghij", "abcdefghij")).toBe(0);
    expect(normalizedEditDistance("", "anything")).toBe(0);
  });

  it("verifies a paste by the before + pasted + after subset check", () => {
    expect(matchesBeforePasteAndAfter("Hi there. Bye", "Hi there.", "", " Bye")).toBe(true);
    // whitespace/case shape differences resolve to the normalized comparison
    expect(matchesBeforePasteAndAfter("Hi  there.  Bye", "Hi there.", "", " Bye")).toBe(true);
    expect(matchesBeforePasteAndAfter("something else", "Hi there.", "", "")).toBe(false);
  });

  it("finds the anchored region in a long box", () => {
    const dictated = "the quick brown fox";
    const box = `previous thread line\n${dictated} jumps over\nmore thread`;
    const region = bestMatchingRegion(dictated, box);
    expect(region.startsWith("the quick brown fox")).toBe(true);
  });
});

describe("learnFromEdits", () => {
  it("extracts corrected words as substitution pairs", () => {
    const learned = learnFromEdits(
      "i will call john tomorrow",
      "I will call Jon tomorrow",
    );
    expect(learned).toEqual([{ word: "Jon", observedSource: "john" }]);
  });

  it("captures several corrections but caps at 4", () => {
    const learned = learnFromEdits(
      "alpha bravo charlie delta echo foxtrot",
      "Alfa Bravo Charli Delta Eco Foxtrot",
      { maxCandidates: 4 },
    );
    expect(learned.length).toBe(4);
    expect(learned.every((c) => c.observedSource.length > 0)).toBe(true);
  });

  it("skips pure insertions and pure deletions", () => {
    expect(learnFromEdits("hello world", "hello world there")).toEqual([]);
    expect(learnFromEdits("hello world there", "hello world")).toEqual([]);
  });

  it("never learns words already in the dictionary", () => {
    const learned = learnFromEdits("call john", "call John", { dictionary: ["John"] });
    expect(learned).toEqual([]);
  });

  it("never returns when the text is unchanged or empty", () => {
    expect(learnFromEdits("same text", "same text")).toEqual([]);
    expect(learnFromEdits("", "")).toEqual([]);
  });

  it("exposes the stopword filter the reference app uses", () => {
    expect(STOPWORDS.has("the")).toBe(true);
    expect(STOPWORDS.has("WhisperFlow")).toBe(false);
  });
});

describe("countDictionaryPhrases", () => {
  it("counts whole-word dictionary hits in the edited text", () => {
    const counts = countDictionaryPhrases(["WhisperFlow", "OpenWispr"], "WhisperFlow and whisperflow again, notwhisperflow");
    expect(counts.get("WhisperFlow")).toBe(2);
    expect(counts.has("OpenWispr")).toBe(false);
  });
});
