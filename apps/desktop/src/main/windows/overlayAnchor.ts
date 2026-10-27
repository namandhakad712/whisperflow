import type { Rectangle } from "electron";

/**
 * Overlay anchor → window bounds.
 *
 * Replicated from the shipped Wispr Flow panel logic (decompiled from
 * `app.asar` → `.webpack/main/index.js`, `createPanelWindow`):
 *   • `floating` parks the panel bottom-right with a 14 px inset — measured from
 *     the display's *work area*, so the taskbar never covers it.
 *   • `top-left` / `top-right` pin to a corner with the same inset.
 *   • every result is clamped inside the work area, and sizes are capped to it.
 *
 * Kept free of Electron runtime imports so it can be unit-tested.
 */
export type OverlayAnchor = "cursor" | "floating" | "top-left" | "top-right" | "top" | "bottom";

/** Inset used by the corner anchors (matches the reference app: 14 px). */
export const ANCHOR_INSET = 14;

export interface WorkAreaLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeOverlayBounds(
  anchor: OverlayAnchor,
  size: { width: number; height: number },
  workArea: WorkAreaLike,
  cursor?: { x: number; y: number },
): Rectangle {
  const inset = ANCHOR_INSET;
  const width = Math.max(1, Math.min(Math.round(size.width), workArea.width));
  const height = Math.max(1, Math.min(Math.round(size.height), workArea.height));

  let x: number;
  let y: number;
  switch (anchor) {
    case "floating":
      x = workArea.x + workArea.width - width - inset;
      y = workArea.y + workArea.height - height - inset;
      break;
    case "top-left":
      x = workArea.x + inset;
      y = workArea.y + inset;
      break;
    case "top-right":
      x = workArea.x + workArea.width - width - inset;
      y = workArea.y + inset;
      break;
    case "top":
      x = workArea.x + (workArea.width - width) / 2;
      y = workArea.y + 24;
      break;
    case "bottom":
      x = workArea.x + (workArea.width - width) / 2;
      y = workArea.y + workArea.height - height - 24;
      break;
    default: {
      // cursor: sit above the pointer, right-aligned with it
      const c = cursor ?? { x: workArea.x + workArea.width / 2, y: workArea.y + workArea.height / 2 };
      x = c.x - width + 60;
      y = c.y - height - 28;
    }
  }

  // Clamp inside the work area — never off-screen, never under the taskbar.
  return {
    x: Math.round(Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width)),
    y: Math.round(Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height)),
    width,
    height,
  };
}
