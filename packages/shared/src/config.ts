/**
 * `WhisperFlowConfig` zod schema + defaults. This file is THE config contract;
 * `config.json` on disk must parse against `WhisperFlowConfigSchema`.
 *
 * Every nested object and field carries a default, so `{}` parses into a fully
 * valid config and partial JSON (older versions) upgrades transparently.
 */
import { z } from "zod";
import type { DictionaryEntry, VoiceCommand } from "./entities.js";

/** Polish tone presets. `custom` uses `polish.customInstructions`. */
export type ToneId = "neutral" | "casual" | "professional" | "custom";

/** Global push-to-talk hotkey. */
export const HotkeyConfigSchema = z.object({
  /** Accelerator string, e.g. `"Control+Shift+Space"`. */
  pushToTalk: z.string().min(1).default("Control+Shift+Space"),
  /** `false` = hold-to-talk, `true` = press to start / press to stop. */
  toggleMode: z.boolean().default(false),
});
export type HotkeyConfig = z.infer<typeof HotkeyConfigSchema>;

/** Voice-activity-detector selection and tuning. */
export const VadConfigSchema = z.object({
  /** `"rms"` is pure TS and always available; `"silero"` needs the ONNX model. */
  kind: z.enum(["rms", "silero"]).default("rms"),
  /** 0–1. Higher = more sensitive (quieter speech detected). */
  sensitivity: z.number().min(0).max(1).default(0.5),
  /** Trailing silence (ms) that ends a speech segment. */
  silenceMs: z.number().int().min(100).max(5000).default(700),
});
export type VadConfig = z.infer<typeof VadConfigSchema>;

export const AudioConfigSchema = z.object({
  /** Media device id, `"default"` = system default input. */
  deviceId: z.string().default("default"),
  vad: VadConfigSchema.prefault({}),
});
export type AudioConfig = z.infer<typeof AudioConfigSchema>;

export const SttConfigSchema = z.object({
  provider: z.literal("whispercpp-local").default("whispercpp-local"),
  /** Catalog id, e.g. `"whisper-base-en" | "whisper-small" | "whisper-large-v3-turbo"`. */
  modelId: z.string().default("whisper-small"),
  /** BCP-47-ish tag or `"auto"`. */
  language: z.string().default("auto"),
});
export type SttConfig = z.infer<typeof SttConfigSchema>;

/** BYO OpenAI-compatible endpoint for polish. Blocked when `privacy.localOnly`. */
export const RemotePolishConfigSchema = z.object({
  /** Base URL, e.g. `"https://api.openai.com/v1"` — no trailing `/chat/completions`. */
  baseUrl: z.string().default(""),
  /** API key. Stored locally in config.json only. */
  apiKey: z.string().default(""),
  /** Remote model name, e.g. `"gpt-4o-mini"` or `"qwen2.5-72b-instruct"`. */
  model: z.string().default(""),
});
export type RemotePolishConfig = z.infer<typeof RemotePolishConfigSchema>;

export const PolishConfigSchema = z.object({
  /** `"none"` disables polish and uses the offline cleanup fallback. */
  provider: z
    .enum(["llama-local", "openai-compat", "none"])
    .default("llama-local"),
  /** Catalog id of the local GGUF model. */
  modelId: z.string().default("qwen3.5-4b-q4"),
  /** LLM sampling temperature — low keeps dictation faithful. */
  temperature: z.number().min(0).max(2).default(0.2),
  tone: z.enum(["neutral", "casual", "professional", "custom"]).default("neutral"),
  /** Free-form extra instructions used when `tone === "custom"`. */
  customInstructions: z.string().default(""),
  remote: RemotePolishConfigSchema.prefault({}),
});
export type PolishConfig = z.infer<typeof PolishConfigSchema>;

export const DictionaryEntrySchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  pronunciation: z.string().optional(),
  hint: z.string().optional(),
});

export const VoiceCommandSchema = z.object({
  id: z.string().min(1),
  phrase: z.string().min(1),
  action: z.enum(["undo", "insert", "replace"]),
  payload: z.string().optional(),
});

export const PrivacyConfigSchema = z.object({
  /** `true` ⇒ remote (network) providers are hard-blocked, no exceptions. */
  localOnly: z.boolean().default(true),
});
export type PrivacyConfig = z.infer<typeof PrivacyConfigSchema>;

export const GeneralConfigSchema = z.object({
  launchAtLogin: z.boolean().default(true),
  historyEnabled: z.boolean().default(true),
  overlayFollowsCursor: z.boolean().default(true),
    /** Custom overlay backdrop: path/URL to an image or GIF the user picked. */
    overlayBackdrop: z.string().default(""),
});
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;

export const UpdatesConfigSchema = z.object({
  channel: z.enum(["stable", "beta"]).default("stable"),
});
export type UpdatesConfig = z.infer<typeof UpdatesConfigSchema>;

/** Root config schema — the shape of `config.json`. */
export const WhisperFlowConfigSchema = z.object({
  hotkey: HotkeyConfigSchema.prefault({}),
  audio: AudioConfigSchema.prefault({}),
  stt: SttConfigSchema.prefault({}),
  polish: PolishConfigSchema.prefault({}),
  dictionary: z.array(DictionaryEntrySchema).default([]),
  commands: z.array(VoiceCommandSchema).default([]),
  privacy: PrivacyConfigSchema.prefault({}),
  general: GeneralConfigSchema.prefault({}),
  updates: UpdatesConfigSchema.prefault({}),
});
export type WhisperFlowConfig = z.infer<typeof WhisperFlowConfigSchema>;

/** Recursively-optional patch accepted by `settings/set` and `ConfigStore.set`. */
export type WhisperFlowConfigPatch = Patch<WhisperFlowConfig>;
type Patch<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? Patch<T[K]>
      : T[K];
};

/** The factory default config (schema-derived, never hand-maintained). */
export const DEFAULT_CONFIG: WhisperFlowConfig = WhisperFlowConfigSchema.parse({});
