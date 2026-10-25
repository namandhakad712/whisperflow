/**
 * Linear-interpolation resampler for mono float PCM. The renderer captures at
 * the hardware rate (usually 48 kHz); whisper.cpp wants 16 kHz.
 */
export function resample(input: Float32Array, fromRate: number, toRate = 16000): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0]! + (input[i1]! - input[i0]!) * frac;
  }
  return out;
}
