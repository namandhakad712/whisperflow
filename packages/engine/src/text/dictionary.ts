/**
 * Post-STT fuzzy correction against the user's personal dictionary.
 *
 * Works on tokens (words) with positions so replacement preserves surrounding
 * text exactly. Tolerates 1 edit on short tokens (≥ 4 chars) and 2 on long
 * ones (≥ 7 chars); multi-word terms match a sliding window of tokens with a
 * total edit budget of one per word, at least half of the words exact.
 */
import type { DictionaryEntry } from "@whisperflow/shared";

interface Token {
  text: string;
  start: number;
  end: number;
}

export interface DictionaryCorrection {
  from: string;
  to: string;
}

const WORD_RE = /\p{L}[\p{L}\p{N}'-]*/gu;

export function fuzzyCorrect(text: string, entries: readonly DictionaryEntry[]): {
  corrected: string;
  corrections: DictionaryCorrection[];
} {
  if (!text || entries.length === 0) return { corrected: text, corrections: [] };

  const tokens: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    tokens.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  if (tokens.length === 0) return { corrected: text, corrections: [] };

  // (start, end, replacement, fromText) — token-indexed spans.
  const edits: Array<{ fromIdx: number; toIdx: number; term: string; fromText: string }> = [];

  for (const entry of entries) {
    const termWords = splitWords(entry.term);
    if (termWords.length === 0) continue;

    for (let i = 0; i <= tokens.length - termWords.length; i++) {
      const window = tokens.slice(i, i + termWords.length);
      if (window.some((t) => t.text.length < 2)) continue;
      if (edits.some((e) => i >= e.fromIdx && i < e.toIdx)) continue; // already claimed

      let totalDistance = 0;
      let totalBudget = 0;
      let exactWords = 0;
      let everyWordClose = true;
      for (let w = 0; w < termWords.length; w++) {
        const d = levenshtein(window[w]!.text.toLowerCase(), termWords[w]!.toLowerCase());
        if (d === 0) exactWords++;
        totalDistance += d;
        const len = Math.max(window[w]!.text.length, termWords[w]!.length);
        const budget = wordBudget(len);
        totalBudget += budget;
        if (d > budget) everyWordClose = false;
      }

      // For multi-word terms, at least half the words must match exactly (guards
      // against sliding windows of unrelated words); single-word terms are pure fuzzy.
      const minExactWords = termWords.length >= 2 ? Math.ceil(termWords.length / 2) : 0;

      const isMatch =
        totalDistance > 0 &&
        totalDistance <= totalBudget &&
        exactWords >= minExactWords &&
        everyWordClose;

      const isExact = totalDistance === 0;

      if (isExact) {
        // Exact matches claim the span so cheaper spellings don't fight over it.
        edits.push({
          fromIdx: i,
          toIdx: i + termWords.length,
          term: entry.term,
          fromText: window.map((t) => t.text).join(" "),
        });
        break;
      }
      if (isMatch) {
        edits.push({
          fromIdx: i,
          toIdx: i + termWords.length,
          term: entry.term, // dictionary terms insert verbatim — the user's canonical spelling
          fromText: window.map((t) => t.text).join(" "),
        });
        break;
      }
    }
  }

  if (edits.length === 0) return { corrected: text, corrections: [] };

  // Apply from the end so earlier indices stay valid.
  edits.sort((a, b) => b.fromIdx - a.fromIdx);
  let out = text;
  for (const e of edits) {
    const from = tokens[e.fromIdx]!;
    const to = tokens[e.toIdx - 1]!;
    out = out.slice(0, from.start) + e.term + out.slice(to.end);
  }
  return {
    corrected: out,
    corrections: edits.map((e) => ({ from: e.fromText, to: e.term })),
  };
}

/** Allowed edits for a word of this length: 0 short, 1 medium, 2 long. */
function wordBudget(len: number): number {
  if (len >= 7) return 2;
  if (len >= 4) return 1;
  return 0;
}

function splitWords(term: string): string[] {
  return term.match(WORD_RE) ?? [];
}

/** Classic two-row Levenshtein distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}
