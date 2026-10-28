import { describe, expect, it } from "vitest";
import { buildPolishMessages } from "../src/text/promptBuilder.js";
import { CATALOG } from "../src/models/catalog.js";
import { detectTier, recommendFor } from "../src/models/tiering.js";
import { createHistoryStore } from "../src/history/historyStore.js";
import { ConfigStore, deepMerge } from "../src/config/ConfigStore.js";
import { RemoteOpenAIProvider } from "../src/providers/polish/RemoteOpenAIProvider.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, WhisperFlowConfigSchema } from "@whisperflow/shared";

describe("promptBuilder", () => {
  const base = {
    raw: "um test the thing",
    tone: "neutral" as const,
    modelId: "qwen2.5-3b-instruct-q4",
    dictionary: ["WhisperFlow", "OpenWispr"],
  };

  it("includes core rules, dictionary terms, and the raw text", () => {
    const m = buildPolishMessages(base);
    expect(m.system).toContain("ONLY the final text");
    expect(m.system).toContain('"WhisperFlow"');
    expect(m.system).toContain("neutral");
    expect(m.user).toBe("um test the thing");
  });

  it("carries tone, app, and language context", () => {
    const m = buildPolishMessages({ ...base, tone: "professional", app: "VS Code", language: "en" });
    expect(m.system).toContain("professional");
    expect(m.system).toContain("VS Code");
    expect(m.system).toContain("in en");
  });

  it("uses custom instructions only for the custom tone", () => {
    const withTone = buildPolishMessages({ ...base, tone: "custom", instructions: "Pirate speak" });
    expect(withTone.system).toContain("Pirate speak");
    const wrongTone = buildPolishMessages({ ...base, tone: "casual", instructions: "Pirate speak" });
    expect(wrongTone.system).not.toContain("Pirate speak");
  });

  it("scales cleanup across the reference app's five levels", () => {
    expect(buildPolishMessages({ ...base, cleanup: "light" }).system).toContain("Remove filler words");
    expect(buildPolishMessages({ ...base, cleanup: "medium" }).system).toContain("clarity and conciseness");
    expect(buildPolishMessages({ ...base, cleanup: "high" }).system).toContain("false starts");
    expect(buildPolishMessages({ ...base, cleanup: "full" }).system).toContain("Freely rewrite");
    const none = buildPolishMessages({ ...base, cleanup: "none" });
    expect(none.system).toContain("Do NOT remove anything");
    // and the default (unset) behaves as light
    expect(buildPolishMessages(base).system).toContain("Remove filler words");
  });

  it("honours the transcription-format enum", () => {
    const casual = buildPolishMessages({ ...base, format: "casual" });
    expect(casual.system).toContain("Casual messaging format");
    const lower = buildPolishMessages({ ...base, format: "lowercase" });
    expect(lower.system).toContain("All-lowercase format");
    // raw formatting never reaches the prompt (the session skips polish) — but
    // if it did, the prompt must not add styling beyond the rules.
    const plain = buildPolishMessages({ ...base, format: "formatted" });
    expect(plain.system).not.toContain("Casual messaging");
  });

  it("skips cleanup in AI apps (their appType rule)", () => {
    const ai = buildPolishMessages({ ...base, appType: "ai", cleanup: "high" });
    expect(ai.system).toContain("Do NOT remove anything");
    const normal = buildPolishMessages({ ...base, appType: "other", cleanup: "high" });
    expect(normal.system).not.toContain("Do NOT remove anything");
  });

  it("adapts to messaging and email target apps", () => {
    const chat = buildPolishMessages({ ...base, isMessaging: true });
    expect(chat.system).toContain("chat app");
    const email = buildPolishMessages({
      ...base,
      appType: "email",
      emailSignature: "— Sent with WhisperFlow",
    });
    expect(email.system).toContain("email composer");
    expect(email.user).toContain("— Sent with WhisperFlow");
    // without a signature configured the body is untouched
    const plainEmail = buildPolishMessages({ ...base, appType: "email" });
    expect(plainEmail.user).toBe(base.raw);
  });
});

describe("model catalog", () => {
  it("has unique ids and valid URLs", () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    expect(ids.size).toBe(CATALOG.length);
    for (const e of CATALOG) {
      expect(e.url).toMatch(/^https:\/\//);
      expect(e.repo.length).toBeGreaterThan(2);
      expect(e.file.length).toBeGreaterThan(2);
      expect(e.tiers.length).toBeGreaterThan(0);
      if (e.sizeBytes !== undefined) expect(e.sizeBytes).toBeGreaterThan(100_000);
    }
  });

  it("covers every default config model id plus the sidecar", () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    expect(ids.has("whisper-bin-x64")).toBe(true);
    expect(ids.has(DEFAULT_CONFIG.stt.modelId)).toBe(true);
    expect(ids.has(DEFAULT_CONFIG.polish.modelId)).toBe(true);
  });

  it("has one stt weights model per tier", () => {
    for (const tier of ["low", "mid", "high"] as const) {
      expect(CATALOG.some((e) => e.role === "stt" && e.format === "ggml" && e.tiers.includes(tier))).toBe(true);
    }
  });
});

