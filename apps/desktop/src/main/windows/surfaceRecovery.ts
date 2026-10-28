/**
 * Unresponsive-window recovery — the port of the reference app's StatusSurface
 * ladder (report 02): when a surface's renderer goes unresponsive, escalate
 * through three repairs with exponential backoff, and never restart a fix
 * while a dictation is mid-flight.
 *
 *   attempt 1: `webContents.invalidate()` + a content-bounds pulse
 *              (setContentBounds(h+1) — the compositor nudge, 150 ms)
 *   attempt 2: hide + show
 *   attempt 3: full window rebuild
 *   then back off `min(10 min * 2^(n-1), 60 min)` — 10/20/40/60/60…
 *
 * Recovery is *deferred* while the dictation status is one of
 * {initializing, listening, stopping, processing, retrying} — their inner loop
 * re-checks every 3 s.
 */
export type RecoveryStep = "invalidate" | "hideShow" | "rebuild";

/** Their backoff: `Math.min(6e5 * 2**(n-1), 36e5)` ms, n = attempt number. */
export function recoveryBackoffMs(attempt: number): number {
  return Math.min(10 * 60_000 * 2 ** Math.max(0, attempt - 1), 60 * 60_000);
}

/**
 * Which repair to run for the nth attempt. Their ladder is three steps; every
 * attempt past the third repeats the rebuild (with the backoff above).
 */
export function recoveryStep(attempt: number): RecoveryStep {
  if (attempt <= 1) return "invalidate";
  if (attempt === 2) return "hideShow";
  return "rebuild";
}

/** Dictation statuses that defer recovery (their set, verbatim). */
export const DEFERRED_STATUSES = new Set([
  "initializing",
  "listening",
  "stopping",
  "processing",
  "retrying",
]);

/** Their compositor content-bounds pulse amount and interval. */
export const PULSE_PX = 1;
export const PULSE_MS = 150;
/** Their between-check sleep while recovery is deferred. */
export const DEFER_POLL_MS = 3_000;

export interface RecoverableSurface {
  /** True while the window is alive and not destroyed. */
  isAlive(): boolean;
  invalidate(): void;
  /** Their content-bounds pulse; return the bounds used. */
  pulse(): { width: number; height: number } | null;
  hideShow(): void;
  /** Full rebuild — the caller's last resort (recreate the BrowserWindow). */
  rebuild(): void;
  log?(msg: string): void;
}

/**
 * Drives the ladder for one surface. `isBusy` is polled so a mid-flight
 * dictation never gets its surface restarted under it.
 */
export class SurfaceRecovery {
  private attempt = 0;
  private recovering = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly surface: RecoverableSurface,
    private readonly isBusy: () => boolean,
    /** Deferral poll interval — their 3 s; injectable for tests. */
    private readonly deferPollMs: number = DEFER_POLL_MS,
  ) {}

  /** Called on `unresponsive` (or any equivalent health signal). */
  trigger(): void {
    if (this.recovering) return; // already on it
    this.recovering = true;
    this.attempt += 1;
    this.surface.log?.(`[SurfaceRecovery] unresponsive — attempt ${this.attempt} (${recoveryStep(this.attempt)})`);
    void this.run();
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.recovering = false;
  }

  private async run(): Promise<void> {
    // Their deferral: wait while a dictation is mid-flight, re-checking on
    // their 3 s loop.
    while (this.isBusy()) {
      await new Promise<void>((r) => {
        this.timer = setTimeout(r, this.deferPollMs);
      });
      if (!this.surface.isAlive()) {
        this.cancel();
        return;
      }
    }
    if (!this.surface.isAlive()) {
      this.cancel();
      return;
    }
    const step = recoveryStep(this.attempt);
    try {
      if (step === "invalidate") {
        this.surface.invalidate();
        this.surface.pulse();
      } else if (step === "hideShow") {
        this.surface.hideShow();
      } else {
        this.surface.rebuild();
      }
    } catch (err) {
      this.surface.log?.(`[SurfaceRecovery] ${step} failed: ${String(err).slice(0, 120)}`);
    }
    // Schedule the next probe at the backoff interval; their log: "still
    // unresponsive after all recovery attempts" only past the full ladder.
    const wait = recoveryBackoffMs(this.attempt);
    this.timer = setTimeout(() => {
      this.recovering = false;
      if (this.surface.isAlive()) {
        this.surface.log?.(
          `[SurfaceRecovery] still unresponsive after ${this.attempt} attempt(s) — escalating`,
        );
        this.trigger();
      }
    }, wait);
  }
}
