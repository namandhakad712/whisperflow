import { describe, expect, it } from "vitest";
import { ANCHOR_INSET, computeOverlayBounds } from "../src/main/windows/overlayAnchor";

/**
 * Overlay anchoring, replicated from the shipped Wispr Flow panel logic:
 * work-area relative, 14 px corner inset, always clamped inside the work area
 * (so the taskbar never covers it) and never larger than the display.
 */
const workArea = { x: 0, y: 0, width: 1920, height: 1040 }; // 1080 tall minus a 40 px taskbar
const size = { width: 520, height: 148 };

describe("overlay anchoring", () => {
  it("floats bottom-right inside the work area inset", () => {
    const b = computeOverlayBounds("floating", size, workArea);
    expect(b.x).toBe(1920 - size.width - ANCHOR_INSET);
    expect(b.y).toBe(1040 - size.height - ANCHOR_INSET);
    expect(b.width).toBe(size.width);
    expect(b.height).toBe(size.height);
  });

  it("pins top-left and top-right with the same inset", () => {
    expect(computeOverlayBounds("top-left", size, workArea)).toMatchObject({ x: 14, y: 14 });
    expect(computeOverlayBounds("top-right", size, workArea)).toMatchObject({
      x: 1920 - size.width - 14,
      y: 14,
    });
  });

  it("centers on the top and bottom edges", () => {
    const top = computeOverlayBounds("top", size, workArea);
    expect(top.x).toBe(Math.round((1920 - size.width) / 2));
    expect(top.y).toBe(24);
    const bottom = computeOverlayBounds("bottom", size, workArea);
    expect(bottom.y).toBe(1040 - size.height - 24);
  });

  it("sits above and near the cursor", () => {
    const b = computeOverlayBounds("cursor", size, workArea, { x: 900, y: 700 });
    expect(b.y).toBe(700 - size.height - 28);
    expect(b.x).toBe(900 - size.width + 60);
  });

  it("clamps every anchor inside the work area", () => {
    // cursor at the very top-left would place the pill off-screen
    const b = computeOverlayBounds("cursor", size, workArea, { x: 1, y: 1 });
    expect(b.x).toBeGreaterThanOrEqual(workArea.x);
    expect(b.y).toBeGreaterThanOrEqual(workArea.y);
    // and at the bottom-right it must not spill past the edge
    const c = computeOverlayBounds("cursor", size, workArea, { x: 1919, y: 1039 });
    expect(c.x + c.width).toBeLessThanOrEqual(workArea.x + workArea.width);
    expect(c.y + c.height).toBeLessThanOrEqual(workArea.y + workArea.height);
  });

  it("never exceeds the display, even on a tiny work area", () => {
    const tiny = { x: 0, y: 0, width: 400, height: 300 };
    const b = computeOverlayBounds("floating", { width: 900, height: 700 }, tiny);
    expect(b.width).toBe(400);
    expect(b.height).toBe(300);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });

  it("respects a secondary display with a non-zero origin", () => {
    const right = { x: 1920, y: 0, width: 1280, height: 1040 };
    const b = computeOverlayBounds("floating", size, right);
    expect(b.x).toBe(1920 + 1280 - size.width - ANCHOR_INSET);
  });
});
