/**
 * Post-dictation hooks: fire-and-forget automation on a completed turn.
 *
 * Safety contract (worth reading twice — this is arbitrary-execution config):
 *  - A `command` hook is spawned WITHOUT a shell (`spawn` with an argv array),
 *    and the transcript arrives on STDIN. It is never interpolated into the
 *    command line, so a transcript containing `; rm -rf ~` is inert data.
 *  - Webhooks get `{ app, event, text, timestamp }` as JSON; the URL comes
 *    from config.
 *  - Hooks never block a dictation, and failures land in the log only.
 *    A broken hook cannot break your typing.
 */
import { spawn } from "node:child_process";
import type { DictationResult } from "../orchestrator/DictationSession.js";
import type { HookItem } from "@whisperflow/shared";

/** The webhook body — the documented contract for hook consumers. */
export interface HookWebhookBody {
  app: "WhisperFlow";
  event: "dictation";
  text: string;
  timestamp: number;
}

export interface RunHooksDeps {
  /** Writes hook failures (never throws). */
  logger?: (...args: unknown[]) => void;
  /** Fetch override (tests). Node's global fetch by default. */
  fetch?: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ) => Promise<{ ok: boolean; status: number }>;
  /** spawn override (tests). */
  spawnFn?: (
    file: string,
    args: string[],
    opts: { stdio: Array<"pipe" | "ignore"> },
  ) => {
    stdin: { end(): void; write(chunk: string): boolean };
    on(event: "error" | "close", handler: (...args: unknown[]) => void): unknown;
    kill?(): void;
  };
}

const HOOK_TIMEOUT_MS = 10_000;

/**
 * Runs every enabled hook for the result. Never throws, never rejects —
 * failures land in the log only; the caller shouldn't have to care.
 */
export async function runHooks(
  items: readonly HookItem[],
  result: DictationResult,
  deps: RunHooksDeps = {},
): Promise<void> {
  for (const hook of items) {
    if (!hook.enabled) continue;
    if (hook.event !== "dictation") continue;
    if (!result.final.trim()) continue;
    try {
      if (hook.kind === "webhook") await runWebhook(hook, result, deps);
      else runCommand(hook, result, deps);
    } catch (err) {
      deps.logger?.(`hook "${hook.name}" failed to start:`, String(err).slice(0, 120));
    }
  }
}

function runWebhook(hook: HookItem, result: DictationResult, deps: RunHooksDeps): Promise<void> {
  const fetch = deps.fetch ?? globalThis.fetch;
  const body: HookWebhookBody = {
    app: "WhisperFlow",
    event: "dictation",
    text: result.final,
    timestamp: Date.now(),
  };
  return fetch(hook.target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok) deps.logger?.(`hook "${hook.name}" webhook answered HTTP ${res.status}`);
    })
    .catch((err) => {
      deps.logger?.(`hook "${hook.name}" webhook failed:`, String(err).slice(0, 120));
    });
}

function runCommand(hook: HookItem, result: DictationResult, deps: RunHooksDeps): void {
  // argv split: the command line is WRITTEN BY THE USER, in config, not built
  // from the transcript — so a user can pass their own flags, but the spoken
  // text can never inject one.
  const parts = hook.target.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    deps.logger?.(`hook "${hook.name}" has an empty command`);
    return;
  }
  const spawner = deps.spawnFn ?? spawn;
  let child: ReturnType<NonNullable<RunHooksDeps["spawnFn"]>>;
  try {
    child = spawner(parts[0]!, parts.slice(1), { stdio: ["pipe", "ignore", "ignore"] });
  } catch (err) {
    deps.logger?.(`hook "${hook.name}" could not spawn:`, String(err).slice(0, 120));
    return;
  }
  const watchdog = setTimeout(() => {
    try {
      child.kill?.();
    } catch {
      /* already gone */
    }
    deps.logger?.(`hook "${hook.name}" exceeded ${HOOK_TIMEOUT_MS} ms — killed`);
  }, HOOK_TIMEOUT_MS);
  child.on("error", (err) => {
    clearTimeout(watchdog);
    deps.logger?.(`hook "${hook.name}" error:`, String(err).slice(0, 120));
  });
  child.on("close", () => clearTimeout(watchdog));
  try {
    child.stdin.write(result.final);
    child.stdin.end();
  } catch {
    // stdin closed before we could write — the hook still ran; ignore.
  }
}
