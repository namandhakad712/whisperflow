/**
 * System-audio capture for meeting mode.
 *
 * Electron's desktop capturer exposes the Windows audio loopback as a media
 * stream (the same path OBS uses) — no WASAPI sidecar or native build needed.
 * This hidden page runs the capture and ships 16 kHz mono PCM chunks to the
 * main process, which feeds them to the dictation session exactly like mic
 * chunks. The mic would capture only YOU; the loopback captures everyone on
 * the call, which is what a meeting transcript needs.
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

declare global {
  interface Window {
    // Exposed by the preload for this window only (Electron desktopCapturer).
    desktopCapturer?: {
      getSources(opts: { types: string[]; fetchWindowIcons?: boolean }): Promise<
        Array<{ id: string; name: string }>
      >;
    };
    whisperflow?: { capture?: { sendSystemPcm: (pcm: Float32Array) => void } };
  }
}

export async function startSystemCapture(): Promise<() => void> {
  const sources = await window.desktopCapturer?.getSources({
    types: ["screen"],
    fetchWindowIcons: false,
  });
  const source = sources?.[0];
  if (!source) throw new Error("no desktop capture source available");

  const stream = await navigator.mediaDevices.getUserMedia({
    // Desktop audio in Electron requires chromeMediaSource "desktop"; video
    // must be requested alongside it, and the video track is stopped without
    // ever entering the pipeline.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audio: { mandatory: { chromeMediaSource: "desktop" } } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: source.id } } as any,
  });
  const videoTrack = stream.getVideoTracks()[0];
  videoTrack?.stop();
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) throw new Error("the desktop source gave no audio track");

  const ctx = new AudioContext({ sampleRate: 16000 });
  const workletUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(workletUrl);

  const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
  const node = new AudioWorkletNode(ctx, "wf-pcm", { numberOfOutputs: 0 });
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(node);
  src.connect(mute);
  mute.connect(ctx.destination);

  node.port.onmessage = (e: MessageEvent) => {
    const pcm = e.data as Float32Array;
    if (pcm && pcm.length > 0) window.whisperflow?.capture?.sendSystemPcm?.(pcm);
  };
  console.info("system-audio: capturing desktop audio");

  return () => {
    node.port.onmessage = null;
    try {
      src.disconnect();
      node.disconnect();
      mute.disconnect();
    } catch {
      /* already torn down */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    URL.revokeObjectURL(workletUrl);
  };
}
