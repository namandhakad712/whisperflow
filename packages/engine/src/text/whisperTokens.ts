/**
 * whisper.cpp prints bracketed pseudo-tags as literal transcript text when a
 * segment has no speech (or is otherwise tagged): `[BLANK_AUDIO]` is the
 * common one, older releases emit `[SILENCE]`, `[NOISE]`, `[MUSIC]`,
 * `[SPEECH]`, `[BEG]`, `[END]`. Left alone, the parser treats them as words
 * and they get pasted straight into the user's document.
 *
 * These helpers are the single choke point: every STT result passes through
 * `stripWhisperTokens` before the text is used, and a transcript that is
 * empty afterwards is "nothing was said".
 */

/**
 * A bracketed token of uppercase letters, digits and underscores — the shape
 * whisper.cpp uses for every tag it prints (`[BLANK_AUDIO]`, `[APPLAUSE]`, …).
 * Case-sensitive so ordinary words in brackets survive: "[Note]" is dictation,
 * "[NOTE]" is a tag.
 */
const UPPERCASE_TAG = /\s*\[[A-Z][A-Z0-9_]*\]\s*/gu;
/**
 * The known tag names, matched leniently (any case, possible odd spacing) so a
 * model that lower-cases its output — `[blank_audio]`, `[Noise]` — is still
 * caught.
 */
const KNOWN_TAG = /\s*\[\s*(?:BLANK_AUDIO|SILENCE|NOISE|MUSIC|SPEECH|BEG|END)\s*\]\s*/giu;

/**
 * Removes every whisper.cpp special tag from `text`, folding in the stray
 * spaces a removed tag leaves behind. Normal words — including bracketed ones
 * a user actually dictated like "[notes]" — are left untouched.
 */
export function stripWhisperTokens(text: string): string {
  if (!text) return text;
  return text.replace(UPPERCASE_TAG, " ").replace(KNOWN_TAG, " ").trim();
}

/**
 * True when `text` is nothing but whitespace and/or whisper.cpp tags — i.e.
 * nothing was actually said, and the segment must be dropped rather than
 * stored, polished or pasted.
 */
export function isEmptyTranscript(text: string): boolean {
  return stripWhisperTokens(text) === "";
}
