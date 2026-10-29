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
  /**
   * Hold-to-talk needs a global keyboard hook (uiohook-napi) to see key-up
   * events; Electron's globalShortcut only fires on key-down. When the hook is
   * unavailable this silently falls back to toggle mode.
   */
  holdMode: z.boolean().default(false),
  /**
   * Their per-action shortcut map. We keep the primary PTT binding above and
   * add their dictation-adjacent actions; the Win defaults below are theirs
   * (`Shift+Alt+Z` = paste_last, `Shift+Alt+X` = copy_last). Dismiss is `Esc`
   * in both builds.
   */
  shortcuts: z
    .object({
      /** Their `paste_last_text` — re-type the last dictation. */
      pasteLast: z.string().min(1).default("Shift+Alt+Z"),
      /** Their `copy_last_text` — put the last dictation on the clipboard. */
      copyLast: z.string().min(1).default("Shift+Alt+X"),
    })
    .prefault({}),
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
  /**
   * Hard cap on a single dictation, in milliseconds (0 = unlimited). Default
   * is the reference app's DICTATION_DURATION_TIMEOUT — 20 minutes, with a
   * warning one minute before — so a hotkey held by accident cannot fill the
   * disk with a 6-hour recording. `maxRecordingLengthMs` in their build is the
   * debug override of exactly this cap.
   */
  maxRecordingLengthMs: z.number().int().nonnegative().default(20 * 60_000),
});
export type AudioConfig = z.infer<typeof AudioConfigSchema>;

/**
 * Cloud STT provider presets for BYO-key transcription.
 *
 * Every number here was fetched from the provider's own docs on the date in
 * `verified`. Re-verify before quoting them in marketing copy.
 */
export const CLOUD_STT_PRESETS = {
  groq: {
    label: "Groq — free tier",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "whisper-large-v3-turbo",
    models: ["whisper-large-v3-turbo", "whisper-large-v3"],
    docs: "https://console.groq.com/docs/speech-to-text",
    freeNote:
      "Free tier (Groq's rate-limits table): 20 RPM, 2,000 requests/day, 7,200 audio-sec/hour (ASH), 28,800 audio-sec/day (ASD). Groq's data page says inputs are not retained by default (abuse logs ≤30 days; zero-data-retention available).",
    verified: "2026-10-29",
  },
  mistral: {
    label: "Mistral — Voxtral 3",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "voxtral-mini-transcribe-3-0",
    models: ["voxtral-mini-transcribe-3-0", "voxtral-small-transcribe-3-0"],
    docs: "https://docs.mistral.ai/studio/audio/overview",
    freeNote:
      "No free Voxtral quota as of 2026-10-29: Mistral prices Voxtral 3 purely per minute ($0.0035/min Mini Transcribe, $0.0040/min Small Transcribe — about $0.21/hour for Mini) and nothing in their docs, pricing, or Voxtral announcement lists any free audio quota. Treat older '~$10/month free' reports as outdated — this is a pay-per-minute endpoint.",
    verified: "2026-10-29",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-transcribe",
    models: ["gpt-transcribe", "whisper-1"],
    docs: "https://platform.openai.com/docs/api-reference/audio",
    freeNote:
      "No free tier — pay per minute. `gpt-transcribe` is $0.0045/min. `whisper-1` is deprecated (announced 2026-08-26) with a shutdown date of 2027-02-26; `gpt-transcribe` is the current model.",
    verified: "2026-10-29",
  },
  custom: {
    label: "Custom — OpenAI-compatible endpoint",
    baseUrl: "",
    defaultModel: "",
    models: [],
    docs: "",
    freeNote: "Anything that speaks POST /audio/transcriptions and returns JSON { text }.",
    verified: "2026-10-29",
  },
} as const;

export type CloudSttProviderId = keyof typeof CLOUD_STT_PRESETS;

/** BYO cloud STT endpoint (OpenAI /audio/transcriptions format). Blocked when `privacy.localOnly`. */
export const CloudSttConfigSchema = z.object({
  /** Preset decides the default base URL + model list. */
  provider: z.enum(["groq", "mistral", "openai", "custom"]).default("groq"),
  /** Base URL. Empty = the preset's default. */
  baseUrl: z.string().default(""),
  /** API key. Stored locally in config.json only — never sent anywhere but the endpoint. */
  apiKey: z.string().default(""),
  /** Endpoint model id. Empty = the preset's default. */
  model: z.string().default(""),
});
export type CloudSttConfig = z.infer<typeof CloudSttConfigSchema>;

