/** Polish provider contract — local llama.cpp or any OpenAI-compatible endpoint. */
import type { PolishInput } from "../../text/promptBuilder.js";

export type { PolishInput };

export interface PolishProvider {
  readonly id: "llama-local" | "openai-compat";
  /** Cheap check: can this provider run right now (deps present, config sane)? */
  available(): Promise<boolean>;
  /** Streams polished text chunks; implementations may yield a single chunk. */
  polish(input: PolishInput): AsyncIterable<string>;
  dispose?(): void;
}
