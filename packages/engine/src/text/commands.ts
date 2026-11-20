/**
 * Spoken voice commands: a phrase at the start, end, or whole utterance
 * triggers an action; any remaining text is kept as the dictation body.
 */
import type { VoiceCommand } from "@whisperflow/shared";
import { levenshtein } from "./dictionary.js";

/** Ships with every install; user commands take priority when phrases clash. */
export const BUILT_IN_COMMANDS: readonly VoiceCommand[] = [
  { id: "builtin-scratch-that", phrase: "scratch that", action: "undo" },
];

export interface CommandMatch {
  command: VoiceCommand;
  /** Transcript with the command phrase removed. */
  text: string;
}

export type CommandOutcome =
  | { kind: "none" }
  | { kind: "matched"; match: CommandMatch }
  | { kind: "undone"; match: CommandMatch };

/** Detects a command in a transcript; user commands beat built-ins. */
export function detectCommand(
  transcript: string,
  commands: readonly VoiceCommand[],
): CommandOutcome {
  const normalized = normalize(transcript);
  if (!normalized) return { kind: "none" };

  const ordered = [...commands, ...BUILT_IN_COMMANDS.filter((b) => !commands.some((c) => normalize(c.phrase) === normalize(b.phrase)))];

  for (const command of ordered) {
    const phrase = normalize(command.phrase);
    if (!phrase) continue;

    if (normalized === phrase || fuzzyEqual(normalized, phrase)) {
      return { kind: "matched", match: { command, text: "" } };
    }
    if (normalized.startsWith(phrase + " ")) {
      return { kind: "matched", match: { command, text: denormalizedRest(transcript, phrase.length + 1) } };
    }
    if (normalized.endsWith(" " + phrase)) {
      return { kind: "matched", match: { command, text: denormalizedRest(transcript, 0, transcript.length - phrase.length - 1) } };
    }
    // "scratch that <text>" — command first is the natural speaking order.
    if (normalized.startsWith(phrase + " ") || normalized.endsWith(" " + phrase)) continue;
  }
  return { kind: "none" };
}

/** Applies a matched command to produce the final injected text ("" for undo). */
export function applyCommand(match: CommandMatch): { action: VoiceCommand["action"]; final: string } {
  const { command, text } = match;
  switch (command.action) {
    case "undo":
      return { action: "undo", final: "" };
    case "insert":
      return { action: "insert", final: joinParts(command.payload ?? "", text) };
    case "replace":
      return { action: "replace", final: command.payload ?? "" };
  }
}

const joinParts = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

function fuzzyEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 6) return false;
  return levenshtein(a, b) / maxLen <= 0.18;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cuts the body out of the ORIGINAL transcript using the normalized length —
 * punctuation differences between the two are rare enough that the ratio of
 * normalized to original characters keeps the cut close to correct.
 */
function denormalizedRest(transcript: string, fromNormalized: number, toNormalized?: number): string {
  const scale = transcript.length / Math.max(1, normalize(transcript).length);
  const from = Math.round(fromNormalized * scale);
  const to = toNormalized === undefined ? transcript.length : Math.round(toNormalized * scale);
  return transcript.slice(from, to).replace(/^[\s,.\u2014-]+|[\s,]+$/gu, "").trim();
}