export const SttConfigSchema = z.object({
  /** `"whispercpp-local"` runs on this machine; `"cloud"` uses your BYO key. */
  provider: z.enum(["whispercpp-local", "cloud"]).default("whispercpp-local"),
  /** Catalog id, e.g. `"whisper-base-en" | "whisper-small" | "whisper-large-v3-turbo"`. */
  modelId: z.string().default("whisper-small"),
  /**
   * BCP-47-ish tag or `"auto"` — the resolved language (see
   * `resolveSttLanguage`). Kept for back-compat: it is the selected language
   * when `languages` is empty.
   */
  language: z.string().default("auto"),
  /**
   * Their `selectedLanguages` — the set of languages you speak. With exactly
   * one entry and auto-detect off, that language is sent as the *explicit*
   * ASR parameter (no auto-detect); with several, they act as detection hints
   * and the engine picks ("Flow will detect your language automatically. Make
   * sure all the languages you speak are selected.").
   */
  languages: z.array(z.string().min(1)).default([]),
  /** Their auto-detect toggle ("Automatic language detection"). */
  autoDetect: z.boolean().default(true),
  cloud: CloudSttConfigSchema.prefault({}),
  /**
   * Backup engine used when the primary one fails mid-dictation.
   * `"none"` (default) never silently sends audio anywhere: a failed local run
   * stays local, a failed cloud run fails loudly.
   */
  fallback: z.enum(["none", "local", "cloud"]).default("none"),
});
export type SttConfig = z.infer<typeof SttConfigSchema>;

/**
 * Their language resolution, verbatim:
 *   getLanguages() = effectiveLanguages ?? selectedLanguages
 *   exactly one selected + auto-detect off → that language is explicit (no guessing);
 *   several selected + auto-detect off → auto-detect restricted to that set
 *   (the local whisper adapter has no hint list, so it degrades to `auto`);
 *   auto-detect on → "auto".
 * `effectiveLanguages` is the runtime override their language widget sets
 * mid-session; pass it in when you have one.
 */
export function resolveSttLanguage(
  stt: Pick<SttConfig, "language" | "languages" | "autoDetect">,
  effectiveLanguages?: readonly string[],
): string {
  const selected = effectiveLanguages?.length ? effectiveLanguages : stt.languages;
  if (stt.autoDetect) return "auto";
  if (selected.length === 1) return selected[0] ?? "auto";
  if (selected.length > 1) return "auto"; // hints, not a forced language
  return stt.language;
}

/** User-added model entries appended to the built-in catalog. */
export const CustomModelEntrySchema = z.object({
  id: z.string().min(1),
  role: z.enum(["stt", "polish"]),
  name: z.string().min(1),
  repo: z.string().min(1),
  file: z.string().min(1),
  url: z.string().min(1),
  format: z.enum(["ggml", "gguf"]),
  sizeBytes: z.number().int().positive().optional(),
  license: z.string().optional(),
  notes: z.string().optional(),
});
export type CustomModelEntry = z.infer<typeof CustomModelEntrySchema>;

