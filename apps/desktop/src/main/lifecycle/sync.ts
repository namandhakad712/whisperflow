import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "../lib/log";

/**
 * Multi-device sync through the user's OWN cloud (OneDrive/Dropbox/etc).
 *
 * The user picks a folder; WhisperFlow writes `whisperflow-sync.json` there on
 * every config change and watches the file for remote updates. There is NO
 * server of ours: the folder is the user's, the data goes where their cloud
 * goes, and the privacy story holds (never audio, never history — just
 * config + dictionary + scratchpad, the things that make a second machine
 * feel like home).
 *
 * Conflict policy: last-writer-wins per TOP-LEVEL key. Two machines editing
 * different settings never clobber each other; two editing the SAME setting
 * keep the newest write. The file carries a per-key `updatedAt`.
 */

const SYNC_FILE = "whisperflow-sync.json";

interface SyncDoc {
  app: "WhisperFlow";
  kind: "sync";
  updatedAt: number;
  keys: Record<string, { value: unknown; updatedAt: number }>;
}

export interface SyncManagerDeps {
  /** The active config + dictionary (all top-level config keys). */
  readConfig: () => Record<string, unknown>;
  /** What the scratchpad notes look like (localStorage string, or null). */
  readScratchpad: () => Promise<string | null> | string | null;
  /** Apply a remote patch (top-level keys) — the host's config set. */
  applyRemote: (patch: Record<string, unknown>) => Promise<void>;
  log: (...args: unknown[]) => void;
}

export class SyncManager {
  private folder: string | null = null;
  private lastWrite = 0;
  private readonly PUSH_DEBOUNCE_MS = 800;
  /** Polling interval (kept so tests can clear it). */
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: SyncManagerDeps) {}

  /** The active sync folder (null when disabled). */
  get activeFolder(): string | null {
    return this.folder;
  }

  /** Points sync at a folder (empty string disables). Best-effort. */
  setFolder(folder: string): void {
    if (folder === this.folder) return;
    if (folder) {
      try {
        mkdirSync(folder, { recursive: true });
      } catch (err) {
        this.deps.log("sync: folder unavailable — disabled:", String(err).slice(0, 100));
        this.folder = null;
        return;
      }
    }
    this.folder = folder || null;
    if (this.folder) {
      this.pull();
      this.push();
      this.watch();
    } else {
      this.stopWatching();
    }
  }

  /** Called by the host after every config change — debounced push. */
  schedulePush(): void {
    if (!this.folder) return;
    if (Date.now() - this.lastWrite < this.PUSH_DEBOUNCE_MS) return;
    this.push();
  }

  async push(): Promise<void> {
    if (!this.folder) return;
    try {
      const existing = this.readDoc();
      const fresh = this.deps.readConfig();
      const scratchpad = await this.deps.readScratchpad();
      const keys: Record<string, { value: unknown; updatedAt: number }> = existing?.keys ?? {};
      const now = Date.now();
      for (const [key, value] of Object.entries(fresh)) {
        const prior = keys[key];
        // Never downgrade a newer remote write with our older local value.
        if (!prior || (prior.updatedAt ?? 0) <= now) {
          keys[key] = { value, updatedAt: now };
        }
      }
      if (scratchpad !== null) {
        keys["scratchpad"] = { value: scratchpad, updatedAt: now };
      }
      const doc: SyncDoc = { app: "WhisperFlow", kind: "sync", updatedAt: now, keys };
      writeFileSync(join(this.folder, SYNC_FILE), JSON.stringify(doc, null, 2), "utf-8");
      this.lastWrite = now;
      this.deps.log("sync: pushed", Object.keys(fresh).length, "top-level keys");
    } catch (err) {
      this.deps.log("sync: push failed:", String(err).slice(0, 120));
    }
  }

  pull(): void {
    if (!this.folder) return;
    try {
      const doc = this.readDoc();
      if (!doc) return;
      const patch: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(doc.keys)) {
        if (key === "scratchpad") continue; // notes are per-machine localStorage
        if ((entry.updatedAt ?? 0) > this.lastWrite) patch[key] = entry.value;
      }
      if (Object.keys(patch).length > 0) {
        void this.deps.applyRemote(patch);
        this.deps.log("sync: pulled", Object.keys(patch).length, "remote keys");
      }
    } catch (err) {
      this.deps.log("sync: pull failed:", String(err).slice(0, 120));
    }
  }

  private readDoc(): SyncDoc | null {
    if (!this.folder) return null;
    try {
      const file = join(this.folder, SYNC_FILE);
      if (!existsSync(file)) return null;
      const raw = JSON.parse(readFileSync(file, "utf-8")) as SyncDoc;
      if (raw?.app !== "WhisperFlow" || raw?.kind !== "sync") return null;
      return raw;
    } catch {
      return null;
    }
  }

  private watch(): void {
    if (this.timer) return;
    // OneDrive/Dropbox don't send FS events reliably; polling ONE small file
    // every 3s is cheaper than a watcher that sometimes never fires.
    this.timer = setInterval(() => {
      if (!this.folder) return;
      try {
        const file = join(this.folder, SYNC_FILE);
        if (!existsSync(file)) return;
        if (statSync(file).mtimeMs > this.lastWrite) this.pull();
      } catch {
        /* ignore */
      }
    }, 3000);
  }

  private stopWatching(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}