import { clipboard } from "electron";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { log } from "../lib/log";

/**
 * Pastes text into the focused window on Windows:
 * snapshot the clipboard (as items) → write our text → send Ctrl+V via
 * PowerShell SendKeys → restore the snapshot.
 *
 * The restore matters more than it looks: without it every dictation would
 * replace the user's clipboard with its own transcript (a classic
 * clipboard-stealing bug). Electron 45 also refuses to write back a
 * `ClipboardItem` obtained from `clipboard.read()` — items must be rebuilt with
 * `getType` + a fresh `ClipboardItem`, so that is what happens below, with a
 * plain-text fallback.
 */
export async function injectText(text: string): Promise<boolean> {
  if (!text) return false;

  const snapshot = await snapshotClipboard();
  await clipboard.writeText(text);
  let pasted = false;
  try {
    // One retry: a paste can lose a focus race right after the overlay window
    // dismisses — the target app has the keys a beat too early or too late.
    // A second attempt 300 ms in costs almost nothing and recovers the
    // common transient failure without degrading the fast path.
    try {
      await sendPaste();
    } catch (firstErr) {
      logInjection(`first paste attempt failed (${String(firstErr).slice(0, 90)}) — retrying once`);
      await delay(300);
      await sendPaste();
    }
    pasted = true;
  } finally {
    if (pasted) {
      // Give the target app a beat to read the clipboard before we restore it.
      await delay(160);
      await restoreClipboard(snapshot).catch(() => {
        /* restoring is best-effort, never fatal */
      });
    } else {
      // Paste failed (Windows UIPI can block input injection from a process that
      // isn't attached to the interactive desktop). Leave the dictated text on
      // the clipboard and say so — the user can press Ctrl+V themselves instead
      // of losing what they just said.
      throw new Error(
        "couldn't paste into the focused window — the text is on your clipboard, press Ctrl+V",
      );
    }
  }
  return true;
}

/** Everything needed to put the clipboard back the way we found it. */
interface ClipboardSnapshot {
  items: Electron.ClipboardItem[] | null;
  text: string | null;
}

async function snapshotClipboard(): Promise<ClipboardSnapshot> {
  try {
    const items = await clipboard.read();
    const text = await clipboard.readText().catch(() => null);
    return { items, text };
  } catch {
    return { items: null, text: null };
  }
}

async function restoreClipboard(snapshot: ClipboardSnapshot): Promise<void> {
  // Full fidelity first: rebuild each item from its formats (text, html,
  // image, files). Electron rejects items returned by clipboard.read(), so new
  // ones are constructed — but only if the constructor is actually reachable.
  const Ctor = clipboardItemCtor();
  if (Ctor && snapshot.items && snapshot.items.length > 0) {
    try {
      const rebuilt: Electron.ClipboardItem[] = [];
      for (const item of snapshot.items) {
        const data: Record<string, string | Blob> = {};
        for (const type of item.types) {
          try {
            const payload = await item.getType(type);
            if (payload instanceof Blob) data[type] = payload;
          } catch {
            /* a format we cannot round-trip; keep the rest */
          }
        }
        if (Object.keys(data).length > 0) rebuilt.push(new Ctor(data));
      }
      if (rebuilt.length > 0) {
        await clipboard.write(rebuilt);
        return;
      }
    } catch {
      /* fall through to the text restore */
    }
  }
  // Text-only fallback (the common case) — or clear if it was empty.
  if (snapshot.text !== null && snapshot.text !== "") {
    await clipboard.writeText(snapshot.text).catch(() => {});
  } else {
    clipboard.clear();
  }
}

function sendPaste(): Promise<void> {
  // NOTE: synthesising Ctrl+V through uiohook-napi was tried and dropped — the
  // synthetic keystroke returned success but the target never pasted (verified
  // in a harness against our own focused textarea). SendKeys actually delivers,
  // so it stays the only path.
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ],
      { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
    );
    // Windows reports UIPI/interactivity problems on stderr, not in the exit
    // code alone — keep it so the log says *why* a paste failed.
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SendKeys exit ${code}${stderr ? `: ${stderr.trim().slice(0, 160)}` : ""}`));
    });
    proc.on("error", reject);
    setTimeout(() => reject(new Error("SendKeys timed out")), 1500); // never hang
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Copies the user's current text selection (Ctrl+C via SendKeys) and returns
 * it. Used by the lens ("AI-edit selection"): read what the user highlighted,
 * transform it, write the result back over the same selection.
 */
export async function copyFocusedSelection(): Promise<string> {
  const snapshot = await snapshotClipboard();
  try {
    await sendKeys("^c");
    await delay(120);
    return clipboard.readText();
  } finally {
    // The user's clipboard is restored right after we read the selection —
    // the lens must never clobber what they had there.
    await restoreClipboard(snapshot).catch(() => {});
  }
}

/** Raw SendKeys for synthetic key sequences (used for Ctrl+C above). */
function sendKeys(keys: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`,
      ],
      { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SendKeys(${keys}) exit ${code}${stderr ? `: ${stderr.trim().slice(0, 160)}` : ""}`));
    });
    proc.on("error", reject);
    setTimeout(() => reject(new Error(`SendKeys(${keys}) timed out`)), 1500);
  });
}

/** Same sink as the rest of the main process (logs go to userData/logs). */
const logInjection = (msg: string): void => {
  try {
    log(`injection: ${msg}`);
  } catch {
    /* logging must never break a paste */
  }
};

/**
 * ClipboardItem is a class on the CJS electron module. A static ESM named
 * import of it is `undefined` at runtime (verified), so resolve it through a
 * runtime require and fall back gracefully when it is unavailable.
 */
function clipboardItemCtor(): (new (data: Record<string, string | Blob>) => Electron.ClipboardItem) | null {
  try {
    const electron = createRequire(import.meta.url)("electron") as {
      ClipboardItem?: new (data: Record<string, string | Blob>) => Electron.ClipboardItem;
    };
    return typeof electron.ClipboardItem === "function" ? electron.ClipboardItem : null;
  } catch {
    return null;
  }
}
