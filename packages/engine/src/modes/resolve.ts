/**
 * Mode resolution: pick the first enabled profile whose `match` string hits
 * the app we're about to dictate into.
 *
 * Hex's stickiest feature ("Modes"): per-app corrections and formatting. Ours
 * match against everything we know about the target — the process/app name
 * (e.g. "code.exe" → "code"), the window title, and, for browsers, the active
 * URL — so "gmail" can match either the Gmail app OR gmail.com in a browser.
 */
import type { ModeProfile, WhisperFlowConfig } from "@whisperflow/shared";

/** All we know about the app receiving this dictation. */
export interface ModeTarget {
  app?: string;
  title?: string;
  url?: string;
}

/** Case-insensitive substring match against app name, title, or URL. */
export function modeMatches(profile: ModeProfile, target: ModeTarget): boolean {
  const needle = profile.match.trim().toLowerCase();
  if (!needle) return false;
  const haystacks = [target.app, target.title, target.url].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return haystacks.some((h) => h.toLowerCase().includes(needle));
}

/** First enabled profile that matches, or null. Order is the user's list order. */
export function resolveMode(
  config: Pick<WhisperFlowConfig, "modes">,
  target: ModeTarget,
): ModeProfile | null {
  const profiles = config.modes?.profiles ?? [];
  for (const p of profiles) {
    if (p.enabled && modeMatches(p, target)) return p;
  }
  return null;
}

/**
 * Merges a mode's non-"auto" overrides into a config clone (the session's
 * effective config). "auto"/"" leave the global setting alone.
 */
export function applyModeOverrides(
  config: WhisperFlowConfig,
  mode: ModeProfile,
): WhisperFlowConfig {
  const out: WhisperFlowConfig = structuredClone(config);
  if (mode.tone !== "auto") out.polish = { ...out.polish, tone: mode.tone };
  if (mode.cleanup !== "auto") out.polish = { ...out.polish, cleanup: mode.cleanup };
  if (mode.format !== "auto") out.polish = { ...out.polish, format: mode.format };
  if (mode.customInstructions.trim()) {
    const base = out.polish.customInstructions?.trim() ?? "";
    // Append, never replace — the global instructions still apply.
    out.polish = {
      ...out.polish,
      customInstructions: (base ? base + "\n" : "") + mode.customInstructions.trim(),
    };
  }
  if (mode.emailSignature !== "auto") {
    out.polish = { ...out.polish, emailSignature: mode.emailSignature === "on" };
  }
  if (mode.stt) {
    const stt = { ...out.stt };
    if (mode.stt.modelId) stt.modelId = mode.stt.modelId;
    if (mode.stt.language) stt.language = mode.stt.language;
    out.stt = stt;
  }
  if (mode.dictionary.length > 0) {
    // Mode corrections run FIRST — the corrector claims spans in entry order,
    // so app-specific spellings win over the global dictionary.
    out.dictionary = [...mode.dictionary, ...out.dictionary];
  }
  return out;
}
