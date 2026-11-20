/**
 * Fallback combinator for STT adapters.
 *
 * Dictation must not die because one engine hiccuped — but it also must not
 * silently reroute audio somewhere the user didn't ask for. So the fallback is
 * explicit (`stt.fallback`), and when it fires we log it loudly.
 */
import type { SttAdapter } from "../../orchestrator/DictationSession.js";

/**
 * Wraps `primary` with `backup`: if the primary throws for a segment (quota,
 * network, missing weights), the backup transcribes that same segment.
 * Returns whichever single adapter is available when only one exists.
 */
export function withSttFallback(
  primary: SttAdapter | null,
  backup: SttAdapter | null,
  logger: (msg: string) => void = () => {},
): SttAdapter | null {
  if (!primary) return backup;
  if (!backup) return primary;

  const isReady = (a: SttAdapter, id: string): boolean =>
    a.ready ? a.ready(id) : a.modelPathFor(id) !== null;

  return {
    modelPathFor: (id) => primary.modelPathFor(id) ?? backup.modelPathFor(id),
    // Ready when either side can serve — the session should start, and the
    // per-segment retry handles the rest.
    ready: (id) => isReady(primary, id) || isReady(backup, id),
    transcribe: async (pcm, opts) => {
      try {
        return await primary.transcribe(pcm, opts);
      } catch (err) {
        logger(`stt: primary engine failed (${String(err).slice(0, 100)}) — trying the fallback`);
        return backup.transcribe(pcm, opts);
      }
    },
  };
}
