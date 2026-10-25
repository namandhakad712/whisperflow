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
export class HotkeyManager {
  private mainAccelerator = "";
  private escapeBound = false;

  constructor(
    private readonly handlers: {
      onToggle: () => void;
      onCancel: () => void;
    },
  ) {}

  /** Registers the primary dictation hotkey. Returns false if the accelerator is taken. */
  bindMain(accelerator: string): boolean {
    this.unbindMain();
    const ok = globalShortcut.register(accelerator, this.handlers.onToggle);
    if (ok) this.mainAccelerator = accelerator;
    return ok;
  }

  unbindMain(): void {
    if (this.mainAccelerator) {
      globalShortcut.unregister(this.mainAccelerator);
      this.mainAccelerator = "";
    }
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
  }
}
