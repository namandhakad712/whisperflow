import { describe, expect, it } from "vitest";
import { RmsVad } from "../src/audio/vad/rms-vad.js";

const FRAME = 1024; // 64 ms @ 16 kHz

function speechFrame(amplitude = 0.4): Float32Array {
  const f = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) f[i] = Math.sin((i / FRAME) * Math.PI * 8) * amplitude;
  return f;
}

function silenceFrame(): Float32Array {
  const f = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) f[i] = (Math.random() - 0.5) * 0.002;
  return f;
}

function feedSilence(vad: RmsVad, frames: number) {
  for (let i = 0; i < frames; i++) vad.feed(silenceFrame());
}

describe("RmsVad", () => {
  it("emits a segment after speech followed by enough silence", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300 });
    feedSilence(vad, 10); // calibrate noise floor

    let ev = null;
    for (let i = 0; i < 10 && !ev; i++) ev = vad.feed(speechFrame());
    expect(ev).toBeNull(); // still speaking

    for (let i = 0; i < 10 && !ev; i++) ev = vad.feed(silenceFrame());
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("segment");
    expect(ev!.speechMs).toBeGreaterThanOrEqual(240);
    expect(ev!.pcm.length).toBeGreaterThan(FRAME); // pre-roll + speech + trailing
  });

  it("discards a sub-minimum speech blip", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300 });
    feedSilence(vad, 10);
    vad.feed(speechFrame()); // one 64 ms blip
    let ev = null;
    for (let i = 0; i < 40 && !ev; i++) ev = vad.feed(silenceFrame());
    expect(ev).toBeNull(); // never closed a real segment
  });

  it("flush closes an open segment at stop time", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 700 });
    feedSilence(vad, 10);
    for (let i = 0; i < 8; i++) vad.feed(speechFrame());
    const ev = vad.flush();
    expect(ev).not.toBeNull();
    expect(ev!.speechMs).toBeGreaterThanOrEqual(240);
  });

  it("flush returns null for pure silence", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300 });
    feedSilence(vad, 20);
    expect(vad.flush()).toBeNull();
  });

  it("higher sensitivity lowers the speech threshold", () => {
    const high = new RmsVad({ sensitivity: 0.95, silenceMs: 300 });
    const low = new RmsVad({ sensitivity: 0.1, silenceMs: 300 });
    feedSilence(high, 12);
    feedSilence(low, 12);
    expect(high.speechThreshold).toBeLessThan(low.speechThreshold);
  });
});
