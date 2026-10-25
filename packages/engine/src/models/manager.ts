/**
 * Model manager: catalog, local paths, downloads with progress, deletion,
 * and "set active" (which just writes config). Weights land in
 * `<modelsDir>/<repo>/<file>`; the whisper.cpp sidecar lands in `<binDir>/`.
 */
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  HardwareTier,
  ModelCatalogEntry,
  ModelDownloadProgress,
  ModelStatus,
  TierRecommendation,
} from "@whisperflow/shared";
import { CATALOG, catalogEntry } from "./catalog.js";
import { downloadFile, extractZip } from "./download.js";
import { detectTier, recommendFor } from "./tiering.js";
import type { ConfigStore } from "../config/ConfigStore.js";

export class ModelManager {
  constructor(
    private readonly opts: {
      modelsDir: string;
      binDir: string;
      config: ConfigStore;
    },
  ) {}

  catalog(): readonly ModelCatalogEntry[] {
    return CATALOG;
  }

  recommend(tier?: HardwareTier): TierRecommendation {
    return recommendFor(tier ?? detectTier());
  }

  entry(id: string): ModelCatalogEntry | undefined {
    return catalogEntry(id);
  }

  /** Local filesystem location for an entry (file for weights, dir for the extracted sidecar). */
  localPath(entry: ModelCatalogEntry): string {
    if (entry.format === "binary") return join(this.opts.binDir, entry.id);
    return join(this.opts.modelsDir, entry.repo, entry.file);
  }

  async status(): Promise<ModelStatus[]> {
    const out: ModelStatus[] = [];
    for (const entry of CATALOG) {
      const finalPath = this.localPath(entry);
      let bytesOnDisk = 0;
      let present = false;
      try {
        if (entry.format === "binary") {
          const files = await readdir(finalPath, { recursive: true });
          present = files.some((f) => /\.(exe|dll)$/i.test(f.toString()));
          if (present) bytesOnDisk = 2 * 1024 * 1024; // sidecar is small; exact size irrelevant
        } else {
          const s = await stat(finalPath);
          present = s.isFile() && s.size > 0;
          bytesOnDisk = s.size;
        }
      } catch {
        let partBytes = 0;
        try {
          partBytes = (await stat(finalPath + ".part")).size;
        } catch {
          /* nothing on disk */
        }
        out.push({ entryId: entry.id, state: "not-downloaded", bytesOnDisk: partBytes });
        continue;
      }
      out.push({ entryId: entry.id, state: present ? "downloaded" : "not-downloaded", bytesOnDisk });
    }
    return out;
  }

  async isDownloaded(id: string): Promise<boolean> {
    const entry = catalogEntry(id);
    if (!entry) return false;
    const statuses = await this.status();
    return statuses.find((s) => s.entryId === id)?.state === "downloaded";
  }

  async download(id: string, onProgress?: (p: ModelDownloadProgress) => void): Promise<void> {
    const entry = catalogEntry(id);
    if (!entry) throw new Error(`unknown model id: ${id}`);
    const emit = (p: ModelDownloadProgress) => onProgress?.(p);

    if (entry.format === "binary") {
      const zipPath = join(this.opts.binDir, entry.file);
      emit({ entryId: id, state: "downloading", receivedBytes: 0 });
      await downloadFile(entry.url, zipPath, {
        onProgress: (p) =>
          emit({ entryId: id, state: "downloading", receivedBytes: p.receivedBytes, totalBytes: p.totalBytes }),
      });
      await extractZip(zipPath, this.localPath(entry));
      emit({ entryId: id, state: "done", receivedBytes: entry.sizeBytes ?? 0 });
      return;
    }

    const dest = this.localPath(entry);
    await mkdir(join(dest, ".."), { recursive: true });
    emit({ entryId: id, state: "downloading", receivedBytes: 0, totalBytes: entry.sizeBytes });
    await downloadFile(entry.url, dest, {
      sha256: entry.sha256,
      onProgress: (p) =>
        emit({ entryId: id, state: "downloading", receivedBytes: p.receivedBytes, totalBytes: p.totalBytes ?? entry.sizeBytes }),
    });
    emit({ entryId: id, state: "done", receivedBytes: entry.sizeBytes ?? 0, totalBytes: entry.sizeBytes });
  }

  async delete(id: string): Promise<void> {
    const entry = catalogEntry(id);
    if (!entry) return;
    await rm(this.localPath(entry), { recursive: true, force: true });
    await rm(this.localPath(entry) + ".part", { force: true });
    if (entry.format === "binary") {
      await rm(join(this.opts.binDir, entry.file), { force: true });
    }
  }

  /** Points the config's active model for a role at a catalog entry. */
  setActive(role: "stt" | "polish", id: string): void {
    const entry = catalogEntry(id);
    if (!entry) throw new Error(`unknown model id: ${id}`);
    if (entry.role !== role) throw new Error(`model ${id} is a ${entry.role} model, not ${role}`);
    if (role === "stt") this.opts.config.set({ stt: { modelId: id } });
    else this.opts.config.set({ polish: { modelId: id } });
  }
}
