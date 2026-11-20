/**
 * Hold-to-talk + typing detection via an optional global keyboard hook.
 *
 * Why this exists: Electron's `globalShortcut` only fires **key-down** — there
 * is no key-up event, so true "press and hold to talk" is impossible through
 * it. `uiohook-napi` (MIT, prebuilt, already a dependency) exposes the OS-level
 * hook, so we can see both edges of a keystroke.
 *
 * Privacy: the hook only starts when the user enables hold-to-talk. It watches
 * for the configured accelerator combination and — while a dictation is
 * running — counts *other* keys as "the user is typing". Keystrokes are never
 * recorded, stored, or transmitted; only booleans cross this boundary.
 *
 * If the hook cannot be loaded (missing prebuild, ABI break), hold-to-talk
 * silently falls back to the toggle behavior and `available()` reports false
 * so the settings UI can say so honestly.
 */
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

export interface KeyboardHookEvents {
  /** The configured accelerator was fully pressed. */
  onHoldStart(): void;
  /** The main key of the accelerator was released. */
  onHoldEnd(): void;
  /** Some other key was pressed while a dictation was running. */
  onTyping(): void;
  /** Debug surface: the first raw keycode the hook observes. */
  onFirstKey?(keycode: number): void;
}

interface UiohookApi {
  uIOhook: {
    on(event: string, handler: (e: UiohookEvent) => void): unknown;
    start(): void;
    stop(): void;
  };
  UiohookKey: Record<string, number>;
}

interface UiohookEvent {
  keycode: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

let api: UiohookApi | null = null;
let loadFailed = "";

function load(): UiohookApi | null {
  if (api) return api;
  if (loadFailed) return null;
  try {
    api = require_("uiohook-napi") as UiohookApi;
    return api;
  } catch (err) {
    loadFailed = String(err).split("\n")[0]?.slice(0, 120) ?? "unknown";
    return null;
  }
}

/** True when the global keyboard hook is usable on this machine. */
export function hookAvailable(): boolean {
  return load() !== null;
}

/** Why the hook could not load, for the settings UI. Empty when it works. */
export function hookUnavailableReason(): string {
  return loadFailed;
}

/** Accelerator token → uiohook keycode aliases (both physical keys accepted). */
const MODIFIER_ALIASES: Record<string, [string, string]> = {
  control: ["Ctrl", "CtrlRight"],
  ctrl: ["Ctrl", "CtrlRight"],
  shift: ["Shift", "ShiftRight"],
  alt: ["Alt", "AltRight"],
  option: ["Alt", "AltRight"],
  meta: ["Meta", "MetaRight"],
  command: ["Meta", "MetaRight"],
  super: ["Meta", "MetaRight"],
  win: ["Meta", "MetaRight"],
};

/** Non-modifier key spellings Electron accepts that differ from the enum. */
const KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  return: "Enter",
  enter: "Enter",
  space: "Space",
  backspace: "Backspace",
  tab: "Tab",
  delete: "Delete",
};

/**
 * Parses an Electron accelerator string into the modifier groups that must be
 * held (each group = one logical modifier, either physical key) plus the main
 * key. Exported (and unit-tested) because a wrong mapping here would break
 * hold-to-talk on every layout.
 */
export interface ParsedAccelerator {
  /** One array per modifier token; the hold matches if one key per group is down. */
  modifierGroups: number[][];
  main: number | null;
}

export function parseAccelerator(accelerator: string): ParsedAccelerator {
  const uio = load();
  if (!uio) return { modifierGroups: [], main: null };
  const tokens = accelerator
    .split("+")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const lookup = (name: string): number | undefined => {
    const code = uio.UiohookKey[name];
    return typeof code === "number" ? code : undefined;
  };

  const modifierGroups: number[][] = [];
  let main: number | null = null;
  for (const token of tokens) {
    const alias = MODIFIER_ALIASES[token];
    if (alias) {
      const group = alias.map((name) => lookup(name)).filter((c): c is number => c !== undefined);
      if (group.length) modifierGroups.push(group);
      continue;
    }
    // Main key: UiohookKey names are case-sensitive ("Space", "A", "F1").
    const candidates = [
      KEY_ALIASES[token],
      token.length === 1 ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1),
      token.toUpperCase(),
      token,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const code = lookup(candidate);
      if (code !== undefined) {
        main = code;
        break;
      }
    }
  }
  return { modifierGroups, main };
}

/** One configured hotkey watcher. */
export class HoldToTalkWatcher {
  private modifiersHeld = new Set<number>();
  private active = false;
  private armed = false;
  private lastTypingAt = 0;
  private running = false;
  private sawFirstKey = false;

  constructor(
    public readonly accelerator: string,
    private readonly events: KeyboardHookEvents,
  ) {}

  start(): void {
    const uio = load();
    if (!uio || this.running) return;
    this.running = true;
    uio.uIOhook.on("keydown", (e) => this.onKeydown(e));
    uio.uIOhook.on("keyup", (e) => this.onKeyup(e));
    uio.uIOhook.start();
  }

  stop(): void {
    const uio = load();
    if (!uio || !this.running) return;
    this.running = false;
    this.modifiersHeld.clear();
    this.active = false;
    this.setArmed(false);
    uio.uIOhook.stop();
  }

  /** The dictation controller arms typing detection while a session runs. */
  setArmed(armed: boolean): void {
    this.armed = armed;
  }

  private onKeydown(e: UiohookEvent): void {
    if (!this.sawFirstKey) {
      this.sawFirstKey = true;
      this.events.onFirstKey?.(e.keycode);
    }
    const { modifierGroups, main } = parseAccelerator(this.accelerator);
    if (main === null) return;

    for (const group of modifierGroups) {
      if (group.includes(e.keycode)) this.modifiersHeld.add(e.keycode);
    }

    if (e.keycode === main) {
      // The press only counts when every modifier is held (in either hand).
      const allMods =
        modifierGroups.length > 0 &&
        modifierGroups.every((g) => g.some((k) => this.modifiersHeld.has(k)));
      if (allMods && !this.active) {
        this.active = true;
        this.events.onHoldStart();
      }
      return;
    }

    // Typing: any key that isn't part of the combination, while dictating.
    const inCombo = main === e.keycode || modifierGroups.some((g) => g.includes(e.keycode));
    if (this.armed && !inCombo && Date.now() - this.lastTypingAt > 800) {
      this.lastTypingAt = Date.now();
      this.events.onTyping();
    }
  }

  private onKeyup(e: UiohookEvent): void {
    const { modifierGroups, main } = parseAccelerator(this.accelerator);
    const inCombo =
      (main !== null && e.keycode === main) || modifierGroups.some((g) => g.includes(e.keycode));
    if (modifierGroups.some((g) => g.includes(e.keycode))) this.modifiersHeld.delete(e.keycode);
    // Releasing the main key — or any modifier of the combo — ends the hold.
    if (this.active && inCombo) {
      this.active = false;
      this.events.onHoldEnd();
    }
  }
}
