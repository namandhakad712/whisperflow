/**
 * Minimal WAV writer: 16-bit PCM mono at the given sample rate. whisper.cpp
 * binaries read plain WAV files; we hand them one per segment.
 */
export function pcmToWav(pcm: Float32Array, sampleRate = 16000): Buffer {
  const bytesPerSample = 2;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, pcm[i]!));
    buffer.writeInt16LE(Math.round(clamped * 32767), offset);
  }
  return buffer;
}
