/**
 * Zero-dependency resumable downloader (node fetch + fs). Range-resumes a
 * `.part` file when the server allows it, verifies sha256 when known, and
 * reports throttled progress. Zips are extracted with tar (ships with
 * Windows 10+/macOS/Linux) with a PowerShell Expand-Archive fallback.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes?: number;
}

export interface DownloadOptions {
  onProgress?: (p: DownloadProgress) => void;
  sha256?: string;
  /** Abort-like check; when it returns true the download stops cleanly. */
  shouldStop?: () => boolean;
}

export async function downloadFile(url: string, destPath: string, opts: DownloadOptions = {}): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  const partPath = destPath + ".part";
  let resumeFrom = 0;
  try {
    resumeFrom = (await stat(partPath)).size;
  } catch {
    /* no partial file */
  }

  const headers: Record<string, string> = {};
  if (resumeFrom > 0) headers["Range"] = `bytes=${resumeFrom}-`;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || (res.status !== 200 && res.status !== 206)) {
    throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  }
  const appending = res.status === 206 && resumeFrom > 0;
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  const totalBytes = appending && contentLength ? resumeFrom + contentLength : contentLength || undefined;

  if (!res.body) throw new Error(`download failed: empty body for ${url}`);

  const hash = createHash("sha256");
  const throttled = throttle(250, (p: DownloadProgress) => opts.onProgress?.(p));
  let received = appending ? resumeFrom : 0;

  const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  nodeStream.on("data", (chunk: Buffer) => {
    received += chunk.length;
    hash.update(chunk);
    throttled({ receivedBytes: received, totalBytes });
    if (opts.shouldStop?.()) nodeStream.destroy(new Error("download stopped"));
  });

  const out = createWriteStream(partPath, { flags: appending ? "a" : "w" });
  await pipeline(nodeStream, out);
  throttled.flush?.({ receivedBytes: received, totalBytes });
  opts.onProgress?.({ receivedBytes: received, totalBytes });

  if (opts.sha256) {
    const digest = await hashFile(partPath);
    if (digest !== opts.sha256.toLowerCase()) {
      await rm(partPath, { force: true });
      throw new Error(`sha256 mismatch for ${url}: got ${digest}`);
    }
  }

  await rename(partPath, destPath);
}

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const viaTar = await run("tar", ["-xf", zipPath, "-C", destDir]);
  if (viaTar) return;
  const viaPs = await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
  ]);
  if (!viaPs) throw new Error(`failed to extract ${zipPath} (tar and Expand-Archive both failed)`);
}

function run(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = spawn(cmd, args, { windowsHide: true, stdio: "ignore" });
      proc.on("error", () => resolve(false));
      proc.on("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

function throttle<T>(ms: number, fn: (arg: T) => void): ((arg: T) => void) & { flush?: (arg: T) => void } {
  let last = 0;
  let out = ((arg: T) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(arg);
    }
  }) as ((arg: T) => void) & { flush?: (arg: T) => void };
  out.flush = (arg: T) => fn(arg);
  return out;
}
