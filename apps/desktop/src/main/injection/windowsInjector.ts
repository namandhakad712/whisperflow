import { clipboard } from "electron";
import { spawn } from "node:child_process";

/**
 * Pastes text into the focused window on Windows:
 * snapshot the clipboard (as items) → write our text → send Ctrl+V via
 * PowerShell SendKeys → restore the snapshot.
 *
 * Electron 45's clipboard API is async and item-based; snapshotting whole
 * ClipboardItems preserves whatever formats were there (text, images, files).
 */
export async function injectText(text: string): Promise<boolean> {
  if (!text) return false;

  let snapshot: Electron.ClipboardItem[] = [];
  try {
    snapshot = await clipboard.read();
  } catch {
    snapshot = [];
  }

  await clipboard.writeText(text);
  try {
    await sendPaste();
    // Give the target app a beat to read the clipboard before we restore it.
    await delay(160);
    return true;
  } finally {
    try {
      if (snapshot.length > 0) await clipboard.write(snapshot);
      else clipboard.clear();
    } catch {
      /* restoring is best-effort */
    }
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
