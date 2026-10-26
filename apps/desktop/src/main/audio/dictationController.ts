import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import type { DictationStateEvent } from "@whisperflow/shared";
import { pcmToWav } from "@whisperflow/engine";
import type { EnginePort, EngineSession } from "../engine/enginePort";
import type { WindowManager } from "../windows/WindowManager";
import type { HotkeyManager } from "../hotkeys/hotkeys";
import { injectText } from "../injection/windowsInjector";
import { log } from "../lib/log";

/**
 * Owns one dictation at a time: hotkey → overlay + mic → engine session →
 * polished text → paste into the focused app. Forwards engine state events
 * to the overlay and appends the host-side states (injecting / done).
 *
 * Meeting mode: utterances arrive as `appendText` on `listening` events and
 * are pasted immediately; the session keeps running until the hotkey again.
 * Recorder mode: meeting mode + the session's audio saved as WAV next to the
 * transcript in <userData>/recordings (or the folder the user picked).
 */
export class DictationController {
  private session: EngineSession | null = null;
  private finishing = false;
  private recording = false;
  /** PCM chunks accumulated while saving audio (engine session is 16 kHz mono). */
  private chunks: Float32Array[] = [];
  private audioPath: string | null = null;

  constructor(
    private readonly deps: {
      engine: EnginePort;
      windows: WindowManager;
      hotkeys: HotkeyManager;
      /** Notifies the host (tray tooltip/state) when activity changes. */
      onActivity?: (active: boolean, recording: boolean) => void;
    },
  ) {}

  private notify(): void {
    this.deps.onActivity?.(this.active, this.recording);
  }

  get active(): boolean {
    return this.session !== null;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  async toggle(): Promise<void> {
    if (this.session) await this.finish();
    else await this.start();
  }

  async start(opts: { recorder?: boolean } = {}): Promise<void> {
    if (this.session) return;
    try {
      const cfg = await this.deps.engine.getConfig().catch(() => null);
      const meeting = Boolean(cfg?.general?.meetingMode) || opts.recorder;
      this.recording = opts.recorder || (cfg?.general?.saveAudio ?? false);
      this.chunks = [];
      this.audioPath = this.recording ? this.recordingsTarget(cfg?.general?.recordingsDir) : null;

      const session = await this.deps.engine.startSession(
        (ev) => this.broadcast(ev),
        this.audioPath ? { audioPath: this.audioPath } : undefined,
      );
      this.session = session;
      this.finishing = false;
      this.deps.hotkeys.bindEscape();
      this.deps.windows.showOverlay(undefined, cfg?.general?.overlayPosition ?? "cursor");
      log(
        `dictation: started${meeting ? " (meeting mode" + (opts.recorder ? " + recorder" : "") + ")" : ""}${
          this.audioPath ? " (saving audio)" : ""
        }`,
      );
      this.notify();
    } catch (err) {
      log("dictation: failed to start:", err);
      this.broadcast({ state: "error", error: String(err) });
    }
  }

  /** PCM arrives from the overlay renderer's AudioWorklet (16 kHz mono). */
  feed(pcm: Float32Array): void {
    if (this.recording) this.chunks.push(pcm.slice());
    this.session?.feed(pcm);
  }

  async finish(): Promise<void> {
    const session = this.session;
    if (!session || this.finishing) return;
    this.finishing = true;
    this.session = null;

    this.broadcast({ state: "transcribing", recording: this.recording }); // renderer stops the mic on this
    try {
      const result = await session.stop();
      if (result && result.final && result.action !== "undo") {
        this.broadcast({ state: "injecting" });
        const ok = await injectText(result.final);
        if (!ok) log("dictation: injection returned false");
      }
      this.broadcast({ state: "done" });
      log("dictation: done", result ? `(${result.final.length} chars${result.action ? `, ${result.action}` : ""})` : "(empty)");
      setTimeout(() => this.deps.windows.hideOverlay(), 400);
      this.deps.windows.sendToSettings("dictation/state", { state: "done" });
    } catch (err) {
      log("dictation: failed:", err);
      this.broadcast({ state: "error", error: String(err) });
      setTimeout(() => this.deps.windows.hideOverlay(), 2200);
    } finally {
      if (this.recording) this.flushRecording();
      this.recording = false;
      this.deps.hotkeys.unbindEscape();
      this.finishing = false;
      this.notify();
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
    this.chunks = [];
    this.recording = false;
    this.deps.windows.hideOverlay();
    this.deps.hotkeys.unbindEscape();
    this.broadcast({ state: "cancelled" });
    this.notify();
    log("dictation: cancelled");
  }

  private broadcast(ev: DictationStateEvent): void {
    // Meeting mode: each finished utterance is pasted the instant it's ready;
    // the session keeps listening afterwards.
    if (ev.state === "listening" && ev.appendText) {
      void injectText(ev.appendText).catch((err) => log("dictation: append injection failed:", err));
    }
    this.deps.windows.sendToOverlay("dictation/state", ev);
  }

  /** Writes the accumulated PCM as a WAV next to the transcript entry. */
  private flushRecording(): void {
    const chunks = this.chunks;
    this.chunks = [];
    if (!this.audioPath || chunks.length === 0) return;
    try {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      writeFileSync(this.audioPath, pcmToWav(merged, 16000));
      log("dictation: saved audio", this.audioPath, `(${(total / 16000).toFixed(1)}s)`);
    } catch (err) {
      log("dictation: failed to save audio:", err);
    }
  }

  private recordingsTarget(dir?: string): string {
    const base = dir || join(app.getPath("userData"), "recordings");
    mkdirSync(base, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return join(base, `wf-${stamp}.wav`);
  }
}
