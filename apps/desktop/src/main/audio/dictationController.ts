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
import { getForegroundApp } from "../system/foreground";
import { getAppType, isMessagingApp } from "../system/appType";
import { getFocusedElementInfo } from "../system/uia";
import { applyLearnedWords, observeEdits } from "../learning/editObserver";

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
  /** Cancels the in-flight post-paste edit observer, if any. */
  private disposer: (() => void) | null = null;
  /** Signature already present in the target box — their eligibility rule. */
  private skipSignature = false;
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

  /** Hard cap on one dictation: 0 disables. Prevents a stuck hotkey from
   *  recording for hours (the reference app ships the same guard, default 20
   *  minutes, warning one minute before the cap). */
  private recordingCap: NodeJS.Timeout | null = null;
  private recordingCapWarn: NodeJS.Timeout | null = null;
  private armRecordingCap(maxMs: number): void {
    if (this.recordingCap) {
      clearTimeout(this.recordingCap);
      this.recordingCap = null;
    }
    if (this.recordingCapWarn) {
      clearTimeout(this.recordingCapWarn);
      this.recordingCapWarn = null;
    }
    if (maxMs > 0) {
      // Their DICTATION_DURATION_WARNING_TIMEOUT: "…one more minute".
      if (maxMs > 60_000) {
        this.recordingCapWarn = setTimeout(() => {
          if (this.session) log(`dictation: one minute left of the ${Math.round(maxMs / 60000)}-minute cap`);
        }, maxMs - 60_000);
      }
      this.recordingCap = setTimeout(() => {
        if (this.session) {
          log(`dictation: hit the ${Math.round(maxMs / 60000)}-minute cap — finishing`);
          void this.finish();
        }
      }, maxMs);
    }
  }

  /** After the paste, watch the target box for edits (their UpdateEditedText
   *  pipeline): if the user re-typed something, learn corrected words into
   *  the dictionary. Safe to run unattended — it never blocks or throws. */
  private observeEdits(dictated: string): void {
    try {
      void (async () => {
        const cfg = await this.deps.engine.getConfig().catch(() => null);
        const dictionary = cfg?.dictionary ?? [];
        if (cfg?.dictionaryAutoLearn === false) return;
        this.disposer?.();
        this.disposer = observeEdits(
          {
            dictated,
            dictionary: dictionary.map((d) => d.term),
            autoLearn: cfg?.dictionaryAutoLearn ?? true,
            log,
            readContents: async () => {
              const el = await getFocusedElementInfo().catch(() => null);
              return el?.isEditable ? el.value : null;
            },
          },
          (res) => {
            this.disposer = null;
            if (res.endReason === "edited" && res.candidates.length > 0) {
              const { added, next } = applyLearnedWords(dictionary, res.candidates);
              if (added.length > 0) {
                void this.deps.engine.setConfig({ dictionary: next });
                log(`dictation: learned ${added.length} word(s) from your edit — ${added.join(", ")}`);
              }
            }
          },
        );
      })();
    } catch (err) {
      log("dictation: edit observation failed:", err);
    }
  }

  /** True while a dictation is mid-flight — their deferred-recovery gate. */
  get busy(): boolean {
    return this.session !== null || this.finishing;
  }

  async start(opts: { recorder?: boolean } = {}): Promise<void> {
    if (this.session) return;
    try {
      const cfg = await this.deps.engine.getConfig().catch(() => null);
      const meeting = Boolean(cfg?.general?.meetingMode) || opts.recorder;
      this.recording = opts.recorder || (cfg?.general?.saveAudio ?? false);
      this.chunks = [];
      this.audioPath = this.recording ? this.recordingsTarget(cfg?.general?.recordingsDir) : null;

      // Attribute the dictation to the app that will receive it (per-app stats,
      // history filters) — the reference app stores this too. The type drives
      // per-app formatting: signature in email apps, no trailing period in
      // chat, cleanup skipped in AI apps.
      const fg = await getForegroundApp().catch(() => null);
      // UIA gives us the real browser URL (their GetActiveAppInfo url field) —
      // a much stronger classification signal than the window title.
      const uia = await getFocusedElementInfo().catch(() => null);
      const url = uia?.isUrl ? uia.value : (fg?.title ?? "");
      const appType = fg ? getAppType(fg.app, url) : undefined;
      const session = await this.deps.engine.startSession(
        (ev) => this.broadcast(ev),
        {
          ...(fg ? { app: fg.app } : {}),
          ...(appType ? { appType } : {}),
          ...(fg && appType ? { isMessaging: isMessagingApp(fg.app, url) } : {}),
          ...(appType === "email" ? { skipSignature: this.skipSignature } : {}),
          ...(this.audioPath ? { audioPath: this.audioPath } : {}),
        },
      );
      this.session = session;
      this.finishing = false;
      this.deps.hotkeys.bindEscape();
      this.deps.windows.showOverlay(undefined, cfg?.general?.overlayPosition ?? "cursor");
      this.armRecordingCap(cfg?.audio?.maxRecordingLengthMs ?? 0);
      // Their email-signature eligibility: never add a signature when one is
      // already in the box we're about to type into.
      this.skipSignature = Boolean(appType === "email" && uia?.isEditable && /\n\s*—/.test(uia.value));
      log(
        `dictation: started${meeting ? " (meeting mode" + (opts.recorder ? " + recorder" : "") + ")" : ""}${
          this.audioPath ? " (saving audio)" : ""
        }${fg ? ` (app=${fg.app} type=${appType ?? "unknown"}${uia?.isUrl ? ` url=${uia.value}` : ""})` : ""}`,
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
        else this.observeEdits(result.final);
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
      if (this.recordingCap) {
        clearTimeout(this.recordingCap);
        this.recordingCap = null;
      }
      if (this.recordingCapWarn) {
        clearTimeout(this.recordingCapWarn);
        this.recordingCapWarn = null;
      }
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
    if (this.recordingCap) {
      clearTimeout(this.recordingCap);
      this.recordingCap = null;
    }
    if (this.recordingCapWarn) {
      clearTimeout(this.recordingCapWarn);
      this.recordingCapWarn = null;
    }
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
