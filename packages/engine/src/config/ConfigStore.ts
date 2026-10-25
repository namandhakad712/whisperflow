/**
 * zod-validated JSON config with atomic writes. `{}` on disk (or a missing
 * file) upgrades to a fully-defaulted config; invalid patches are rejected
 * loudly instead of corrupting the file.
 */
import { readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_CONFIG, WhisperFlowConfigSchema, type WhisperFlowConfig } from "@whisperflow/shared";

export class ConfigStore {
  private config: WhisperFlowConfig;
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
    this.config = this.load();
  }

  get(): WhisperFlowConfig {
    return this.config;
  }

  set(patch: Record<string, unknown>): WhisperFlowConfig {
    const merged = deepMerge(this.config as unknown as Record<string, unknown>, patch);
    const next = WhisperFlowConfigSchema.parse(merged); // throws on invalid
    this.config = next;
    this.persist();
    return next;
  }

  private load(): WhisperFlowConfig {
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf-8")) as unknown;
      return WhisperFlowConfigSchema.parse(raw);
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = this.path + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.config, null, 2), "utf-8");
    renameSync(tmp, this.path);
  }
}

/** Objects merge recursively; arrays and scalars are replaced wholesale. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch as T;
  if (base === null || typeof base !== "object" || Array.isArray(base)) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = deepMerge(out[key], value);
  }
  return out as T;
}
