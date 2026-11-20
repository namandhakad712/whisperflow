import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let logDir = "";

/** Points the logger at userData/logs and starts a fresh daily file if needed. */
export function initLogging(dir: string): void {
  logDir = dir;
  mkdirSync(dir, { recursive: true });
}

export function log(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(" ")}\n`;
  // eslint-disable-next-line no-console
  console.log(line.trimEnd());
  try {
    if (logDir) appendFileSync(join(logDir, `${new Date().toISOString().slice(0, 10)}.log`), line);
  } catch {
    /* logging must never crash the app */
  }
}
