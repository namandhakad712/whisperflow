/* Enumerate the REAL window stack while the app runs: which windows
 * exist, their bounds, and alwaysOnTop state. The smoke's dark capture
 * may be a transparent overlay-sized window painting over the console. */
import { _electron as electron } from "playwright";

const app = await electron.launch({
  executablePath: "/home/z/my-project/node_modules/electron/dist/electron",
  args: ["--no-sandbox", "/home/z/my-project/apps/desktop/out/main/index.js"],
  env: { ...process.env, WF_SMOKE: "1", DISPLAY: process.env.DISPLAY },
});
await new Promise((r) => setTimeout(r, 4000));

// Electron API: evaluate in main process
const stack = await app.evaluate(async ({ BrowserWindow, screen }) => {
  const out = [];
  for (const w of BrowserWindow.getAllWindows()) {
    const b = w.getBounds();
    out.push({
      title: w.getTitle(),
      x: b.x, y: b.y, w: b.width, h: b.height,
      visible: w.isVisible(),
      aot: w.isAlwaysOnTop(),
      fullscreen: w.isFullScreen(),
      bg: w.getBackgroundColor?.() ?? null,
    });
  }
  const d = screen.getPrimaryDisplay();
  return { windows: out, display: { w: d.size.width, h: d.size.height } };
});
console.log(JSON.stringify(stack, null, 2));
await app.close();
