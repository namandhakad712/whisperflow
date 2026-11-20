import type { OverlayAnchor } from "./overlayAnchor";

/**
 * The resting dash and the dictation pill share ONE position model: the
 * overlay's anchor (`general.overlayPosition`). Nothing is positioned by
 * `dockEdge` anymore — the shared schema migrates that field away (see
 * packages/shared config.ts, `DOCK_EDGE_TO_ANCHOR`).
 */

/**
 * The anchor the resting dash parks at between dictations.
 *
 * `cursor` is per-dictation (the pill pops up where you are typing), so a
 * resting dash has nowhere to follow — it parks at the bottom center until
 * the first dictation, then simply stays where the pill was after each turn
 * (the window morphs in place instead of hiding).
 */
export function resolveRestAnchor(general: { overlayPosition?: OverlayAnchor }): OverlayAnchor {
  const p = general.overlayPosition ?? "cursor";
  return p === "cursor" ? "bottom" : p;
}
