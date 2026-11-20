/**
 * Optional Silero VAD (ONNX) upgrade over the RMS baseline. Loaded lazily:
 * if onnxruntime-node or the model file is unavailable, callers fall back to
 * RmsVad. Kept deliberately thin — segmentation logic stays in RmsVad.
 */
export async function isSileroAvailable(modelPath: string): Promise<boolean> {
  try {
    const ort = await import("onnxruntime-node");
    void ort; // import itself proves the runtime is installed
    const { access } = await import("node:fs/promises");
    await access(modelPath);
    return true;
  } catch {
    return false;
  }
}

export interface SileroSession {
  /** Probability [0..1] that the frame contains speech (frames of 512 samples @ 16 kHz). */
  speechProbability(frame: Float32Array): Promise<number>;
  reset(): void;
}

export async function createSileroSession(modelPath: string): Promise<SileroSession> {
  const ort = await import("onnxruntime-node");
  const session = await ort.InferenceSession.create(modelPath);
  const state = new BigInt64Array(2 * 64); // h/c combined state
  let sr = BigInt(16000);

  return {
    async speechProbability(frame: Float32Array): Promise<number> {
      const feeds = {
        input: new ort.Tensor("float32", frame, [1, frame.length]),
        state: new ort.Tensor("int64", state, [2, 1, 64]),
        sr: new ort.Tensor("int64", BigInt64Array.from([sr]), []),
      };
      const out = await session.run(feeds);
      const prob = out["output"]?.data as Float32Array | undefined;
      const newState = out["stateN"]?.data as BigInt64Array | undefined;
      if (newState) state.set(newState);
      return prob?.[0] ?? 0;
    },
    reset(): void {
      state.fill(0n);
      sr = BigInt(16000);
    },
  };
}