describe("tiering", () => {
  it("maps RAM to tiers at the boundaries", () => {
    expect(detectTier(4 * 1024 ** 3)).toBe("low");
    expect(detectTier(8 * 1024 ** 3)).toBe("mid");
    expect(detectTier(32 * 1024 ** 3)).toBe("high");
  });

  it("recommends a complete, catalog-backed set per tier", () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    for (const tier of ["low", "mid", "high"] as const) {
      const r = recommendFor(tier);
      expect(ids.has(r.stt)).toBe(true);
      expect(ids.has(r.polish)).toBe(true);
      expect(r.polishViable).toBe(true);
    }
  });
});

describe("history store", () => {
  const store = () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-history-"));
    return { dir, s: createHistoryStore(join(dir, "history.json")) };
  };

  it("adds and lists newest-first", () => {
    const { s } = store();
    s.add({ rawText: "first", finalText: "First." });
    s.add({ rawText: "second", finalText: "Second." });
    const list = s.list();
    expect(list.map((t) => t.rawText)).toEqual(["second", "first"]);
    expect(list[0]!.id).not.toBe(list[1]!.id);
    expect(list[0]!.createdAt).toBeGreaterThanOrEqual(list[1]!.createdAt);
  });

  it("searches raw, final, and app fields case-insensitively", () => {
    const { s } = store();
    s.add({ rawText: "alpha note", finalText: "Alpha.", app: "VS Code" });
    s.add({ rawText: "beta", finalText: "Beta." });
    expect(s.list({ query: "alpha" })).toHaveLength(1);
    expect(s.list({ query: "beta" })).toHaveLength(1);
    expect(s.list({ query: "vs code" })).toHaveLength(1);
    expect(s.list({ query: "zzz" })).toHaveLength(0);
  });

  it("respects the limit", () => {
    const { s } = store();
    for (let i = 0; i < 10; i++) s.add({ rawText: `t${i}` });
    expect(s.list({ limit: 3 })).toHaveLength(3);
  });

  it("deletes and clears with correct reports", () => {
    const { s } = store();
    const a = s.add({ rawText: "a" });
    expect(s.delete(a.id)).toBe(true);
    expect(s.delete(a.id)).toBe(false);
    s.add({ rawText: "b" });
    expect(s.clear()).toBe(true);
    expect(s.clear()).toBe(false);
    expect(s.list()).toHaveLength(0);
  });
});

describe("ConfigStore", () => {
  const store = () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-config-"));
    return { dir, s: new ConfigStore(join(dir, "config.json")) };
  };

  it("starts from defaults and persists sets", () => {
    const { dir, s } = store();
    expect(s.get().stt.modelId).toBe("whisper-small");
    s.set({ hotkey: { pushToTalk: "Alt+Q" } });
    const reopened = new ConfigStore(join(dir, "config.json"));
    expect(reopened.get().hotkey.pushToTalk).toBe("Alt+Q");
    expect(reopened.get().hotkey.toggleMode).toBe(false); // default survived
  });

  it("rejects invalid patches without corrupting stored state", () => {
    const { s } = store();
    expect(() => s.set({ privacy: { localOnly: "yes" } })).toThrow();
    expect(s.get().privacy.localOnly).toBe(true);
  });

  it("round-trips dictionary and command collections", () => {
    const { s } = store();
    s.set({
      dictionary: [{ id: "d", term: "WhisperFlow" }],
      commands: [{ id: "c", phrase: "scratch that", action: "undo" }],
    });
    const cfg = WhisperFlowConfigSchema.parse(s.get());
    expect(cfg.dictionary[0]!.term).toBe("WhisperFlow");
    expect(cfg.commands[0]!.action).toBe("undo");
  });
});

describe("deepMerge", () => {
  it("merges objects deeply and replaces arrays/scalars wholesale", () => {
    const out = deepMerge({ a: { b: 1, c: [1, 2] }, d: "x" }, { a: { b: 2, c: [9] }, d: undefined });
    expect(out).toEqual({ a: { b: 2, c: [9] }, d: "x" });
  });
});

describe("RemoteOpenAIProvider", () => {
  it("refuses to run under the local-only lock", async () => {
    const provider = new RemoteOpenAIProvider(() => WhisperFlowConfigSchema.parse({}));
    await expect(async () => {
      for await (const _ of provider.polish({
        raw: "x",
        tone: "neutral",
        modelId: "m",
        dictionary: [],
      })) {
        /* iterate */
      }
    }).rejects.toThrow(/Local-only/);
    expect(await provider.available()).toBe(false);
  });
});
