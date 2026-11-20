/**
 * Local dictation history. v1 uses an atomically-written JSON file (zero
 * native deps, trivially portable); the interface is deliberately
 * repository-shaped so a SQLite upgrade is drop-in later.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { HistoryQuery, TranscriptItem } from "@whisperflow/shared";

const MAX_ITEMS = 10_000;

export interface HistoryStore {
  add(item: Omit<TranscriptItem, "id" | "createdAt"> & { id?: string; createdAt?: number }): TranscriptItem;
  list(query?: HistoryQuery): TranscriptItem[];
  delete(id: string): boolean;
  clear(): boolean;
  /** Merges backup items (existing ids are skipped). Returns how many were added. */
  importMany(items: readonly TranscriptItem[]): number;
}

export function createHistoryStore(path: string): HistoryStore {
  let items: TranscriptItem[] = load(path);

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = path + ".tmp";
    writeFileSync(tmp, JSON.stringify(items, null, 2), "utf-8");
    renameSync(tmp, path);
  };

  return {
    add(partial) {
      const item: TranscriptItem = {
        ...partial,
        id: partial.id ?? randomUUID(),
        createdAt: partial.createdAt ?? Date.now(),
      };
      items.unshift(item);
      if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);
      persist();
      return item;
    },
    list(query) {
      let out = items;
      if (query?.query) {
        const q = query.query.toLowerCase();
        out = out.filter(
          (t) =>
            t.rawText?.toLowerCase().includes(q) ||
            t.finalText?.toLowerCase().includes(q) ||
            t.app?.toLowerCase().includes(q),
        );
      }
      const limit = Math.min(Math.max(1, query?.limit ?? 50), 500);
      return out.slice(0, limit).map((t) => ({ ...t }));
    },
    delete(id) {
      const before = items.length;
      items = items.filter((t) => t.id !== id);
      const changed = items.length !== before;
      if (changed) persist();
      return changed;
    },
    clear() {
      const changed = items.length > 0;
      items = [];
      if (changed) persist();
      return changed;
    },
    importMany(incoming) {
      const known = new Set(items.map((t) => t.id));
      let added = 0;
      for (const t of incoming) {
        if (!t?.id || known.has(t.id)) continue;
        known.add(t.id);
        items.push(t);
        added += 1;
      }
      // Keep newest-first like the rest of the store.
      items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);
      if (added > 0) persist();
      return added;
    },
  };
}

function load(path: string): TranscriptItem[] {
  try {
    // BOM-tolerant read: silently dropping history on a BOM'd file would be a
    // data-loss bug.
    const raw = JSON.parse(readFileSync(path, "utf-8").replace(/^\uFEFF/, "")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is TranscriptItem => !!t && typeof (t as TranscriptItem).id === "string");
  } catch {
    return [];
  }
}
