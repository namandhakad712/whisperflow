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
  transcribe(pcm: Float32Array, opts: { modelPath: string; language: string; prompt?: string }): Promise<string>;
  modelPathFor(modelId: string): string | null;
}

export interface DictationSessionDeps {
  config: WhisperFlowConfig;
  stt: SttAdapter | null;
  polish: PolishProvider | null;
  history: HistoryStore | null;
  /** App the text will be typed into, when known. */
  app?: string;
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

    this.setState("transcribing");
    await this.sttQueue;

    const { corrected } = fuzzyCorrect(this.raw, this.deps.config.dictionary);
    const raw = this.raw;

    // Command handling (whole utterance only).
    const outcome = detectCommand(corrected, this.deps.config.commands);
    let final = corrected;
    let action: DictationResult["action"];
    if (outcome.kind === "matched") {
      const applied = applyCommand(outcome.match);
      final = applied.final;
      action = applied.action;
    }

    // Polish (skipped when a deterministic command already decided the text).
    if (!action && final && this.deps.polish && this.deps.config.polish.provider !== "none") {
      this.setState("polishing");
      const input: PolishInput = {
        raw: final,
        tone: this.deps.config.polish.tone,
        modelId: this.deps.config.polish.modelId,
        app: this.deps.app,
        language: this.deps.config.stt.language,
        dictionary: this.deps.config.dictionary.map((d) => d.term),
        instructions: this.deps.config.polish.customInstructions,
      };
      try {
        let text = "";
        for await (const chunk of this.deps.polish.polish(input)) text += chunk;
        if (text.trim()) final = text.trim();
      } catch (err) {
        this.deps.logger?.(`polish failed, using offline cleanup: ${String(err)}`);
        final = offlinePolish(final);
      }
    } else if (!action && final) {
      final = offlinePolish(final);
    }

    let transcriptId: string | undefined;
    if (this.deps.config.general.historyEnabled && this.deps.history) {
      const item: TranscriptItem = this.deps.history.add({
        app: this.deps.app,
        rawText: raw,
        finalText: final,
        durationMs: Date.now() - this.startedAt,
        sttModel: this.deps.config.stt.modelId,
        polishModel:
          this.deps.config.polish.provider === "none" ? undefined : this.deps.config.polish.modelId,
      });
      transcriptId = item.id;
    }

    return { raw, final, transcriptId, action };
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
    if (!modelPath) {
      this.deps.logger?.(`stt model ${config.stt.modelId} not on disk — segment skipped`);
      return;
    }
    const prompt = this.raw.slice(-220);
    this.sttQueue = this.sttQueue.then(async () => {
      if (this.cancelled) return;
      const text = await stt.transcribe(pcm, { modelPath, language: config.stt.language, prompt });
      if (this.cancelled || !text) return;
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

  private emit(state: DictationState, partial?: string): void {
    this.state = state;
    this.deps.onEvent({ state, partial });
  }
}
