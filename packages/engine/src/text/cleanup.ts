/**
 * Offline cleanup fallback for when the polish LLM is disabled or unavailable.
 * Conservative by design: only obvious fixes, never rewrites meaning.
 */
export function offlinePolish(raw: string): string {
  if (!raw.trim()) return raw;

  let text = raw;

  // Discourse fillers as standalone words (never inside other words).
  text = text.replace(/\b(?:um+|uh+|erm+|hmm+|mhm+|err+)\b[,.]?\s*/giu, "");
  // Stumble restarts: "the the" → "the" (immediate repetition only).
  text = text.replace(/\b(\p{L}[\p{L}'-]*)\s+\1\b/giu, "$1");

  // Spacing around punctuation.
  text = text.replace(/\s+([,.!?;:])/gu, "$1");
  text = text.replace(/([,.!?;:])(?=[^\s\d])/gu, "$1 ");
  text = text.replace(/\s{2,}/gu, " ");

  // Standalone "i" → "I".
  text = text.replace(/\bi\b/gu, "I");

  // Sentence capitalization.
  text = text.replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_m, p1: string, p2: string) => p1 + p2.toUpperCase());

  // Terminal punctuation.
  text = text.trim();
  if (text && /\p{L}/u.test(text) && !/[.!?…"'»)\]]$/u.test(text)) {
    const endsWithEmojiOrTag = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]$/u.test(text);
    if (!endsWithEmojiOrTag) text += /^(who|what|when|where|why|how|is|are|do|does|did|can|could|should|would|will|am|was|were)\b/iu.test(text) ? "?" : ".";
  }

  return text;
}
