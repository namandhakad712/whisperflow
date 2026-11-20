/**
 * End-to-end STT verification — the one thing unit tests can't prove: that the
 * real whisper.cpp sidecar, downloaded and extracted by the production code
 * path, actually transcribes real speech through WhisperCppProvider.
 *
 * Not part of the unit suite (it downloads ~160 MB). Run manually:
 *
 *   pnpm --filter @whisperflow/engine build && node packages/engine/scripts/verify-stt.mjs
 *
 * Exits non-zero when the transcript doesn't contain the expected phrase.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const load = (rel) => import(pathToFileURL(join(here, rel)).href);
const { downloadFile, extractZip } = await load("../dist/models/download.js");
const { WhisperCppProvider } = await load("../dist/providers/stt/WhisperCppProvider.js");

const SIDECAR_URL =
  "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip";
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";
// The canonical whisper.cpp sample — JFK's inauguration line.
const SAMPLE_URL =
  "https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav";
const EXPECTED = "fellow americans";

const root = mkdtempSync(join(tmpdir(), "wf-e2e-"));
const binDir = join(root, "bin");
const modelsDir = join(root, "models");
const modelPath = join(modelsDir, "ggerganov/whisper.cpp", "ggml-base.en.bin");
const samplePath = join(root, "jfk.wav");

const step = (label) => console.log(`▶ ${label}`);
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;

try {
  step("downloading whisper.cpp sidecar (b5454)");
  await downloadFile(SIDECAR_URL, join(binDir, "whisper-bin-x64.zip"), {
    totalBytes: 8_928_640,
    onProgress: (p) => process.stdout.write(`\r   ${mb(p.receivedBytes)}     `),
  });
  console.log();
  await extractZip(join(binDir, "whisper-bin-x64.zip"), join(binDir, "whisper-bin-x64"));

  step("downloading ggml-base.en (148 MB)");
  await downloadFile(MODEL_URL, modelPath, {
    totalBytes: 147_964_211,
    onProgress: (p) => process.stdout.write(`\r   ${mb(p.receivedBytes)}     `),
  });
  console.log();

  step("downloading the jfk.wav speech sample");
  await downloadFile(SAMPLE_URL, samplePath);

  step("decoding 16-bit mono PCM -> Float32 (the overlay's format)");
  const wav = readFileSync(samplePath);
  const dataChunk = wav.indexOf(Buffer.from("data"));
  const dataStart = dataChunk + 8;
  // Trust the bytes actually present, not the header's stated size.
  const samples = Math.floor((wav.length - dataStart) / 2);
  const pcm = new Float32Array(samples);
  for (let i = 0; i < samples; i++) pcm[i] = wav.readInt16LE(dataStart + i * 2) / 32768;
  console.log(`   ${samples} samples = ${(samples / 16000).toFixed(1)}s of audio`);

  step("transcribing through WhisperCppProvider (production path)");
  const provider = new WhisperCppProvider({ binDir });
  if (!provider.findBinary()) throw new Error("sidecar binary not found after extraction");
  const text = await provider.transcribe(pcm, { modelPath, language: "en" });

  console.log("\ntranscript:", JSON.stringify(text));
  const ok = text.toLowerCase().includes(EXPECTED);
  console.log(ok ? "\n✅ E2E STT VERIFIED — real speech → real text via whisper.cpp" : "\n❌ transcript mismatch");
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("\n❌ E2E verification failed:", err);
  process.exit(1);
} finally {
  if (process.env["WF_E2E_KEEP"] !== "1") rmSync(root, { recursive: true, force: true });
}
