/**
 * Energy-based VAD with adaptive noise floor and silence endpointing.
 *
 * Feed() takes small frames (e.g. 1024 samples @ 16 kHz ≈ 64 ms) and returns
 * a completed speech segment when `silenceMs` of trailing silence follows at
 * least `minSpeechMs` of speech. A short pre-roll ring is kept so speech that
 * begins mid-silence is not clipped at the front.
 *
 * Pure TS, zero dependencies — always available. Silero ONNX is the optional
 * upgrade path (see silero-vad.ts).
 */
export interface RmsVadOptions {
  /** 0–1; higher detects quieter speech. */
  sensitivity: number;
  /** Trailing silence (ms) that closes a segment. */
  silenceMs: number;
  /** Minimum speech (ms) before a segment can close. */
  minSpeechMs?: number;
}

export interface VadSegmentEvent {
  type: "segment";
  /** Complete speech segment (pre-roll + speech + trailing silence), 16 kHz. */
  pcm: Float32Array;
  /** Measured duration of speech (ms), excluding pre-roll/trailing silence. */
  speechMs: number;
}

export type VadEvent = VadSegmentEvent;

const PRE_ROLL_MS = 220;
const FRAME_MS = 64; // nominal frame length for bookkeeping

export class RmsVad {
  private readonly silenceMs: number;
  private readonly minSpeechMs: number;
  /** Multiplied by the running noise floor to decide "speech". */
  private readonly speechFactor: number;

  private noiseFloor = 0.005;
  private speechActive = false;
  private silenceMsAccumulated = 0;
  private speechMsAccumulated = 0;
  private preRoll: Float32Array[] = [];
  private preRollSamples = 0;
  private segment: Float32Array[] = [];
  private segmentSamples = 0;
  private calibrationFrames = 0;

  constructor(opts: RmsVadOptions) {
    this.silenceMs = opts.silenceMs;
    this.minSpeechMs = opts.minSpeechMs ?? 240;
    // sensitivity 1.0 → 3× floor, sensitivity 0.0 → 12× floor.
    this.speechFactor = 3 + (1 - clamp01(opts.sensitivity)) * 9;
  }

  /** Current adaptive threshold (exposed for diagnostics/tests). */
  get speechThreshold(): number {
    return this.noiseFloor * this.speechFactor;
  }

  feed(frame: Float32Array): VadEvent | null {
    const rms = computeRms(frame);

    // Track the quiet-side envelope as the noise floor (fast attack, slow decay).
    if (rms < this.noiseFloor || this.calibrationFrames < 8) {
      this.noiseFloor = Math.max(0.0008, this.noiseFloor * 0.7 + rms * 0.3);
    } else {
      this.noiseFloor = Math.max(0.0008, this.noiseFloor * 0.995);
    }
    this.calibrationFrames++;

    const isSpeech = rms >= this.speechThreshold;

    if (isSpeech) {
      if (!this.speechActive) {
        // Open a segment, seeded with the pre-roll ring.
        this.speechActive = true;
        this.silenceMsAccumulated = 0;
        this.speechMsAccumulated = 0;
        this.segment = [...this.preRoll];
        this.segmentSamples = this.preRollSamples;
      }
      this.speechMsAccumulated += frameMs(frame);
      this.silenceMsAccumulated = 0;
      this.pushFrame(frame, "segment");
      this.pushFrame(frame, "preRoll");
      return null;
    }

    // Silence path.
    this.pushFrame(frame, "preRoll");
    if (!this.speechActive) return null;

    this.pushFrame(frame, "segment");
    this.silenceMsAccumulated += frameMs(frame);
    if (this.silenceMsAccumulated >= this.silenceMs && this.speechMsAccumulated >= this.minSpeechMs) {
      return this.closeSegment();
    }
    if (this.silenceMsAccumulated >= this.silenceMs * 4) {
      // Long silence without enough speech: discard the pending segment.
      this.resetSegment();
    }
    return null;
  }

  /** Closes any open segment (used when the user stops the dictation). */
  flush(): VadEvent | null {
    if (this.speechActive && this.speechMsAccumulated >= this.minSpeechMs) {
      return this.closeSegment();
    }
    this.resetSegment();
    return null;
  }

  reset(): void {
    this.resetSegment();
    this.preRoll = [];
    this.preRollSamples = 0;
  }

  private closeSegment(): VadSegmentEvent {
    const pcm = concatFrames(this.segment, this.segmentSamples);
    const speechMs = this.speechMsAccumulated;
    this.resetSegment();
    return { type: "segment", pcm, speechMs };
  }

  private resetSegment(): void {
    this.speechActive = false;
    this.silenceMsAccumulated = 0;
    this.speechMsAccumulated = 0;
    this.segment = [];
    this.segmentSamples = 0;
  }

  private pushFrame(frame: Float32Array, which: "segment" | "preRoll"): void {
    if (which === "segment") {
      this.segment.push(frame);
      this.segmentSamples += frame.length;
      return;
    }
    this.preRoll.push(frame);
    this.preRollSamples += frame.length;
    const maxSamples = Math.ceil((PRE_ROLL_MS / 1000) * 16000);
    while (this.preRollSamples > maxSamples && this.preRoll.length > 1) {
      const dropped = this.preRoll.shift();
      this.preRollSamples -= dropped?.length ?? 0;
    }
  }
}

function computeRms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i]! * frame[i]!;
  return Math.sqrt(sum / Math.max(1, frame.length));
}

function frameMs(frame: Float32Array): number {
  return (frame.length / 16000) * 1000;
}

function concatFrames(frames: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total);
  let offset = 0;
  for (const f of frames) {
    out.set(f, offset);
    offset += f.length;
  }
  return out;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
