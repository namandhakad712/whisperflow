/**
 * One dictation turn: PCM in → VAD segments → STT → dictionary correction →
 * command detection → polish (LLM or offline fallback) → history entry.
 *
 * The session is deliberately dumb about the UI and the host: it emits
 * `DictationStateEvent`s and returns a final result; injection and overlay
 * handling live in the desktop host.
 */
import {
  canTransition,
  type DictationState,
  type DictationStateEvent,
  type TranscriptItem,
  type VoiceCommand,
  type WhisperFlowConfig,
} from "@whisperflow/shared";
import { RmsVad } from "../audio/vad/rms-vad.js";
import { resample } from "../audio/resampler.js";
import { fuzzyCorrect } from "../text/dictionary.js";
import { applyCommand, detectCommand } from "../text/commands.js";
import { offlinePolish } from "../text/cleanup.js";
import type { PolishInput, PolishProvider } from "../providers/polish/PolishProvider.js";
import type { HistoryStore } from "../history/historyStore.js";

export interface DictationResult {
  raw: string;
  final: string;
  transcriptId?: string;
  action?: VoiceCommand["action"];
}

export interface SttAdapter {
  transcribe(pcm: Float32Array, opts: { modelPath?: string; language: string; prompt?: string }): Promise<string>;
  /** On-disk weights path for local providers — `null` when the provider needs no file (cloud). */
  modelPathFor(modelId: string): string | null;
  /**
   * Readiness gate. Defaults to "a model path exists"; cloud adapters override
   * it to `true` because there are no local weights to check.
   */
  ready?(modelId: string): boolean;
}

export interface DictationSessionDeps {
  config: WhisperFlowConfig;
  stt: SttAdapter | null;
  polish: PolishProvider | null;
  history: HistoryStore | null;
  /** App the text will be typed into, when known. */
  app?: string;
  /**
   * Reference app's AppType classification of the target app — email apps get a
   * signature, messaging apps drop the trailing period, AI apps skip cleanup.
   */
  appType?: "email" | "ai" | "terminal" | "other";
  /** Target app is a chat/messaging client. */
  isMessaging?: boolean;
  /** Absolute path of the saved recording, when audio saving was on for this turn. */
  audioPath?: string;
  /**
   * Meeting mode: each finished utterance is emitted as `appendText` for the
   * host to insert immediately, and the session keeps listening. The final
   * `stop()` result still carries everything said (for history).
   */
  appendMode?: boolean;
  onEvent: (ev: DictationStateEvent) => void;
  logger?: (msg: string) => void;
}

export class DictationSession {
  private state: DictationState = "listening";
  private readonly startedAt = Date.now();
  private raw = "";
  private cancelled = false;
  private finished = false;

  private readonly vad: RmsVad;
  private sttQueue: Promise<void> = Promise.resolve();
  /** Meeting mode: everything already emitted for live insertion. */
  private appendedText = "";

  constructor(private readonly deps: DictationSessionDeps) {
    this.vad = new RmsVad({
      sensitivity: deps.config.audio.vad.sensitivity,
      silenceMs: deps.config.audio.vad.silenceMs,
    });
    this.emit("listening");
  }

  /** Feed PCM at any rate; it is resampled to 16 kHz mono here. */
  feed(pcm: Float32Array, sampleRate = 16000): void {
    if (this.cancelled || this.finished) return;
    const frame = sampleRate === 16000 ? pcm : resample(pcm, sampleRate, 16000);

    const ev = this.vad.feed(frame);
    if (ev) this.enqueueSegment(ev.pcm);
  }

