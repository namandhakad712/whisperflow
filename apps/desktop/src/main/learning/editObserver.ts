/**
 * Post-paste edit observation — the port of the reference app's
 * `UpdateEditedText` pipeline (report 06):
 *
 * After the text is pasted, the app watches the target text box (their window:
 * 60 s, keystroke-trace driven) and compares what the user left there against
 * what was dictated. The gap drives the learning loop:
 *   - `editDistanceToDictated` (normalized Levenshtein vs the dictated length)
 *   - `editedText` (the final region) stored on the history entry
 *   - `learnFromEdits` candidates auto-added to the dictionary, their
 *     `shouldAutoLearnWords` behavior (default true)
 *   - dictionary `frequencyUsed` bumps from the edited text
 *
 * End reasons (theirs: textbox_emptied, message_sent, edit_distance_exceeded,
 * diverged, listener_stopped…): we emit a compact set with the same meaning.
 */
import {
  bestMatchingRegion,
  normalizedEditDistance,
} from "@whisperflow/engine";
import {
  countDictionaryPhrases,
  learnFromEdits,
  type LearnedCandidate,
} from "@whisperflow/engine";

export type ObservationEndReason =
  | "unchanged" // box still holds what we dictated
  | "edited" // user changed the text
  | "emptied" // box cleared (message sent / field reset)
  | "timeout" // 60 s window elapsed with no settle
  | "unreadable"; // no editable target to observe

export interface ObservationResult {
  endReason: ObservationEndReason;
  /** Final state of the anchored region, when readable. */
  editedText?: string;
  /** Normalized Levenshtein (dictated → region), their editDistanceToDictated. */
  editDistance?: number;
  /** Dictionary candidates worth learning. */
  candidates: LearnedCandidate[];
}

export interface ObserveEditsDeps {
  dictated: string;
  /** Read the focused element's contents; null when not readable. */
  readContents: () => Promise<string | null>;
  dictionary: readonly string[];
  /** Their shouldAutoLearnWords (default true). */
  autoLearn?: boolean;
  pollMs?: number;
  maxMs?: number;
  log?: (msg: string) => void;
}

/**
 * Runs the observation window and calls back with the result. Never rejects;
 * errors are logged and surfaced as `unreadable`. Returns a disposer so the
 * caller can cancel early (new dictation started, app quitting).
 */
export function observeEdits(deps: ObserveEditsDeps, onResult: (r: ObservationResult) => void): () => void {
  const pollMs = deps.pollMs ?? 4000;
  const maxMs = deps.maxMs ?? 60_000;
  let cancelled = false;
  let last: string | null = null;
  let settledOnce = false;
  const timers: NodeJS.Timeout[] = [];

  const finish = (r: ObservationResult) => {
    if (cancelled) return;
    cancelled = true;
    for (const t of timers) clearTimeout(t);
    onResult(r);
  };

  (async () => {
    const initial = await deps.readContents().catch(() => null);
    if (cancelled) return;
    last = initial;
    if (initial === null) {
      finish({ endReason: "unreadable", candidates: [] });
      return;
    }
    timers.push(
      setTimeout(() => {
        if (!cancelled) finish(evaluate(deps, last ?? ""));
      }, maxMs),
    );

    for (;;) {
      await new Promise<void>((r) => {
        timers.push(setTimeout(r, pollMs));
      });
      if (cancelled) return;
      const now = await deps.readContents().catch(() => null);
      if (cancelled) return;
      if (now === null) {
        finish({ endReason: "unreadable", candidates: [] });
        return;
      }
      // Sent / cleared: the box emptied after holding text.
      if (now.trim() === "" && (last ?? "").trim() !== "") {
        finish({ endReason: "emptied", candidates: [] });
        return;
      }
      // Settle: two reads in a row agree after the user stopped typing.
      if (settledOnce && now === last) {
        finish(evaluate(deps, now));
        return;
      }
      settledOnce = now === last;
      last = now;
    }
  })();

  return () => {
    cancelled = true;
    for (const t of timers) clearTimeout(t);
  };
}

function evaluate(deps: ObserveEditsDeps, contents: string): ObservationResult {
  const dictated = deps.dictated.trim();
  if (!dictated) return { endReason: "unchanged", candidates: [] };
  const region = bestMatchingRegion(dictated, contents);
  const distance = normalizedEditDistance(dictated, region);
  const unchanged = distance === 0;
  const candidates =
    unchanged || deps.autoLearn === false
      ? []
      : learnFromEdits(dictated, region, { dictionary: deps.dictionary });
  if (!unchanged) {
    deps.log?.(`dictation: edited text observed — editDistance=${distance.toFixed(2)}`);
  }
  return {
    endReason: unchanged ? "unchanged" : "edited",
    editedText: unchanged ? undefined : region,
    editDistance: unchanged ? undefined : distance,
    candidates,
  };
}

/** Applies an observation's candidates to the config-backed dictionary.
 *  Returns the new entry list (the caller persists it) and what was added. */
export function applyLearnedWords(
  dictionary: readonly { id: string; term: string; observedSource?: string }[],
  candidates: readonly LearnedCandidate[],
): { added: string[]; next: { id: string; term: string; observedSource?: string }[] } {
  const lower = new Set(dictionary.map((d) => d.term.toLowerCase()));
  const next = [...dictionary];
  const added: string[] = [];
  for (const c of candidates) {
    if (lower.has(c.word.toLowerCase())) continue;
    lower.add(c.word.toLowerCase());
    next.push({ id: `auto-${Date.now()}-${next.length}`, term: c.word, observedSource: c.observedSource });
    added.push(c.word);
    if (added.length >= 4) break;
  }
  return { added, next };
}

/** Their `updateExistingDictionaryWordCounts`: how many known phrases the
 *  user actually used in the edited text (drives frequencyUsed/lastUsed). */
export function dictionaryPhraseHits(
  dictionary: readonly { term: string }[],
  editedText: string,
): number {
  return countDictionaryPhrases(
    dictionary.map((d) => d.term),
    editedText,
  ).size;
}
