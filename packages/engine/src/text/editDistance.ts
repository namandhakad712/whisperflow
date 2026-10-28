/**
 * Normalized Levenshtein distance — the reference app's `editDistanceToDictated`
 * (migration 20260717): "normalized Levenshtein distance from the last trusted
 * live-region read", i.e. the distance between the dictated text and the
 * anchored dictation region at the last read, **relative to the dictated
 * length** (>1 means the region grew past the dictation).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const fromLeft = cur[j - 1] ?? 0;
      const fromUp = prev[j] ?? 0;
      const fromDiag = prev[j - 1] ?? 0;
      cur.push(Math.min(fromLeft + 1, fromUp + 1, fromDiag + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

export function normalizedEditDistance(dictated: string, region: string): number {
  const n = dictated.trim().length;
  if (n === 0) return 0;
  return levenshtein(dictated.trim(), region.trim()) / n;
}

/**
 * Their verification subset check (module-level upgrade to
 * `verified_before_after`): the focused box must equal what was there before
 * the paste, plus the pasted text, plus what came after.
 */
export function matchesBeforePasteAndAfter(
  box: string,
  pasted: string,
  before: string,
  after: string,
): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  return norm(box) === norm(before + pasted + after);
}

/**
 * Best region to compare against: when the target box is much longer than the
 * dictated text (an email thread, a document), slide a window of the dictated
 * length (+25 % headroom) across the box and score by edit distance. Returns
 * the window with the lowest distance — the analogue of their "anchored
 * dictation region".
 */
export function bestMatchingRegion(dictated: string, box: string): string {
  const d = dictated.trim();
  const b = box.replace(/\s+/g, " ").trim();
  if (b.length <= Math.ceil(d.length * 1.5)) return b;
  const words = b.split(" ");
  const dWords = d.split(" ");
  let best = b.slice(0, d.length);
  let bestDist = Number.POSITIVE_INFINITY;
  for (let start = 0; start + dWords.length <= words.length; start++) {
    const window = words.slice(start, start + dWords.length).join(" ");
    const dist = levenshtein(d, window);
    if (dist < bestDist) {
      bestDist = dist;
      best = window;
    }
  }
  return best;
}
