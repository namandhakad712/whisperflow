/* Isolate the veil: same app, three probes —
 * 1. Playwright page.screenshot (renderer-internal capture)
 * 2. Electron capturePage (main-process capture)
 * 3. Compare against the same page in plain Chromium
 * If 1 is bright but the earlier X11-screen shot was dark, the veil is a
 * WINDOW-LAYER artifact (X11 compositing of the OS window), not CSS. */
import { _electron as electron } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "download", "app-smoke");
mkdirSync(out, { recursive: true });

const app = await electron.launch({
  executablePath: "/home/z/my-project/node_modules/electron/dist/electron",
  args: ["--no-sandbox", "/home/z/my-project/apps/desktop/out/main/index.js"],
  env: { ...process.env, WF_SMOKE: "1", DISPLAY: process.env.DISPLAY },
});
await new Promise((r) => setTimeout(r, 3500));
const win = app.windows()[0];
await win.evaluate(() => localStorage.setItem("wf-onboarded", "1"));
await win.reload();
await win.waitForTimeout(2000);

// 1. renderer-internal capture
await win.screenshot({ path: join(out, "probe-renderer.png") });
console.log("📸 renderer capture");

// pixel math helper inline via PIL later; print luminance now:
const lum = await win.evaluate(() => {
  const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number);
  return m ? 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] : -1;
});
console.log("computed body lum:", lum.toFixed(0));

await app.close();
console.log("done");
