/**
 * Setup diagnostics — the answer to "I pressed the key, spoke, and nothing
 * happened".
 *
 * Every check below is a fact the desktop host can gather cheaply (config,
 * model status, hook availability, key presence). Nothing here touches the
 * network, the microphone, or the filesystem: the host supplies the facts and
 * this module turns them into an ordered, human-readable verdict.
 *
 * Design rules:
 *   • Pure — no Electron, no I/O. Fully unit-testable.
 *   • Ordered by severity: a blocking problem first, then warnings, then OKs.
 *   • Every failing check says what to DO, not just what is wrong.
 */
import type { WhisperFlowConfig } from "@whisperflow/shared";

export type DiagnosticLevel = "ok" | "warn" | "fail";

export interface DiagnosticCheck {
  /** Stable machine id (for tests + telemetry-free analytics). */
  id: string;
  /** Short human title, e.g. "Transcription engine". */
  title: string;
  level: DiagnosticLevel;
  /** What we found, in plain language. */
  detail: string;
  /** The fix — only present when something is wrong. */
  fix?: string;
  /** Settings tab that resolves it, when one does. */
  tab?: string;
}

export interface DiagnosticsInput {
  config: WhisperFlowConfig;
  /** Model status straight from the engine's model manager. */
  models: ReadonlyArray<{ entryId: string; state: string }>;
  /** Whether the global hotkey hook could be installed (uiohook). */
  hookAvailable: boolean;
  /** Why the hook is unavailable, when it isn't. */
  hookUnavailableReason?: string;
  /** Console session id — for hostile-environment checks. */
  sessionId?: string;
  /** Whether a microphone was actually enumerated by the renderer. */
  micAvailable: boolean;
  /** Number of audio input devices found (0 hides "mic found" detail). */
  micCount?: number;
}

export interface DiagnosticsReport {
  checks: DiagnosticCheck[];
  /** True when nothing is blocking dictation. */
  healthy: boolean;
}

/**
 * Runs every check and returns them worst-first. The order is deliberate: a
 * user reading top-down hits the thing that actually stops them first.
 */
export function diagnose(input: DiagnosticsInput): DiagnosticsReport {
  const checks: DiagnosticCheck[] = [
    checkHook(input),
    checkStt(input),
    checkPolish(input),
    checkMicrophone(input),
    checkPrivacy(input),
    checkDictionary(input),
  ];
  const rank: Record<DiagnosticLevel, number> = { fail: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => rank[a.level] - rank[b.level]);
  return { checks, healthy: !checks.some((c) => c.level === "fail") };
}

/** The hotkey hook is the #1 silent failure: no hook, no dictation at all. */
function checkHook(input: DiagnosticsInput): DiagnosticCheck {
  if (input.hookAvailable) {
    return {
      id: "hook",
      title: "Global hotkey",
      level: "ok",
      detail: `Listening for ${input.config.hotkey.pushToTalk}.`,
      tab: "shortcuts",
    };
  }
  return {
    id: "hook",
    title: "Global hotkey",
    level: "fail",
    detail: input.hookUnavailableReason || "The keyboard hook could not be installed.",
    fix: "Restart WhisperFlow. If it keeps failing, another app may be blocking low-level keyboard hooks — close other hotkey tools and try again.",
    tab: "shortcuts",
  };
}

/** STT: the difference between "transcribes" and "silence forever". */
function checkStt(input: DiagnosticsInput): DiagnosticCheck {
  const stt = input.config.stt;

  if (stt.provider === "cloud") {
    const presetName = stt.cloud.provider;
    if (!stt.cloud.apiKey) {
      return {
        id: "stt",
        title: "Transcription engine",
        level: "fail",
        detail: `Cloud transcription (${presetName}) is selected but no API key is set.`,
        fix: "Paste an API key in Settings → Models, or switch to a local model.",
        tab: "models",
      };
    }
    if (input.config.privacy.localOnly) {
      return {
        id: "stt",
        title: "Transcription engine",
        level: "fail",
        detail: "Cloud transcription is selected, but local-only mode blocks all network access.",
        fix: "Turn off local-only mode in Settings → Privacy, or switch to a local STT model.",
        tab: "privacy",
      };
    }
    return {
      id: "stt",
      title: "Transcription engine",
      level: "ok",
      detail: `Cloud — ${stt.cloud.model || presetName}, key configured.`,
      tab: "models",
    };
  }

  const entry = input.models.find((m) => m.entryId === stt.modelId);
  if (!entry || entry.state !== "downloaded") {
    return {
      id: "stt",
      title: "Transcription engine",
      level: "fail",
      detail: entry
        ? `The model "${stt.modelId}" is ${entry.state.replace("-", " ")}.`
        : `The model "${stt.modelId}" isn't in the catalog.`,
      fix: "Download it in Settings → Models, or pick a smaller model that's already on disk.",
      tab: "models",
    };
  }
  return {
    id: "stt",
    title: "Transcription engine",
    level: "ok",
    detail: `Local — ${stt.modelId}, on disk.`,
    tab: "models",
  };
}

