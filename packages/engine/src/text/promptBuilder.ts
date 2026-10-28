/**
 * Builds the polish-LLM prompts. All wording here is original WhisperFlow
 * copy — nothing is lifted from any other product.
 */
import type { ToneId } from "@whisperflow/shared";

export interface PolishInput {
  raw: string;
  tone: ToneId;
  /** Active polish catalog model id (local GGUF or remote model name). */
  modelId: string;
  /** App the text will be typed into, when known (e.g. "Slack", "VS Code"). */
  app?: string;
  /** ISO-ish language tag or "auto". */
  language?: string;
  /** Dictionary terms the user wants respected verbatim. */
  dictionary: readonly string[];
  /** Free-form instructions when tone === "custom". */
  instructions?: string;
  /** Filler-word cleanup strength ("Auto cleanup" in settings). */
  cleanup?: "off" | "light" | "strong";
  /**
   * Classified target-app type (replicated from the reference app's AppType):
   * email apps get a signature, messaging apps drop the trailing period, and
   * AI apps skip cleanup entirely.
   */
  appType?: "email" | "ai" | "terminal" | "other";
  /** True for chat/messaging apps (their messaging-process list). */
  isMessaging?: boolean;
  /** Signature lines to append when dictating into an email app. */
  emailSignature?: string;
}

export interface PolishMessages {
  system: string;
  user: string;
}

const TONE_RULES: Record<ToneId, string> = {
  neutral: "Keep the speaker's tone neutral and clear. Do not make it more formal or more casual than spoken.",
  casual: "Keep the tone casual and conversational — contractions are fine, keep it loose but intelligible.",
  professional: "Make the tone professional and concise. Remove rambling, tighten phrasing, but never invent facts.",
  custom: "Follow the user's custom instructions below instead of a preset tone.",
};

export function buildPolishMessages(input: PolishInput): PolishMessages {
  // AI apps: their build skips auto-cleanup entirely when appType === "ai".
  const cleanup = input.appType === "ai" ? "off" : input.cleanup ?? "light";
  const systemParts: string[] = [
    "You are the text-polishing stage of a voice dictation app. You receive raw speech-to-text output and return clean, ready-to-type text.",
    "Rules:",
    "- Preserve the speaker's meaning, language, and word choices. Never add new information, greetings, or commentary.",
    cleanup === "off"
      ? "- Do NOT remove anything the speaker said; fix only punctuation, capitalization, and obvious transcription errors."
      : cleanup === "strong"
        ? "- Remove filler words (um, uh, like, you know), stumbles, repeated words, and false starts. Tighten rambling sentences, but keep every fact."
        : "- Remove filler words (um, uh, like, you know), stumbles, and repeated words.",
    "- Fix punctuation, capitalization, and obvious transcription errors.",
    "- Keep numbers, names, URLs, and code-like tokens exactly as spoken.",
    "- If the text is already clean, return it unchanged.",
    "- Respond with ONLY the final text. No preamble, no quotes, no explanations.",
    TONE_RULES[input.tone],
  ];

  if (input.tone === "custom" && input.instructions?.trim()) {
    systemParts.push(`Custom instructions: ${input.instructions.trim()}`);
  }
  if (input.dictionary.length > 0) {
    const terms = [...new Set(input.dictionary)].slice(0, 64).map((t) => `"${t}"`).join(", ");
    systemParts.push(`The user's personal dictionary — use exactly these spellings when the meaning matches: ${terms}.`);
  }
  if (input.app) {
    systemParts.push(`The text will be typed into ${input.app}; format appropriately for that context.`);
  }
  if (input.isMessaging) {
    // Their behavior: trailing periods read as stern in chat, so they strip them.
    systemParts.push(
      "This is a chat app: do not end the message with a terminal period unless the speaker clearly ended a sentence with emphasis. Prefer no trailing period on short messages.",
    );
  }
  if (input.appType === "email") {
    systemParts.push(
      "This is an email composer: keep paragraph breaks where the speaker paused, and end with the email signature below, separated by a blank line.",
    );
  }
  if (input.language && input.language !== "auto") {
    systemParts.push(`Write the output in ${input.language}.`);
  }

  const user =
    input.appType === "email" && input.emailSignature?.trim()
      ? `${input.raw}\n\n[append this signature after the body, starting on its own line: ${input.emailSignature.trim()}]`
      : input.raw;

  return { system: systemParts.join("\n"), user };
}
