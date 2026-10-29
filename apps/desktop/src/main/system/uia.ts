/**
 * Focused-element inspection via Windows UI Automation — the port of the
 * reference app's `GetTextBoxInfo` helper request:
 *   `{ accessibilityIsFunctioning, beforeText, afterText, selectedText,
 *      contents, isEditable, couldNotGetTextBoxInfo }`
 * and, when the focused element is a browser document, its `ValuePattern` is
 * the page URL — which also gives us the reference app's `GetActiveAppInfo`
 * url field without a native helper.
 *
 * Read-only for the other process: UIA property reads are not blocked by
 * UIPI the way input synthesis is, so this works from our normal process.
 * (The paste itself still needs the keyboard path.)
 *
 * The probe runs in ONE long-lived PowerShell child: `Add-Type
 * -AssemblyName UIAutomationClient` costs seconds cold, so per-call spawning
 * makes every observation poll slow. The reference app keeps its helper
 * resident for exactly the same reason.
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Writable, Readable } from "node:stream";

export interface FocusedElementInfo {
  /** Element name (label). */
  name: string;
  className: string;
  /** e.g. ControlType.Edit / ControlType.Document / ControlType.Pane. */
  controlType: string;
  /** ValuePattern contents — the text box's text, or the page URL for browsers. */
  value: string;
  /** False when the pattern reports IsReadOnly or no ValuePattern exists. */
  isEditable: boolean;
  /** True when the value looks like a URL (the browser document element). */
  isUrl: boolean;
}

/** The resident probe's read loop. `PROBE` on stdin in, results out, `END`
 *  terminates a response. */
const PROBE_LOOP = [
  "$ErrorActionPreference='Stop'",
  "Add-Type -AssemblyName UIAutomationClient",
  "while($true){",
  "$line=[Console]::In.ReadLine()",
  "if($null -eq $line){ exit }",
  "if($line -ne 'PROBE'){ continue }",
  "try{",
  "$w=[System.Windows.Automation.AutomationElement]::FocusedElement",
  "if($null -eq $w){ 'NO_FOCUS' }",
  "else{",
  "'NAME=' + $w.Current.Name",
  "'CLASS=' + $w.Current.ClassName",
  "'CTRL=' + $w.Current.ControlType.ProgrammaticName",
  "try{",
  "$p=$w.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)",
  "'VALUE=' + ($p.Current.Value -replace \"\\r?\\n\", '\\\\n')",
  "'READONLY=' + $p.Current.IsReadOnly",
  "}catch{ 'NO_VALUE' }",
  "}",
  "}catch{ 'ERR ' + ($_.Exception.Message -replace \"\\r?\\n\", ' ') }",
  "'END'",
  "[Console]::Out.Flush()",
  "}",
].join("\n");

let probe: ChildProcessByStdio<Writable, Readable, null> | null = null;
let pending: ((out: string) => void) | null = null;
let buffer = "";
let cached: { at: number; info: FocusedElementInfo | null } = { at: 0, info: null };
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The probe is only needed while dictations are flowing. Once idle it is
 * killed (a resident powershell.exe + UIAutomationClient sits on ~60 MB RSS
 * for nothing); the next observation lazily spawns it again via ensureProbe().
 * Cold UIA load takes seconds, so the grace period is long enough that
 * back-to-back dictations never pay it.
 */
const PROBE_IDLE_MS = 5 * 60_000;

function scheduleProbeIdleUnload(): void {
  cancelProbeIdleUnload();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (probe && !probe.killed && probe.exitCode === null) probe.kill();
    probe = null;
  }, PROBE_IDLE_MS);
  // Never keep the app alive on quit just for this timer.
  if (typeof idleTimer === "object" && "unref" in idleTimer) idleTimer.unref();
}

function cancelProbeIdleUnload(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/** Lazily start (or revive) the resident probe. */
function ensureProbe(): ChildProcessByStdio<Writable, Readable, null> {
  if (probe && !probe.killed && probe.exitCode === null) return probe;
  buffer = "";
  pending = null;
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", PROBE_LOOP], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "ignore"],
  });
  probe = child;
  child.stdout.on("data", (d: Buffer) => {
    buffer += d.toString();
    if (!pending) return;
    const m = buffer.match(/\r?\nEND\r?\n/);
    if (!m) return;
    const out = buffer.slice(0, m.index ?? 0);
    buffer = buffer.slice((m.index ?? 0) + m[0].length);
    const resolve = pending;
    pending = null;
    resolve?.(out);
  });
  child.on("exit", () => {
    if (probe === child) probe = null;
    const resolve = pending;
    pending = null;
    resolve?.("");
  });
  return child;
}

/**
 * Best-effort, cached for a moment. Never throws, never hangs: a probe that
 * doesn't answer in time is dropped.
 */
export async function getFocusedElementInfo(): Promise<FocusedElementInfo | null> {
  const now = Date.now();
  if (now - cached.at < 400) return cached.info;
  if (process.platform !== "win32") return null;
  return new Promise((resolve) => {
    let settled = false;
    const done = (info: FocusedElementInfo | null) => {
      if (settled) return;
      settled = true;
      cached = { at: Date.now(), info };
      // The dictation cycle that needed the probe is over: start the idle
      // countdown to release it again.
      scheduleProbeIdleUnload();
      resolve(info);
    };
    try {
      cancelProbeIdleUnload(); // in use — hold the probe resident
      const p = ensureProbe();
      if (pending) {
        // A probe is already in flight (rapid polling) — skip this one.
        done(cached.info);
        return;
      }
      pending = (out) => done(parseFocusedElementOutput(out));
      p.stdin.write("PROBE\n");
      // Cold UIA load can take seconds on the first probe; later probes are
      // tens of ms. Time out rather than hang the dictation pipeline.
      setTimeout(() => {
        if (pending) {
          pending = null;
          done(null);
        }
      }, 3000);
    } catch {
      done(null);
    }
  });
}

/** Parsed from a probe run — exported for unit tests. */
export function parseFocusedElementOutput(out: string): FocusedElementInfo | null {
  const get = (key: string) => {
    const m = out.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m?.[1]?.trim() ?? "";
  };
  if (out.includes("NO_FOCUS") || out.includes("ERR ") || out.trim() === "") return null;
  const value = get("VALUE").replace(/\\n/g, "\n");
  const ctrl = get("CTRL");
  const readonly = get("READONLY");
  const looksLikeUrl = /^(https?|file|ms-[\w-]+):\/\//.test(value);
  // Their "isEditable": the element is an Edit control (or a document with a
  // writable ValuePattern). Browser Document elements are contentEditable.
  const hasValue = !out.includes("NO_VALUE") && value.length > 0;
  const isEditable =
    hasValue &&
    readonly !== "True" &&
    (ctrl === "ControlType.Edit" || ctrl === "ControlType.Document" || ctrl === "ControlType.Custom");
  return {
    name: get("NAME"),
    className: get("CLASS"),
    controlType: ctrl,
    value,
    isEditable,
    isUrl: looksLikeUrl,
  };
}