/** Polish is optional: a missing polisher degrades quality, never blocks. */
function checkPolish(input: DiagnosticsInput): DiagnosticCheck {
  const polish = input.config.polish;
  if (!polish.enabled || polish.provider === "none") {
    return {
      id: "polish",
      title: "AI polish",
      level: "ok",
      detail: "Off — transcripts are pasted exactly as transcribed.",
      tab: "advanced",
    };
  }
  if (polish.provider === "openai-compat") {
    const remote = polish.remote;
    if (!remote.apiKey) {
      return {
        id: "polish",
        title: "AI polish",
        level: "warn",
        detail: "Cloud polish is selected but has no API key.",
        fix: input.config.polish.fallbackToLocal
          ? "Polish will fall back to the local model. Add a key in Settings → Advanced, or turn polish off."
          : "Add a key in Settings → Advanced — with fallback disabled, unpolished text is pasted.",
        tab: "advanced",
      };
    }
    return {
      id: "polish",
      title: "AI polish",
      level: "ok",
      detail: `Cloud — ${remote.model || remote.provider}, key configured.`,
      tab: "advanced",
    };
  }
  const entry = input.models.find((m) => m.entryId === polish.modelId);
  if (!entry || entry.state !== "downloaded") {
    return {
      id: "polish",
      title: "AI polish",
      level: "warn",
      detail: `The polish model "${polish.modelId}" isn't on disk.`,
      fix: "Download it in Settings → Models, or turn polish off to skip it entirely.",
      tab: "models",
    };
  }
  return {
    id: "polish",
    title: "AI polish",
    level: "ok",
    detail: `Local — ${polish.modelId}, on disk.`,
    tab: "models",
  };
}

/** No microphone is the one failure users blame on the app, not the OS. */
function checkMicrophone(input: DiagnosticsInput): DiagnosticCheck {
  if (input.micAvailable) {
    return {
      id: "mic",
      title: "Microphone",
      level: "ok",
      detail: input.micCount
        ? `${input.micCount} input device${input.micCount === 1 ? "" : "s"} available.`
        : "Input device available.",
      tab: "audio",
    };
  }
  return {
    id: "mic",
    title: "Microphone",
    level: "fail",
    detail: "No microphone was found.",
    fix: "Plug in or enable a microphone in Windows sound settings, then reopen WhisperFlow.",
    tab: "audio",
  };
}

/** Local-only is a feature; it becomes a foot-gun with cloud providers set. */
function checkPrivacy(input: DiagnosticsInput): DiagnosticCheck {
  const { localOnly } = input.config.privacy;
  const cloudInUse =
    input.config.stt.provider === "cloud" ||
    (input.config.polish.enabled && input.config.polish.provider === "openai-compat");
  if (localOnly && !cloudInUse) {
    return {
      id: "privacy",
      title: "Privacy",
      level: "ok",
      detail: "Local-only — audio and text never leave this machine.",
      tab: "privacy",
    };
  }
  if (localOnly && cloudInUse) {
    return {
      id: "privacy",
      title: "Privacy",
      level: "warn",
      detail: "Local-only mode is on, so your cloud providers are being skipped.",
      fix: "Turn local-only off in Settings → Privacy to use them.",
      tab: "privacy",
    };
  }
  return {
    id: "privacy",
    title: "Privacy",
    level: "warn",
    detail: "Cloud providers are allowed — audio is sent to the provider you configured.",
    fix: "Turn on local-only mode to keep everything on this machine.",
    tab: "privacy",
  };
}

/** Pure information: how well the app has been taught. Never a problem. */
function checkDictionary(input: DiagnosticsInput): DiagnosticCheck {
  const count = input.config.dictionary.length;
  return {
    id: "dictionary",
    title: "Personal dictionary",
    level: "ok",
    detail:
      count === 0
        ? "Empty — add names and jargon so they transcribe correctly."
        : `${count} term${count === 1 ? "" : "s"} will be spelled your way.`,
    tab: "dictionary",
  };
}
