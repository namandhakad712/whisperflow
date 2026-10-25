/**
 * Local STT via the whisper.cpp sidecar binary. One process per segment,
 * serialized; prior transcript is passed as prompt context so names and
 * topic carry across segments of one dictation.
 */
import { spawn } from "node:child_process";
import { readdirSync, statSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pcmToWav } from "../../audio/wav.js";

export interface TranscribeOpts {
  /** Catalog model id — resolved to a ggml file by the caller. */
  modelPath: string;
  language: string;
  prompt?: string;
}

const EXE_CANDIDATES = ["whisper-cli.exe", "main.exe", "whisper.exe", "whisper-cli", "main"];
const TIMEOUT_MS = 60_000;

export class WhisperCppProvider {
  private queue: Promise<unknown> = Promise.resolve();
  private binaryPath: string | null | undefined; // undefined = not searched yet

  constructor(
    private readonly opts: {
      binDir: string;
    },
  ) {}

  /** Resolves the sidecar executable inside the extracted release dir. */
  findBinary(): string | null {
    if (this.binaryPath !== undefined) return this.binaryPath;
    let found: string | null = null;
    try {
      const walk = (dir: string, depth: number): void => {
        if (found || depth > 3) return;
        for (const ent of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, ent.name);
          if (ent.isDirectory()) walk(full, depth + 1);
          else if (EXE_CANDIDATES.includes(ent.name.toLowerCase())) {
            found = full;
            return;
          }
        }
      };
      walk(this.opts.binDir, 0);
    } catch {
      found = null;
    }
    this.binaryPath = found;
    return found;
  }

  isReady(modelPath: string): boolean {
    const bin = this.findBinary();
    if (!bin) return false;
    try {
      return statSync(modelPath).isFile() && statSync(modelPath).size > 0;
    } catch {
      return false;
    }
  }

  /** Serially transcribes one PCM segment. Empty string on no speech. */
  async transcribe(pcm: Float32Array, opts: TranscribeOpts): Promise<string> {
    const run = this.queue.then(() => this.transcribeNow(pcm, opts));
    this.queue = run.catch(() => undefined); // keep the chain alive on failures
    return run;
  }

  private async transcribeNow(pcm: Float32Array, opts: TranscribeOpts): Promise<string> {
    const bin = this.findBinary();
    if (!bin) throw new Error("whisper.cpp binary not found — download it in Settings → Models");

    const dir = mkdtempSync(join(tmpdir(), "whisperflow-stt-"));
    try {
      const wavPath = join(dir, "chunk.wav");
      const outPrefix = join(dir, "out");
      writeFileSync(wavPath, pcmToWav(pcm, 16000));

      const args = ["-m", opts.modelPath, "-f", wavPath, "-oj", "-otxt", "-of", outPrefix];
      if (opts.language && opts.language !== "auto") args.push("-l", opts.language);
      if (opts.prompt) args.push("--prompt", opts.prompt);

      await this.runBinary(bin, args);
      return this.readResult(outPrefix);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  private runBinary(bin: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { windowsHide: true, cwd: join(bin, "..") });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("whisper.cpp timed out"));
      }, TIMEOUT_MS);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        // Non-zero can still mean usable output; only hard failures reject.
        if (code !== null && code !== 0 && code !== 1) reject(new Error(`whisper.cpp exited ${code}`));
        else resolve();
      });
    });
  }

  private readResult(outPrefix: string): string {
    try {
      const parsed = JSON.parse(readFileSync(outPrefix + ".json", "utf-8")) as {
        transcription?: Array<{ text?: string }>;
      };
      const text = (parsed.transcription ?? [])
        .map((seg) => (seg.text ?? "").trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) return text;
    } catch {
      /* fall through to txt */
    }
    try {
      return readFileSync(outPrefix + ".txt", "utf-8").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }
}
