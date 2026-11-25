/**
 * STT decode prompt builder (v0.1.54).
 *
 * whisper.cpp's --prompt is the previous-token context the decoder
 * conditions on. Two things belong there:
 *
 *   1. A compact vocabulary preamble — the personal dictionary's terms,
 *      so names and jargon decode right the FIRST time (decode-time
 *      biasing, the pattern Hex proved locally with its vocabulary
 *      list feeding Whisper at decode). Cheap: a few hundred tokens at
 *      most, zero extra passes.
 *   2. The rolling transcript tail — the prior utterances of THIS
 *      dictation, so topic and already-decoded names carry across
 *      segments (existed since v0.1.x as `raw.slice(-220)`).
 *
 * All wording is original WhisperFlow copy.
 */

/** Soft cap on preamble characters — whisper.cpp truncates long prompts
 *  internally, but we keep it lean so the tail context survives. */
const VOCAB_BUDGET_CHARS = 400;

/** Longest trailing transcript context kept, in characters. */
const TAIL_CHARS = 220;

/**
 * Builds the decode prompt for one STT segment.
 *
 * @param vocabulary personal-dictionary terms (deduped, capped here)
 * @param rawTail    the dictation's accumulated transcript so far
 * @param enabled    false → vocabulary off, tail behavior unchanged
 */
export function buildSttPrompt(
  vocabulary: readonly string[],
  rawTail: string,
  enabled: boolean,
): string {
  const tail = rawTail.slice(-TAIL_CHARS).trim();

  if (!enabled || vocabulary.length === 0) return tail;

  // Dedupe case-insensitively, keep the dictionary's own casing, cap by
  // character budget so one huge dictionary can't eat the context window.
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of vocabulary) {
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term.trim());
    if (terms.join(", ").length >= VOCAB_BUDGET_CHARS) break;
  }
  if (terms.length === 0) return tail;

  const preamble = `Terms the speaker uses, spelled exactly: ${terms.join(", ")}.`;
  return tail ? `${preamble}\n${tail}` : preamble;
}
