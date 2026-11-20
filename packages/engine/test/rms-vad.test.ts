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

  it("auto-ends after real speech followed by the silence budget", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300, autoStopMs: 600 });
    feedSilence(vad, 12); // calibrate
    for (let i = 0; i < 10; i++) vad.feed(speechFrame()); // ~640 ms of speech
    // The trailing silence first closes the segment (normal endpointing)…
    let segmentClosed = false;
    let ev: { type: string } | null = null;
    for (let i = 0; i < 60 && !ev; i++) {
      ev = vad.feed(silenceFrame());
      if (ev?.type === "segment") {
        segmentClosed = true;
        ev = null; // keep feeding — the autoend comes after more silence
      }
    }
    expect(segmentClosed).toBe(true);
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("autoend");
    expect(vad.ended).toBe(true);
    // One-shot: further frames never fire again.
    for (let i = 0; i < 20; i++) expect(vad.feed(silenceFrame())).toBeNull();
  });

  it("a paused start never auto-ends (no real speech yet)", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300, autoStopMs: 400 });
    feedSilence(vad, 12);
    for (let i = 0; i < 30; i++) expect(vad.feed(silenceFrame())).toBeNull();
    expect(vad.ended).toBe(false);
  });

  it("autoStopMs 0 disables auto-end entirely", () => {
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300 });
    feedSilence(vad, 12);
    for (let i = 0; i < 10; i++) vad.feed(speechFrame());
    // Endpointing still works (a segment closes)…
    let closedSegment = false;
    for (let i = 0; i < 40 && !closedSegment; i++) {
      if (vad.feed(silenceFrame())?.type === "segment") closedSegment = true;
    }
    expect(closedSegment).toBe(true);
    // …but no turn-level auto-end ever fires.
    for (let i = 0; i < 40; i++) expect(vad.feed(silenceFrame())?.type !== "autoend").toBe(true);
    expect(vad.ended).toBe(false);
  });

  it("fires onSpeechStart when a segment opens and exposes the live audio", () => {
    let opens = 0;
    const vad = new RmsVad({ sensitivity: 0.5, silenceMs: 300, onSpeechStart: () => opens++ });
    feedSilence(vad, 12);
    expect(vad.speaking).toBe(false);
    expect(vad.peekSegment()).toBeNull();
    for (let i = 0; i < 6; i++) vad.feed(speechFrame());
    expect(opens).toBe(1);
    expect(vad.speaking).toBe(true);
    // The visible-so-far audio includes the pre-roll + the speech frames.
    const live = vad.peekSegment();
    expect(live).not.toBeNull();
    expect(live!.length).toBeGreaterThan(FRAME);
    // More speech keeps the same segment open (no second open event).
    for (let i = 0; i < 4; i++) vad.feed(speechFrame());
    expect(opens).toBe(1);
  });
});
