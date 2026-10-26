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
  /** On-disk ggml weights file — required here (cloud adapters pass none). */
  modelPath?: string;
  language: string;
  prompt?: string;
}

// Preference order matters: whisper.cpp releases ship BOTH the new
// `whisper-cli.exe` and the legacy `main.exe` in the same folder, and the
// legacy binary ignores `-oj` (JSON output) — silently yielding "" transcripts.
// Directory iteration order is not guaranteed, so rank matches explicitly.
const EXE_PREFERENCE = ["whisper-cli.exe", "whisper.exe", "main.exe", "whisper-cli", "main"];
const EXE_CANDIDATES = new Set(EXE_PREFERENCE);
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
    const found: string[] = [];
    try {
      const walk = (dir: string, depth: number): void => {
        if (found.length >= EXE_PREFERENCE.length || depth > 3) return;
        for (const ent of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, ent.name);
          if (ent.isDirectory()) walk(full, depth + 1);
          else if (EXE_CANDIDATES.has(ent.name.toLowerCase())) found.push(full);
        }
      };
      walk(this.opts.binDir, 0);
    } catch {
      /* not extracted yet */
    }
    // Rank by preference: whisper-cli.exe first, legacy main.exe last.
    const rank = (p: string) => EXE_PREFERENCE.indexOf(p.split(/[\\/]/).pop()!.toLowerCase());
    const ranked = found.sort((a, b) => rank(a) - rank(b));
    this.binaryPath = ranked[0] ?? null;
    return this.binaryPath;
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
    if (!opts.modelPath) {
      throw new Error("no whisper model selected — download one in Settings → Models");
    }

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
