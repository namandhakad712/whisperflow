import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Audit log: an append-only record of what the app SENT where and what it
 * PASTED — the enterprise "what leaves this machine" answer. Local-only,
 * rotated daily with the app log. Never contains audio, transcripts, or keys.
 *
 * Lines are one-line JSON per event so a downstream parser (or a security
 * team's collector) can consume them without a schema.
 */

let auditDir = "";

/** Points the audit logger at userData/logs (same dir as the app log). */
export function initAudit(dir: string): void {
  auditDir = dir;
  mkdirSync(dir, { recursive: true });
}

export type AuditEvent =
  | { kind: "sent"; target: "cloud-stt" | "cloud-polish" | "hook-webhook" | "hook-command"; url?: string }
  | { kind: "pasted"; textLen: number; app?: string }
  | { kind: "cancelled"; app?: string }
  | { kind: "error"; message: string };

/** Writes one audit line. Never throws — audit must never break dictation. */
export function audit(ev: AuditEvent): void {
  if (!auditDir) return;
  try {
    const line = `${new Date().toISOString()} ${JSON.stringify(ev)}\n`;
    appendFileSync(join(auditDir, `audit-${new Date().toISOString().slice(0, 10)}.log`), line);
  } catch {
    /* audit must never crash the app */
  }
}