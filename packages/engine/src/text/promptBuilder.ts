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
  const systemParts: string[] = [
    "You are the text-polishing stage of a voice dictation app. You receive raw speech-to-text output and return clean, ready-to-type text.",
    "Rules:",
    "- Preserve the speaker's meaning, language, and word choices. Never add new information, greetings, or commentary.",
    "- Remove filler words (um, uh, like, you know), stumbles, and repeated words.",
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
  if (input.language && input.language !== "auto") {
    systemParts.push(`Write the output in ${input.language}.`);
  }

  return { system: systemParts.join("\n"), user: input.raw };
}
