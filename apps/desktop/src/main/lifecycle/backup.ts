import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { log } from "../lib/log";

/**
 * Daily local backups of the two files that hold everything the user cares
 * about: config.json and history.json. The reference app does the same thing
 * (a cron at 12:00 into `backups/`, next to its SQLite file) — losing settings
 * or transcripts to a bad write is unrecoverable otherwise.
 *
 * Keeps the last `KEEP` days of each file. Best-effort: never throws.
 */
const KEEP = 7;

const dayStamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

export function runDailyBackup(userDataDir: string): void {
  try {
    const backupDir = join(userDataDir, "backups");
    mkdirSync(backupDir, { recursive: true });
    const stamp = dayStamp();

    for (const name of ["config.json", "history.json"]) {
      const src = join(userDataDir, name);
      if (!existsSync(src)) continue;
      const dest = join(backupDir, `${name.replace(".json", "")}-${stamp}.json`);
      if (existsSync(dest)) continue; // already backed up today
      copyFileSync(src, dest);
      log(`backup: ${name} → backups/${dest.split(/[\\/]/).pop()}`);
    }

    // Rotate: keep the newest KEEP files per prefix.
    const files = readdirSync(backupDir).sort();
    for (const prefix of ["config-", "history-"]) {
      const matching = files.filter((f) => f.startsWith(prefix));
      for (const stale of matching.slice(0, Math.max(0, matching.length - KEEP))) {
        try {
          unlinkSync(join(backupDir, stale));
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    log("backup: failed (ignored):", String(err).slice(0, 120));
  }
}

/** True when a backup for today already exists (used to skip work). */
export function hasBackupToday(userDataDir: string): boolean {
  try {
    const dest = join(userDataDir, "backups", `config-${dayStamp()}.json`);
    return existsSync(dest) && statSync(dest).size > 0;
  } catch {
    return false;
  }
}