  /** Finalizes: transcribes the tail, corrects, applies commands, polishes. */
  async stop(): Promise<DictationResult> {
    if (this.finished) throw new Error("session already stopped");
    this.finished = true;

    const tail = this.vad.flush();
    if (tail) this.enqueueSegment(tail.pcm);

    // Test affordance: WF_STT_MOCK produces the canned text, but headless runs
    // have no microphone — VAD never fires, so there'd be nothing to transcribe.
    // Synthesize a 1 s segment so the full pipeline is exercised anyway.
    if (process.env["WF_STT_MOCK"]) this.enqueueSegment(new Float32Array(16000));

    this.setState("transcribing");
    await this.sttQueue;

    const { corrected } = fuzzyCorrect(this.raw, this.deps.config.dictionary);
    const raw = this.raw;

    // Meeting mode already inserted every utterance as it landed — nothing
    // more to inject; history just archives what was said.
    if (this.deps.appendMode && this.appendedText) {
      const final = offlinePolish(fuzzyCorrect(this.appendedText, this.deps.config.dictionary).corrected);
      return { raw, final: "", transcriptId: this.recordHistory(raw, final, this.deps.audioPath)?.id };
    }

    // Command handling (whole utterance only).
    const outcome = detectCommand(corrected, this.deps.config.commands);
    let final = corrected;
    let action: DictationResult["action"];
    if (outcome.kind === "matched") {
      const applied = applyCommand(outcome.match);
      final = applied.final;
      action = applied.action;
    }

    // Polish (skipped when a deterministic command already decided the text,
    // when the user turned AI formatting off, or when the transcription format
    // is "raw" — their "No AI formatting").
    const rawFormat = this.deps.config.polish.format === "raw";
    const polish =
      !rawFormat &&
      this.deps.polish &&
      this.deps.config.polish.provider !== "none" &&
      this.deps.config.polish.enabled !== false
        ? this.deps.polish
        : null;
    if (!action && final && polish) {
      this.setState("polishing");
      const input: PolishInput = {
        raw: final,
        tone: this.deps.config.polish.tone,
        modelId: this.deps.config.polish.modelId,
        app: this.deps.app,
        appType: this.deps.appType,
        isMessaging: this.deps.isMessaging,
        emailSignature:
          this.deps.appType === "email" && this.deps.config.polish.emailSignature
            ? this.deps.config.polish.emailSignatureText
            : undefined,
        language: this.deps.config.stt.language,
        dictionary: this.deps.config.dictionary.map((d) => d.term),
        instructions: this.deps.config.polish.customInstructions,
        format: this.deps.config.polish.format,
        cleanup: this.deps.config.polish.cleanup,
      };
      try {
        let text = "";
        for await (const chunk of polish.polish(input)) text += chunk;
        if (text.trim()) final = text.trim();
      } catch (err) {
        this.deps.logger?.(`polish failed, using offline cleanup: ${String(err)}`);
        final = offlinePolish(final);
      }
      // "All lowercase" is a mechanical final pass on whatever came out.
      if (this.deps.config.polish.format === "lowercase") final = final.toLowerCase();
    } else if (!action && final) {
      final = offlinePolish(final);
    }

    let transcriptId: string | undefined;
    if (this.deps.config.general.historyEnabled && this.deps.history) {
      transcriptId = this.recordHistory(raw, final, action === "undo" ? undefined : this.deps.audioPath)?.id;
    }

    return { raw, final, transcriptId, action };
  }

  /** Writes one history entry (raw + final + optional saved-audio path). */
  private recordHistory(rawText: string, finalText: string, audioPath?: string): TranscriptItem | undefined {
    if (!this.deps.config.general.historyEnabled || !this.deps.history) return undefined;
    return this.deps.history.add({
      app: this.deps.app,
      rawText,
      finalText,
      durationMs: Date.now() - this.startedAt,
      sttModel: this.deps.config.stt.provider === "cloud" ? `cloud:${this.deps.config.stt.cloud.model}` : this.deps.config.stt.modelId,
      polishModel:
        this.deps.config.polish.provider === "none" ? undefined : this.deps.config.polish.modelId,
      ...(audioPath ? { audioPath } : {}),
    });
  }

  /** Abandons the session; queued work is dropped, nothing is returned. */
  cancel(): void {
    this.cancelled = true;
    this.finished = true;
    this.vad.reset();
  }

  private enqueueSegment(pcm: Float32Array): void {
    const stt = this.deps.stt;
    if (!stt) return;
    const config = this.deps.config;
    const modelPath = stt.modelPathFor(config.stt.modelId);
    // Cloud adapters have no local weights: they declare readiness themselves.
    const ready = stt.ready ? stt.ready(config.stt.modelId) : modelPath !== null;
    if (!ready) {
      this.deps.logger?.(`stt model ${config.stt.modelId} not on disk — segment skipped`);
      return;
    }
    const prompt = this.raw.slice(-220);
    this.sttQueue = this.sttQueue.then(async () => {
      if (this.cancelled) return;
      const text = await stt.transcribe(pcm, {
        ...(modelPath ? { modelPath } : {}),
        language: config.stt.language,
        prompt,
      });
      if (this.cancelled || !text) return;
      if (this.deps.appendMode) {
        // Insert this utterance now; keep accumulating for the final transcript.
        const clean = offlinePolish(fuzzyCorrect(text, config.dictionary).corrected);
        this.raw = this.raw ? `${this.raw} ${text}` : text;
        this.appendedText = this.appendedText ? `${this.appendedText} ${clean}` : clean;
        this.emit("listening", this.raw, clean);
        return;
      }
      this.raw = this.raw ? `${this.raw} ${text}` : text;
      if (this.state === "listening") this.emit("listening", this.raw);
    }).catch((err) => this.deps.logger?.(`stt segment failed: ${String(err)}`));
  }

  private setState(next: DictationState): void {
    if (this.state === next) return;
    if (!canTransition(this.state, next)) {
      this.deps.logger?.(`illegal transition ${this.state} → ${next} ignored`);
      return;
    }
    this.state = next;
    this.emit(next);
  }

  private emit(state: DictationState, partial?: string, appendText?: string): void {
    this.state = state;
    this.deps.onEvent({ state, partial, ...(appendText ? { appendText } : {}) });
  }
}
