import { describe, expect, it } from "vitest";
import { hookAvailable, parseAccelerator } from "../src/main/hotkeys/holdToTalk";

/**
 * parseAccelerator turns an Electron accelerator into raw uiohook keycodes. A
 * silent null/undefined mapping here makes hold-to-talk ignore EVERY keypress —
 * which is exactly the bug this suite caught: tokens are lowercased but the
 * enum is case-sensitive ("space" vs "Space"), and both physical variants of a
 * modifier must not be required at once (a human presses only one).
 */
describe("accelerator parsing", () => {
  it("parses the default combination", () => {
    const { modifierGroups, main } = parseAccelerator("Control+Shift+Space");
    expect(main).toBe(57); // UiohookKey.Space
    expect(modifierGroups).toEqual([
      [29, 3613], // Ctrl | CtrlRight
      [42, 54], // Shift | ShiftRight
    ]);
  });

  it("handles aliases and single letters", () => {
    expect(parseAccelerator("Alt+A").main).toBe(30); // UiohookKey.A
    expect(parseAccelerator("Alt+a").main).toBe(30);
    expect(parseAccelerator("Command+Esc").main).toBe(1); // Escape
    expect(parseAccelerator("Ctrl+F1").main).toBeGreaterThan(0);
    expect(parseAccelerator("Win+S").modifierGroups[0]).toContain(3675);
  });

  it("accepts lowercase modifier spellings", () => {
    const a = parseAccelerator("Control+Shift+Space");
    const b = parseAccelerator("control+shift+space");
    expect(b.main).toBe(a.main);
    expect(b.modifierGroups).toEqual(a.modifierGroups);
  });

  it("yields no groups when the hook is unavailable", () => {
    // The hook is present in the dev environment; degrade gracefully otherwise.
    if (!hookAvailable()) expect(parseAccelerator("Control+Shift+Space").modifierGroups).toEqual([]);
  });

  it("reports hook availability without throwing", () => {
    expect(typeof hookAvailable()).toBe("boolean");
  });
});
