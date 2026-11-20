/**
 * Mic capture for the overlay renderer: getUserMedia → AudioContext forced to
 * 16 kHz (Chromium resamples) → AudioWorklet → PCM chunks + RMS levels to the
 * main process. Zero native deps; everything runs in the renderer.
 */

const WORKLET_CODE = `
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const copy = new Float32Array(input[0]);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor('wf-pcm', PcmProcessor);
`;

export interface Capture {
  stop(): void;
}

export async function startCapture(opts: {
  deviceId?: string;
  onChunk: (pcm: Float32Array) => void;
  onLevel: (rms: number) => void;
}): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: opts.deviceId && opts.deviceId !== "default" ? { exact: opts.deviceId } : undefined,
      channelCount: 1,
      sampleRate: 16000,
      // Reference app's dictation capture: all browser DSP OFF. STT models are
      // trained on near-raw audio; echo cancellation/noise suppression/AGC
      // color the signal and cost accuracy. (Their meeting-mic path enables
      // AEC, which is a different goal.)
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const ctx = new AudioContext({ sampleRate: 16000, latencyHint: "interactive" });
  const workletUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(workletUrl);

  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "wf-pcm", { numberOfOutputs: 0 });
  // Worklet nodes process when the graph reaches destination; route through a
  // silent gain so nothing is audible but processing continues.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(node);
  source.connect(mute);
  mute.connect(ctx.destination);

  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const chunk = e.data;
    if (!chunk || chunk.length === 0) return;
    opts.onChunk(chunk);
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) {
      const v = chunk[i] ?? 0;
      sum += v * v;
    }
    opts.onLevel(Math.sqrt(sum / chunk.length));
  };

  return {
    stop() {
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
        mute.disconnect();
      } catch {
        /* already torn down */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      URL.revokeObjectURL(workletUrl);
    },
  };
}
