import { clipboard, ClipboardItem } from "electron";
import { spawn } from "node:child_process";

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
  try {
    await sendPaste();
    // Give the target app a beat to read the clipboard before we restore it.
    await delay(160);
    return true;
  } finally {
    await restoreClipboard(snapshot).catch(() => {
      /* restoring is best-effort, never fatal */
    });
  }
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
  // image, files). Electron rejects items returned by clipboard.read().
  if (snapshot.items && snapshot.items.length > 0) {
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
        if (Object.keys(data).length > 0) rebuilt.push(new ClipboardItem(data));
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
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`SendKeys exit ${code}`))));
    proc.on("error", reject);
    setTimeout(resolve, 1000); // never hang the pipeline on a stuck shell
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
