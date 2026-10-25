import { describe, expect, it } from "vitest";
import { fuzzyCorrect } from "../src/text/dictionary.js";
import { applyCommand, detectCommand, BUILT_IN_COMMANDS } from "../src/text/commands.js";
import { offlinePolish } from "../src/text/cleanup.js";

describe("dictionary fuzzy correction", () => {
  const entries = [
    { id: "1", term: "WhisperFlow" },
    { id: "2", term: "OpenWispr" },
    { id: "3", term: "Qwen" },
  ];

  it("corrects a realistic two-edit mishearing", () => {
    const { corrected, corrections } = fuzzyCorrect("I use wishperflow every day", entries);
    expect(corrected).toBe("I use WhisperFlow every day");
    expect(corrections).toEqual([{ from: "wishperflow", to: "WhisperFlow" }]);
  });

  it("preserves the dictionary's canonical spelling verbatim", () => {
    const { corrected } = fuzzyCorrect("Wishperflow is great", entries);
    expect(corrected).toBe("WhisperFlow is great");
  });

  it("matches multi-word terms across a token window", () => {
    const { corrected } = fuzzyCorrect("deploy azure kubernete cluster now", [
      { id: "4", term: "Azure Kubernetes" },
    ]);
    expect(corrected).toBe("deploy Azure Kubernetes cluster now");
  });

  it("does not touch short common words", () => {
    const { corrected, corrections } = fuzzyCorrect("so we went to the store", entries);
    expect(corrected).toBe("so we went to the store");
    expect(corrections).toEqual([]);
  });

  it("keeps exact matches intact and claims the span", () => {
    const { corrected } = fuzzyCorrect("WhisperFlow and Qwen both work", entries);
    expect(corrected).toBe("WhisperFlow and Qwen both work");
  });

  it("is a no-op with an empty dictionary", () => {
    expect(fuzzyCorrect("hello wisprflow", []).corrected).toBe("hello wisprflow");
  });
});

describe("voice commands", () => {
  it("detects the built-in undo as a whole utterance", () => {
    const outcome = detectCommand("scratch that", []);
    expect(outcome.kind).toBe("matched");
    if (outcome.kind === "matched") {
      expect(outcome.match.command.id).toBe(BUILT_IN_COMMANDS[0]!.id);
      expect(applyCommand(outcome.match).action).toBe("undo");
    }
  });

  it("command-first keeps the rest as dictation text", () => {
    const outcome = detectCommand("scratch that and start over quickly", []);
    expect(outcome.kind).toBe("matched");
    if (outcome.kind === "matched") {
      expect(outcome.match.text).toMatch(/start over quickly/i);
      expect(applyCommand(outcome.match).final).toBe("");
    }
  });

  it("user commands take priority over built-ins", () => {
    const mine = [{ id: "x", phrase: "scratch that", action: "insert", payload: "REDACTED" }];
    const outcome = detectCommand("scratch that", mine);
    expect(outcome.kind).toBe("matched");
    if (outcome.kind === "matched") {
      expect(applyCommand(outcome.match)).toEqual({ action: "insert", final: "REDACTED" });
    }
  });

  it("insert commands prepend their payload", () => {
    const mine = [{ id: "sig", phrase: "sign off", action: "insert", payload: "Best, Naman" }];
    const outcome = detectCommand("sign off and thanks for the help", mine);
    expect(outcome.kind).toBe("matched");
    if (outcome.kind === "matched") {
      const applied = applyCommand(outcome.match);
      expect(applied.final).toContain("Best, Naman");
      expect(applied.final).toMatch(/thanks for the help/i);
    }
  });

  it("normal text never matches", () => {
    expect(detectCommand("let's scratch the surface of this topic", []).kind).toBe("none");
    expect(detectCommand("", []).kind).toBe("none");
  });
});

describe("offline polish fallback", () => {
  it("removes fillers and fixes basics", () => {
    expect(offlinePolish("um so basically yeah we went to the store")).toBe(
      "So basically yeah we went to the store.",
    );
  });

  it("capitalizes sentences and standalone i", () => {
    expect(offlinePolish("hello there. i am testing. it works")).toBe(
      "Hello there. I am testing. It works.",
    );
  });

  it("ends questions with a question mark", () => {
    expect(offlinePolish("what time is it")).toBe("What time is it?");
  });

  it("collapses immediate word stumbles", () => {
    expect(offlinePolish("the the meeting started")).toBe("The meeting started.");
  });

  it("leaves empty input alone", () => {
    expect(offlinePolish("   ")).toBe("   ");
  });
});
