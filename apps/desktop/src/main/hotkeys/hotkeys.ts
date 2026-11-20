import { globalShortcut } from "electron";

/**
 * Global hotkey management.
 *
 * v1 interaction model (documented in docs/ARCHITECTURE.md):
 * Electron's globalShortcut has no key-up events, so true "hold to talk" is not
 * possible without native hooks. The default is therefore a toggle: press to
 * start, press again (or fall silent) to finish. Escape is registered only
 * while a dictation is active and cancels it without pasting.
 */
/** Their shortcut actions that need a global binding. */
export type ShortcutAction = "pasteLast" | "copyLast" | "lens";

export class HotkeyManager {
  private mainAccelerator = "";
  private escapeBound = false;
  private actionAccelerators: Partial<Record<ShortcutAction, string>> = {};

  constructor(
    private readonly handlers: {
      onToggle: () => void;
      onCancel: () => void;
      onPasteLast?: () => void;
      onCopyLast?: () => void;
      onLens?: () => void;
    },
  ) {}

  /** Registers the primary dictation hotkey. Returns false if the accelerator is taken or invalid. */
  bindMain(accelerator: string): boolean {
    this.unbindMain();
    // register() THROWS on an unparseable accelerator (e.g. a modifier-only
    // combo like "Ctrl+Super+Alt") — a bad config value must never crash the app.
    let ok = false;
    try {
      ok = globalShortcut.register(accelerator, this.handlers.onToggle);
    } catch {
      ok = false;
    }
    if (ok) this.mainAccelerator = accelerator;
    return ok;
  }

  unbindMain(): void {
    if (this.mainAccelerator) {
      try {
        globalShortcut.unregister(this.mainAccelerator);
      } catch {
        /* already gone */
      }
      this.mainAccelerator = "";
    }
  }

  /**
   * Registers their per-action shortcuts. Any action without an accelerator is
   * unregistered, so this is idempotent — safe to call on every settings save.
   */
  bindActions(accelerators: Partial<Record<ShortcutAction, string>>): { ok: boolean; failed?: ShortcutAction } {
    this.unbindActions();
    for (const action of Object.keys(accelerators) as ShortcutAction[]) {
      const accelerator = accelerators[action];
      if (!accelerator) continue;
      const handler =
        action === "pasteLast"
          ? this.handlers.onPasteLast
          : action === "copyLast"
            ? this.handlers.onCopyLast
            : this.handlers.onLens;
      if (!handler) continue;
      let registered = false;
      try {
        registered = globalShortcut.register(accelerator, handler);
      } catch {
        registered = false;
      }
      if (registered) {
        this.actionAccelerators[action] = accelerator;
      } else {
        return { ok: false, failed: action };
      }
    }
    return { ok: true };
  }

  unbindActions(): void {
    for (const [action, accelerator] of Object.entries(this.actionAccelerators)) {
      if (accelerator) globalShortcut.unregister(accelerator);
    }
    this.actionAccelerators = {};
  }

  bindEscape(): void {
    if (this.escapeBound) return;
    if (globalShortcut.register("Escape", this.handlers.onCancel)) this.escapeBound = true;
  }

  unbindEscape(): void {
    if (this.escapeBound) {
      globalShortcut.unregister("Escape");
      this.escapeBound = false;
    }
  }

  get current(): string {
    return this.mainAccelerator;
  }

  dispose(): void {
    this.unbindMain();
    this.unbindEscape();
    this.unbindActions();
  }
}
