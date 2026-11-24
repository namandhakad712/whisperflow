/* Layer bisection: toggle each candidate full-window layer IN the real
 * app, screenshot, and measure. Layers under test:
 *   aurora (AuroraField fixed canvas), theme-swap filter, the wf-stage,
 *   the overlay-body tint, body background itself, and html background. */
import { _electron as electron } from "playwright";
import { writeFile } from "node:fs/promises";
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
await new Promise((r) => setTimeout(r, 1800));

const cases = [
  ["baseline", null],
  ["no-aurora", `canvas.pk-aurora { display: none !important; }`],
  ["no-stages", `.wf-theme-swap, [class*="wf-stage"] { filter: none !important; animation: none !important; opacity: 1 !important; }`],
  ["no-body-before", `body::before { display: none !important; }`],
  ["no-html-bg", `html { background: #fff !important; }`],
  ["body-opaque", `body { background-color: #F7F4EE !important; }`],
];

for (const [label, css] of cases) {
  if (css) await win.addStyleTag({ content: css });
  await new Promise((r) => setTimeout(r, 350));
  const buf = await win.screenshot();
  await writeFile(join(out, `bisect-${label}.png`), buf);
  console.log("📸", label);
  if (css) {
    // remove: reload for clean slate between cases
    await win.reload();
    await new Promise((r) => setTimeout(r, 1200));
  }
}
await app.close();
console.log("done");
