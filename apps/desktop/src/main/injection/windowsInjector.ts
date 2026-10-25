import { clipboard } from "electron";
import { spawn } from "node:child_process";

/**
 * Pastes text into the focused window on Windows:
 * snapshot clipboard (all formats we can preserve) → write our text → send
 * Ctrl+V via PowerShell SendKeys → restore the snapshot.
 */
export async function injectText(text: string): Promise<boolean> {
  if (!text) return false;

  const snapshot = snapshotClipboard();
  clipboard.writeText(text);
  try {
    await sendPaste();
    // Give the target app a beat to read the clipboard before we restore it.
    await delay(160);
    return true;
  } finally {
    restoreClipboard(snapshot);
  }
}

interface ClipboardSnapshot {
  text: string | null;
  html: string | null;
  rtf: string | null;
  image: Electron.NativeImage | null;
}

function snapshotClipboard(): ClipboardSnapshot {
  const image = clipboard.readImage();
  return {
    text: clipboard.readText() || null,
    html: clipboard.readHTML() || null,
    rtf: clipboard.readRTF() || null,
    image: image.isEmpty() ? null : image,
  };
}

function restoreClipboard(s: ClipboardSnapshot): void {
  if (s.image) {
    clipboard.writeImage(s.image);
    return;
  }
  if (!s.text && !s.html && !s.rtf) {
    clipboard.clear();
    return;
  }
  clipboard.write({
    text: s.text ?? "",
    html: s.html ?? "",
    rtf: s.rtf ?? "",
  });
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
