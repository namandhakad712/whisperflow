import type { EnginePort, EngineSession } from "../engine/enginePort";
import type { WindowManager } from "../windows/WindowManager";
import type { HotkeyManager } from "../hotkeys/hotkeys";
import { injectText } from "../injection/windowsInjector";
import { log } from "../lib/log";

export interface DictationStateEvent {
  state: "idle" | "listening" | "transcribing" | "polishing" | "injecting" | "done" | "cancelled" | "error";
  partial?: string;
  error?: string;
}

/**
 * Owns one dictation at a time: hotkey → overlay + mic → engine session →
 * polished text → paste into the focused app.
 */
export class DictationController {
  private session: EngineSession | null = null;
  private finishing = false;

  constructor(
    private readonly deps: {
      engine: EnginePort;
      windows: WindowManager;
      hotkeys: HotkeyManager;
    },
  ) {}

  get active(): boolean {
    return this.session !== null;
  }

  async toggle(): Promise<void> {
    if (this.session) await this.finish();
    else await this.start();
  }

  async start(): Promise<void> {
    if (this.session) return;
    try {
      const session = await this.deps.engine.startSession();
      this.session = session;
      this.finishing = false;
      session.onState((ev) => this.broadcast({ state: ev.state as DictationStateEvent["state"], partial: ev.partial, error: ev.error }));
      this.deps.hotkeys.bindEscape();
      this.deps.windows.showOverlay();
      this.broadcast({ state: "listening" });
      log("dictation: started");
    } catch (err) {
      log("dictation: failed to start:", err);
      this.broadcast({ state: "error", error: String(err) });
    }
  }

  /** PCM arrives from the overlay renderer's AudioWorklet. */
  feed(pcm: Float32Array): void {
    this.session?.feed(pcm);
  }

  async finish(): Promise<void> {
    const session = this.session;
    if (!session || this.finishing) return;
    this.finishing = true;
    this.session = null;

    this.broadcast({ state: "transcribing" }); // renderer stops the mic on this
    try {
      const result = await session.stop();
      if (result && result.final) {
        this.broadcast({ state: "injecting" });
        const ok = await injectText(result.final);
        if (!ok) log("dictation: injection returned false");
      }
      this.broadcast({ state: "done" });
      log("dictation: done", result ? `(${result.final.length} chars)` : "(empty)");
      setTimeout(() => this.deps.windows.hideOverlay(), 400);
      this.deps.windows.sendToSettings("dictation/state", { state: "done" });
    } catch (err) {
      log("dictation: failed:", err);
      this.broadcast({ state: "error", error: String(err) });
      setTimeout(() => this.deps.windows.hideOverlay(), 2200);
    } finally {
      this.deps.hotkeys.unbindEscape();
      this.finishing = false;
    }
  }

  cancel(): void {
    const session = this.session;
    this.session = null;
    try {
      session?.cancel();
    } catch (err) {
      log("dictation: cancel error:", err);
    }
    this.deps.windows.hideOverlay();
    this.deps.hotkeys.unbindEscape();
    this.broadcast({ state: "cancelled" });
    log("dictation: cancelled");
  }

  private broadcast(ev: DictationStateEvent): void {
    this.deps.windows.sendToOverlay("dictation/state", ev);
  }
}
