/**
 * Dictionary learning from user edits — a port of the reference app's
 * `learnFromEdits` (module 92967): when the user edits the pasted text, align
 * the dictated original with the edited text and extract substitution pairs
 * `{ word: editedWord, observedSource: originalWord }` that become dictionary
 * candidates. Their filters, verbatim in spirit:
 *   - non-empty, not identical,
 *   - not all stopwords,
 *   - not already in the dictionary (case-insensitive),
 *   - capped at 4 candidates per dictation.
 * Their build sends candidates to a server classifier; offline, we keep the
 * deterministic filters and leave the classifier out (documented, not faked).
 */

/** Their stopword filter — common words never become dictionary entries. */
export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "for", "with", "at", "by", "from", "it", "its", "this", "that",
  "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "our", "their", "so", "as", "not", "no", "yes", "do", "does", "did",
  "have", "has", "had", "will", "would", "can", "could", "should", "just", "about", "into",
]);

export interface LearnedCandidate {
  /** The word the user wrote instead. */
  word: string;
  /** What the STT output originally said. */
  observedSource: string;
}

type Step = { op: "match" | "sub" | "ins" | "del"; a?: string; b?: string };

/** Word-level alignment via a Levenshtein DP that emits substitutions
 *  directly (case-sensitive so a capitalization fix "john" → "Jon" is a
 *  substitution, not noise — the stopword filter then drops "i" → "I"). */
function alignWords(original: string[], edited: string[]): Step[] {
  const m = original.length;
  const n = edited.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = (dp[i - 1]?.[j - 1] ?? 0) + (original[i - 1] === edited[j - 1] ? 0 : 1);
      const up = (dp[i - 1]?.[j] ?? 0) + 1;
      const left = (dp[i]?.[j - 1] ?? 0) + 1;
      dp[i]![j] = Math.min(diag, up, left);
    }
  }
  const steps: Step[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const cost = (original[i - 1] ?? "") === (edited[j - 1] ?? "") ? 0 : 1;
    if (dp[i]?.[j] === (dp[i - 1]?.[j - 1] ?? 0) + cost) {
      steps.unshift(
        cost === 0
          ? { op: "match", a: original[i - 1], b: edited[j - 1] }
          : { op: "sub", a: original[i - 1], b: edited[j - 1] },
      );
      i--;
      j--;
    } else if (dp[i]?.[j] === (dp[i - 1]?.[j] ?? 0) + 1) {
      steps.unshift({ op: "del", a: original[i - 1] });
      i--;
    } else {
      steps.unshift({ op: "ins", b: edited[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    steps.unshift({ op: "del", a: original[i - 1] });
    i--;
  }
  while (j > 0) {
    steps.unshift({ op: "ins", b: edited[j - 1] });
    j--;
  }
  return steps;
}

const tokens = (s: string) => s.replace(/[^\p{L}\p{N}'-]+/gu, " ").trim().split(/\s+/).filter(Boolean);

const isWordish = (s: string) => /[^\p{L}\p{N}]/u.test(s) === false || /[\p{L}\p{N}]/u.test(s);

/**
 * Extract dictionary candidates from an edit. A substitution pair counts only
 * when both halves are word-like, non-identical (ignoring case), not all
 * stopwords, and at least 2 characters. Runs of insertions are treated as
 * "the user added a word" (not a correction) and skipped — their pipeline keys
 * on substitutions.
 */
export function learnFromEdits(
  original: string,
  edited: string,
  opts: { dictionary?: readonly string[]; maxCandidates?: number } = {},
): LearnedCandidate[] {
  const cap = opts.maxCandidates ?? 4;
  const dict = new Set((opts.dictionary ?? []).map((d) => d.toLowerCase()));
  if (!original.trim() || !edited.trim() || original.trim() === edited.trim()) return [];

  const steps = alignWords(tokens(original), tokens(edited));
  const out: LearnedCandidate[] = [];
  const seen = new Set<string>();
  for (const st of steps) {
    if (st.op !== "sub") continue;
    const word = (st.b ?? "").trim();
    const observed = (st.a ?? "").trim();
    const key = word.toLowerCase();
    if (!word || !observed || word.length < 2 || observed.length < 2) continue;
    if (word === observed) continue;
    if (!isWordish(word) || !isWordish(observed)) continue;
    // Their filter: only learn words the model got WRONG — stopwords-for-
    // stopwords are noise, and re-learning a known word is spam. A capitalization
    // fix ("bravo" → "Bravo") IS a real correction, so it survives here.
    if (STOPWORDS.has(key) && STOPWORDS.has(observed.toLowerCase())) continue;
    if (dict.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word, observedSource: observed });
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Their `updateExistingDictionaryWordCounts`: count each dictionary phrase's
 * occurrences in the edited text with `\b…\b` (case-insensitive) and return
 * the per-phrase hit counts, used to bump `frequencyUsed`/`lastUsed`.
 */
export function countDictionaryPhrases(
  dictionary: readonly string[],
  editedText: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const phrase of dictionary) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    const hits = editedText.match(re)?.length ?? 0;
    if (hits > 0) counts.set(phrase, hits);
  }
  return counts;
}
