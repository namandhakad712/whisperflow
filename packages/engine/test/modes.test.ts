import { describe, expect, it } from "vitest";
import {
  applyModeOverrides,
  modeMatches,
  resolveMode,
  type ModeTarget,
} from "../src/modes/resolve.js";
import { WhisperFlowConfigSchema, type ModeProfile } from "@whisperflow/shared";

const target: ModeTarget = { app: "Code.exe", title: "main.ts — my-app", url: "" };
const browserTarget: ModeTarget = {
  app: "msedge.exe",
  title: "Inbox (12) — Gmail — Microsoft Edge",
  url: "https://mail.google.com/mail/u/0/#inbox",
};

function profile(overrides: Partial<ModeProfile>): ModeProfile {
  const parsed = WhisperFlowConfigSchema.parse({
    modes: {
      profiles: [{ id: "m1", name: "Coding", match: "code", ...overrides }],
    },
  });
  return parsed.modes!.profiles[0]! as ModeProfile;
}

function configWith(profiles: ModeProfile[]) {
  return WhisperFlowConfigSchema.parse({ modes: { profiles } });
}

describe("mode resolution", () => {
  it("matches the app name case-insensitively", () => {
    expect(modeMatches(profile({}), target)).toBe(true);
    expect(modeMatches(profile({ match: "CODE" }), target)).toBe(true);
    expect(modeMatches(profile({ match: "slack" }), target)).toBe(false);
  });

  it("matches the window title", () => {
    expect(modeMatches(profile({ match: "main.ts" }), target)).toBe(true);
  });

  it("matches a browser URL so 'gmail' covers gmail-in-a-browser", () => {
    expect(modeMatches(profile({ match: "gmail" }), browserTarget)).toBe(true);
    expect(modeMatches(profile({ match: "mail.google.com" }), browserTarget)).toBe(true);
  });

  it("skips disabled profiles and respects list order", () => {
    const cfg = configWith([
      profile({ id: "first", match: "nomatch" }),
      profile({ id: "second", match: "code", enabled: false }),
      profile({ id: "third", match: "code" }),
    ]);
    const mode = resolveMode(cfg, target);
    expect(mode?.id).toBe("third");
  });

  it("returns null when nothing matches", () => {
    expect(resolveMode(configWith([profile({ match: "slack" })]), target)).toBeNull();
  });

  it("applies only the non-auto overrides", () => {
    const base = WhisperFlowConfigSchema.parse({});
    const cfg = applyModeOverrides(base, profile({ tone: "casual", format: "raw" }));
    expect(cfg.polish.tone).toBe("casual");
    expect(cfg.polish.format).toBe("raw");
    // untouched overrides keep the globals
    expect(cfg.polish.cleanup).toBe(base.polish.cleanup);
    expect(cfg.polish.emailSignature).toBe(base.polish.emailSignature);
  });

  it("appends custom instructions without clobbering the global ones", () => {
    const base = WhisperFlowConfigSchema.parse({ polish: { customInstructions: "never swear" } });
    const cfg = applyModeOverrides(base, profile({ customInstructions: "use bullets" }));
    expect(cfg.polish.customInstructions).toBe("never swear\nuse bullets");
  });

  it("never mutates the input config", () => {
    const base = WhisperFlowConfigSchema.parse({});
    applyModeOverrides(base, profile({ tone: "professional" }));
    expect(base.polish.tone).not.toBe("professional");
  });

  it("prepends the mode's corrections ahead of the global dictionary", () => {
    const base = WhisperFlowConfigSchema.parse({
      dictionary: [{ id: "g1", term: "WhisperFlow" }],
    });
    const cfg = applyModeOverrides(
      base,
      profile({ id: "m-code", dictionary: [{ id: "c1", term: "WhisperFlow" }] }),
    );
    expect(cfg.dictionary[0]!.id).toBe("c1");
    expect(cfg.dictionary[1]!.id).toBe("g1");
    expect(cfg.dictionary.length).toBe(2);
    // The mode's source config is untouched (structuredClone).
    expect(base.dictionary.length).toBe(1);
  });

  it("mode STT block overrides model + language; empty strings keep the global", () => {
    const base = WhisperFlowConfigSchema.parse({
      stt: { modelId: "whisper-small", language: "en" },
    });
    const cfg = applyModeOverrides(
      base,
      profile({ id: "m-code", stt: { modelId: "whisper-large-v3-turbo" } }),
    );
    expect(cfg.stt.modelId).toBe("whisper-large-v3-turbo");
    expect(cfg.stt.language).toBe("en"); // unset → global kept
    // Empty string leaves the global alone; base config untouched (clone).
    const cfg2 = applyModeOverrides(base, profile({ id: "m-x", stt: { language: "fr" } }));
    expect(cfg2.stt.language).toBe("fr");
    expect(cfg2.stt.modelId).toBe("whisper-small");
    expect(base.stt.modelId).toBe("whisper-small");
  });
});
