/**
 * Generates the two dictation feedback sounds (start / cancel) as small WAVs.
 * Deterministic, no assets to license: a short two-tone chime with a soft
 * attack/decay envelope, 44.1 kHz mono 16-bit. Run once; output lands in
 * resources/sounds/. Do not re-run unless the design changes.
 *
 *   node scripts/gen-sounds.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const OUT = path.join(__dirname, "..", "resources", "sounds");
fs.mkdirSync(OUT, { recursive: true });

const SR = 44100;
const fmt = (samples) => {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
};

/** A soft two-tone chime: freqs in Hz, ms each, gentle attack and decay. */
const chime = (freqs, perToneMs, gain = 0.5) => {
  const n = Math.ceil((SR * perToneMs * freqs.length) / 1000);
  const out = new Float32Array(n + Math.ceil(SR * 0.06)); // decay tail
  const per = Math.floor((SR * perToneMs) / 1000);
  freqs.forEach((f, ti) => {
    for (let i = 0; i < per; i++) {
      const t = i + ti * per;
      // Attack 8ms, sustain, decay into the tail.
      const env = i < SR * 0.008 ? i / (SR * 0.008) : Math.pow(1 - (i - SR * 0.008) / per, 1.6);
      out[t] += gain * env * Math.sin((2 * Math.PI * f * i) / SR);
    }
  });
  return out;
};

const start = chime([523.25, 783.99], 90); // C5 → G5: rising, "go"
const cancel = chime([587.33, 392.0], 85, 0.4); // D5 → G4: falling, "never mind"

fs.writeFileSync(path.join(OUT, "start.wav"), fmt(start));
fs.writeFileSync(path.join(OUT, "cancel.wav"), fmt(cancel));
console.log(`wrote start.wav (${fmt(start).length} B), cancel.wav (${fmt(cancel).length} B) to ${OUT}`);
