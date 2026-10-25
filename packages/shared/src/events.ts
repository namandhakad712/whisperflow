/**
 * Dictation state machine types.
 *
 * The canonical lifecycle of one dictation turn:
 *
 * ```
 * idle → listening → transcribing → polishing → injecting → done
 *                                                     ↘ cancelled
 * any active state ↘ error → idle (on next start)
 * ```
 *
 * `polishing` is skipped when the polish provider is `"none"` (offline cleanup
 * fallback), in which case `transcribing` may transition straight to `injecting`
 * or `done`.
 */

/** Every state a dictation session can be in. */
export type DictationState =
  | "idle"
  | "listening"
  | "transcribing"
  | "polishing"
  | "injecting"
  | "done"
  | "cancelled"
  | "error";

/**
 * Legal state transitions. Terminal states (`done`, `cancelled`, `error`)
 * may only return to `idle`, which happens when the session is reset for the
 * next dictation turn.
 */
export const DICTATION_TRANSITIONS: Readonly<
  Record<DictationState, readonly DictationState[]>
> = {
  idle: ["listening", "error"],
  listening: ["transcribing", "cancelled", "error"],
  transcribing: ["polishing", "injecting", "done", "cancelled", "error"],
  polishing: ["injecting", "done", "cancelled", "error"],
  injecting: ["done", "cancelled", "error"],
  done: ["idle"],
  cancelled: ["idle"],
  error: ["idle"],
};

/** The states a session can legally move to from `state`. */
export function nextStates(state: DictationState): readonly DictationState[] {
  return DICTATION_TRANSITIONS[state];
}

/** Returns `true` when `from → to` is a legal transition. */
export function canTransition(from: DictationState, to: DictationState): boolean {
  return DICTATION_TRANSITIONS[from].includes(to);
}

/**
 * Emitted over the `dictation/state` channel whenever the session state (or the
 * partial transcript) changes. `partial` carries the best-effort running
 * transcript while listening/transcribing; `error` carries a human-readable
 * message in the `error` state.
 */
export interface DictationStateEvent {
  state: DictationState;
  /** Best-effort partial transcript for overlay display. */
  partial?: string;
  /** Human-readable error message (present only in the `error` state). */
  error?: string;
}
