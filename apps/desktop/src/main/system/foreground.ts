import { spawn } from "node:child_process";

/**
 * Which app is in the foreground — the attribution the reference app stores on
 * every dictation (`history.app`, and it keeps per-app/per-URL stats). We can't
 * read the foreign window from Electron, so this is a short PowerShell one-shot
 * fired asynchronously at dictation start (never blocks the audio path).
 */
export interface ForegroundInfo {
  /** Executable name, e.g. "chrome", "Code", "WINWORD". */
  app: string;
  /** Window title — for browsers this is usually the page title. */
  title: string;
}

const SCRIPT = [
  "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;using System.Text;public class Fg{[DllImport(\"user32.dll\")]public static extern IntPtr GetForegroundWindow();[DllImport(\"user32.dll\")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport(\"user32.dll\")]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);}';",
  "$h=[Fg]::GetForegroundWindow();",
  "$procId=[uint32]0;",
  "[Fg]::GetWindowThreadProcessId($h,[ref]$procId)|Out-Null;",
  "$proc=Get-Process -Id $procId -ErrorAction SilentlyContinue;",
  "$sb=New-Object System.Text.StringBuilder 512;",
  "[Fg]::GetWindowText($h,$sb,512)|Out-Null;",
  "Write-Output ($proc.ProcessName+[char]124+$sb.ToString())",
].join("");

let cached: { at: number; info: ForegroundInfo | null } = { at: 0, info: null };

/** Best-effort, cached for a second. Never throws. */
export function getForegroundApp(): Promise<ForegroundInfo | null> {
  const now = Date.now();
  if (now - cached.at < 1000) return Promise.resolve(cached.info);
  return new Promise((resolve) => {
    let settled = false;
    const done = (info: ForegroundInfo | null) => {
      if (settled) return;
      settled = true;
      cached = { at: Date.now(), info };
      resolve(info);
    };
    try {
      const proc = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", SCRIPT],
        { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
      );
      let out = "";
      proc.stdout?.on("data", (d: Buffer) => {
        out += d.toString();
      });
      proc.on("exit", () => {
        const line = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
        const [app, ...rest] = line.split("|");
        done(app ? { app, title: rest.join("|").trim() } : null);
      });
      proc.on("error", () => done(null));
      setTimeout(() => done(null), 1500); // never hang the pipeline
    } catch {
      done(null);
    }
  });
}
