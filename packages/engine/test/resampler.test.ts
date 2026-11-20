import { describe, expect, it } from "vitest";
import { resample } from "../src/audio/resampler.js";
import { pcmToWav } from "../src/audio/wav.js";

describe("resampler", () => {
  it("passes through when rates match", () => {
    const input = new Float32Array([0, 0.5, -0.5, 1]);
    expect(resample(input, 16000, 16000)).toBe(input);
  });

  it("halves the length going 32k → 16k", () => {
    const input = new Float32Array(3200).map((_, i) => Math.sin(i / 50));
    const out = resample(input, 32000, 16000);
    expect(out.length).toBe(1600);
  });

  it("interpolates correctly on a ramp", () => {
    // Downsampling 2:1 samples at even indices: [0, 0.5, 0.5, 1] → [0, 0.5]
    const input = new Float32Array([0, 0.5, 0.5, 1]);
    const out = resample(input, 2, 1);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0.5, 5);
  });

  it("handles empty input", () => {
    expect(resample(new Float32Array(0), 48000, 16000).length).toBe(0);
  });
});

describe("pcmToWav", () => {
  it("writes a valid 16 kHz mono 16-bit PCM header", () => {
    const buf = pcmToWav(new Float32Array([0, 0.5, -0.5]), 16000);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buf.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(buf.readUInt32LE(24)).toBe(16000); // sample rate
    expect(buf.readUInt16LE(22)).toBe(1); // mono
    expect(buf.readUInt16LE(34)).toBe(16); // bits
    expect(buf.length).toBe(44 + 6);
    expect(buf.readInt16LE(44 + 2)).toBe(Math.round(0.5 * 32767)); // sample 1
  });
});