export const ModelsConfigSchema = z.object({
  custom: z.array(CustomModelEntrySchema).default([]),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

/** BYO OpenAI-compatible endpoint for polish. Blocked when `privacy.localOnly`. */
export const RemotePolishConfigSchema = z.object({
  /** Provider preset — `custom` keeps any baseUrl/model pair from older configs. */
  provider: z.enum(["groq", "openrouter", "openai", "mistral", "ollama", "custom"]).default("custom"),
  /** Base URL, e.g. `"https://api.groq.com/openai/v1"` — no trailing `/chat/completions`. */
  baseUrl: z.string().default(""),
  /** API key. Stored locally in config.json only. */
  apiKey: z.string().default(""),
  /** Remote model name, e.g. `"gpt-4o-mini"` or `"qwen2.5-72b-instruct"`. */
  model: z.string().default(""),
});
export type RemotePolishConfig = z.infer<typeof RemotePolishConfigSchema>;

/**
 * One-click polish endpoints. Polish is a tiny job — a small model at low
 * temperature, or a small free endpoint, is plenty. Verified 2026-10-29.
 */
export const POLISH_PRESETS = {
  groq: {
    label: "Groq · gpt-oss-20b",
    hint: "Fast, ~1,000 req/day free",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    note: "Groq's free tier (30 RPM, 1,000 req/day for gpt-oss models). gpt-oss-20b is the smaller of the two gpt-oss models — plenty for polish, and faster than the 120B. Inputs not retained by default; ZDR available.",
  },
  openrouterPoolside: {
    label: "OpenRouter · Poolside Laguna S 2.1",
    hint: "$0 endpoint (poolside/laguna-s-2.1:free)",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "poolside/laguna-s-2.1:free",
    note: "Poolside's Laguna is a text→text model with a $0 OpenRouter endpoint (verified on its OpenRouter model page: free, 262k ctx). Not a speech model — this is for polish only. Training policy is per-upstream-provider.",
  },
} as const;

export type PolishPresetId = keyof typeof POLISH_PRESETS;

/**
 * Cloud polish presets — the same shape as CLOUD_STT_PRESETS so the two cloud
 * surfaces look and behave identically: pick a provider, pick a model from
 * that provider's list, optionally override the base URL, paste a key, test.
 * Model ids verified against each provider's docs on the `verified` date.
 */
export const POLISH_CLOUD_PRESETS = {
  groq: {
    label: "Groq — free tier",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-20b",
    models: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    docs: "https://console.groq.com/docs/models",
    freeNote:
      "Free tier for the gpt-oss models (Groq's rate-limits table): 30 RPM, 1,000 requests/day. The two llama-3.x models are still listed as production models but no longer appear in the published free-tier limits table — treat their free limits as unverified.",
    verified: "2026-10-29",
  },
  openrouter: {
    label: "OpenRouter — free endpoints",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-oss-120b:free",
    models: ["openai/gpt-oss-120b:free", "meta-llama/llama-3.3-70b-instruct:free", "poolside/laguna-s-2.1:free"],
    docs: "https://openrouter.ai/models",
    freeNote:
      "All three ids verified free on their OpenRouter model pages (2026-10-29): gpt-oss-120b:free (131k ctx), llama-3.3-70b-instruct:free (131k ctx), poolside/laguna-s-2.1:free (262k ctx). The `:free` variants rate-limit; a paid key falls back to the same ids without the suffix. Free-endpoint policies are per-upstream-provider.",
    verified: "2026-10-29",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-6-luna",
    models: ["gpt-6-luna", "gpt-6.1-terra"],
    docs: "https://platform.openai.com/docs/models",
    freeNote: "No free tier — pay per token. The GPT-4 series (gpt-4.1-mini, gpt-4o-mini, gpt-4o) was deprecated 2026-10-14 with shutdown 2027-01-14, so those ids are gone; gpt-6-luna is the thrift pick at $0.10 in / $0.50 out per 1M tokens. Polish tokens are cheap (short prompts, short outputs).",
    verified: "2026-10-29",
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"],
    docs: "https://docs.mistral.ai/getting-started/models/models_overview/",
    freeNote:
      "Pay per token. The old ids open-mistral-nemo and magistral-medium-latest are deprecated/retired (Mistral's models-overview deprecated table) and were removed here. `mistral-small-latest` (Mistral Small 4) is the thriftiest current pick; mistral-medium-latest and mistral-large-latest are the current completion aliases used in Mistral's own docs. No free quota is documented for these models — don't count on one.",
    verified: "2026-10-29",
  },
  ollama: {
    label: "Ollama — self-hosted",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5:3b",
    models: ["qwen2.5:3b", "qwen2.5:7b", "llama3.2:3b"],
    docs: "https://ollama.com/library",
    freeNote:
      "Runs on your own machine — nothing leaves it. All three tags live on ollama.com/library (qwen2.5:3b ~1.9 GB, qwen2.5:7b ~4.7 GB, llama3.2:3b ~2.0 GB). `qwen2.5:3b` is plenty for polish; `ollama pull qwen2.5:3b` first.",
    verified: "2026-10-29",
  },
  custom: {
    label: "Custom — OpenAI-compatible endpoint",
    baseUrl: "",
    defaultModel: "",
    models: [],
    docs: "",
    freeNote: "Anything that speaks POST /chat/completions and returns OpenAI chat JSON.",
    verified: "2026-10-29",
  },
} as const;

export type PolishCloudProviderId = keyof typeof POLISH_CLOUD_PRESETS;

export const PolishConfigSchema = z.object({
  /** `"none"` disables polish and uses the offline cleanup fallback. */
  provider: z
    .enum(["llama-local", "openai-compat", "none"])
    .default("llama-local"),
  /** Master switch — "Apply AI formatting" in the reference app's settings. */
  enabled: z.boolean().default(true),
  /** Catalog id of the local GGUF model. Qwen3.5 2B (Q4) is the smallest
   *  competent option — polish is text cleanup, not frontier reasoning, so the
   *  4B download is wasteful for most users. */
  modelId: z.string().default("qwen3.5-2b-q4"),
  /** LLM sampling temperature — low keeps dictation faithful. */
  temperature: z.number().min(0).max(2).default(0.2),
  tone: z.enum(["neutral", "casual", "professional", "custom"]).default("neutral"),
  /** Free-form extra instructions used when `tone === "custom"`. */
  customInstructions: z.string().default(""),
  /**
   * Reference app's transcription-format enum (their defaultTranscriptionFormat):
   * "formatted" = "Apply AI formatting" (default), "raw" = "No AI formatting",
   * "casual" = "Casual messaging" (capitalise proper nouns only), "lowercase" =
   * "All lowercase".
   */
  format: z.enum(["formatted", "raw", "casual", "lowercase"]).default("formatted"),
  /**
   * Filler-word cleanup strength — their autoCleanup.level enum verbatim:
   * none ("Transcribes exactly what you said, including mistakes"), light
   * ("Cleans up filler words and grammar"), medium ("Edits for clarity and
   * conciseness"), high, full. Their UI exposes None/Light/Medium.
   */
  cleanup: z
    .preprocess(
      (v) => (v === "off" ? "none" : v === "strong" ? "high" : v),
      z.enum(["none", "light", "medium", "high", "full"]).default("light"),
    ),
  /**
   * "Add a signature when dictating an email" — only appends when the target
   * app is classified as an email client (the reference app's emailAutoSignature).
   */
  emailSignature: z.boolean().default(false),
  /** Signature body appended after a blank line. */
  emailSignatureText: z.string().default("— Sent with WhisperFlow"),
  remote: RemotePolishConfigSchema.prefault({}),
  /**
   * When the remote polish endpoint fails (quota, network, 5xx), retry on the
   * local GGUF model if it is downloaded. If it isn't, offline cleanup runs —
   * dictation is never blocked by the polish stage.
   */
  fallbackToLocal: z.boolean().default(true),
});
export type PolishConfig = z.infer<typeof PolishConfigSchema>;

export const DictionaryEntrySchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  pronunciation: z.string().optional(),
  hint: z.string().optional(),
  /**
   * What the STT originally said before the user corrected it to `term` — set
   * by auto-learn (their `observedSource`, saved with auto-added words so the
   * source of an entry is never a mystery).
   */
  observedSource: z.string().optional(),
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
    /** Overlay silhouette: pill | rect | blob */
    overlayStyle: z.enum(["pill", "rect", "blob"]).default("pill"),
    /**
     * Overlay anchor. `floating` parks it in the bottom-right corner of the
     * active display's work area (14 px inset, like the app this mirrors);
     * `top-left`/`top-right` pin it to a corner and re-clamp on monitor changes.
     */
    overlayPosition: z
      .enum(["cursor", "floating", "top-left", "top-right", "top", "bottom"])
      .default("cursor"),
    /** Meeting mode: keep the session open across pauses and insert each
     *  utterance as soon as it's transcribed (meetings, lectures, interviews). */
    meetingMode: z.boolean().default(false),
    /** Save every dictation's audio (WAV) next to its transcript. */
    saveAudio: z.boolean().default(false),
    /** Recordings folder. Empty = `<userData>/recordings`. */
    recordingsDir: z.string().default(""),
    /**
     * Their resting "flow bar" dock. `none` hides the persistent resting pill
     * (their `hideFlowBarPermanently`); otherwise the 30×6 dash sits on the
     * chosen screen edge and morphs to the dictation pill on hover.
     */
    dockEdge: z.enum(["none", "left", "right", "bottom"]).default("none"),
    /**
     * Custom overlay tint — overrides the reference #1f1f1f card background.
     * Empty string = the reference look.
     */
    overlayTint: z.string().default(""),
    /**
     * Follow the OS theme: the pill reads light/dark from the OS and flips
     * its card + text colors. Off = always the reference dark pill.
     */
    overlayFollowSystemTheme: z.boolean().default(false),
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
  /**
   * "Adds corrected words automatically" — their `shouldAutoLearnWords`,
   * default true. After each dictation the app watches the target box; when
   * the user re-types a word, the correction becomes a dictionary entry.
   */
  dictionaryAutoLearn: z.boolean().default(true),
  commands: z.array(VoiceCommandSchema).default([]),
  privacy: PrivacyConfigSchema.prefault({}),
  general: GeneralConfigSchema.prefault({}),
  updates: UpdatesConfigSchema.prefault({}),
  models: ModelsConfigSchema.prefault({}),
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
