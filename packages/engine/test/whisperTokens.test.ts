import { describe, expect, it } from "vitest";
import { isEmptyTranscript, stripWhisperTokens } from "../src/text/whisperTokens.js";

describe("stripWhisperTokens", () => {
  it("strips a standalone tag down to an empty transcript", () => {
    expect(stripWhisperTokens("[BLANK_AUDIO]")).toBe("");
    expect(stripWhisperTokens("  [SILENCE]  ")).toBe("");
    expect(stripWhisperTokens("[BEG] [END]")).toBe("");
  });

  it("removes a tag embedded mid-text without leaving a gap", () => {
    expect(stripWhisperTokens("hello [NOISE] world")).toBe("hello world");
    expect(stripWhisperTokens("[BEG] take this down [END]")).toBe("take this down");
    expect(stripWhisperTokens("the [MUSIC] meeting [SPEECH] went well")).toBe(
      "the meeting went well",
    );
  });

  it("leaves ordinary dictation text untouched", () => {
    expect(stripWhisperTokens("The Q3 report is due Friday.")).toBe("The Q3 report is due Friday.");
    // Bracketed words a user actually dictated are not whisper tags.
    expect(stripWhisperTokens("see the [notes] section")).toBe("see the [notes] section");
    expect(stripWhisperTokens("mixed case like [Note] survives")).toBe(
      "mixed case like [Note] survives",
    );
  });

  it("strips tags regardless of letter case", () => {
    expect(stripWhisperTokens("[blank_audio]")).toBe("");
    expect(stripWhisperTokens("uh [Noise] hmm")).toBe("uh hmm");
    expect(stripWhisperTokens("[blank_Audio] nothing here")).toBe("nothing here");
  });
});

describe("isEmptyTranscript", () => {
  it("treats tag-only transcripts as nothing was said", () => {
    expect(isEmptyTranscript("[BLANK_AUDIO]")).toBe(true);
    expect(isEmptyTranscript("   ")).toBe(true);
    expect(isEmptyTranscript("")).toBe(true);
    // Unknown tags whisper.cpp may invent still match the tag shape.
    expect(isEmptyTranscript("[MUSIC] [APPLAUSE]")).toBe(true);
  });

  it("keeps transcripts that still have words after stripping", () => {
    expect(isEmptyTranscript("hello world")).toBe(false);
    expect(isEmptyTranscript("[NOISE] hello")).toBe(false);
  });
});
