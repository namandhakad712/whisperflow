/* A/B test the grain layer inside the real app:
 * A. grain layer untouched (baseline — expected dark)
 * B. body::before display:none injected (grain off) — if the window turns
 *    bright, the SVG data-URI background-image is painting BLACK.
 * Then C. inject the pure-CSS radial-gradient dot grain candidate and
 * measure it too. */
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
await win.waitForTimeout(1800);

async function lumShot(label) {
  const buf = await win.screenshot();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(out, `ab-${label}.png`), buf);
  // measure in-page via a 1x1 canvas sampling is unreliable; use PIL after.
  console.log("📸", label);
}

await lumShot("a-baseline");

// B: kill the grain layer entirely
await win.addStyleTag({ content: "body::before { display: none !important; }" });
await new Promise((r) => setTimeout(r, 400));
await lumShot("b-grain-off");

// C: pure-CSS dot grain (no SVG anywhere)
await win.addStyleTag({
  content: `body::before { display: block !important;
    background-image: none !important;
    background: radial-gradient(circle at 1px 1px, rgba(0,0,0,0.055) 1px, transparent 1.6px) !important;
    background-size: 8px 8px !important; opacity: 0.5 !important; }`,
});
await new Promise((r) => setTimeout(r, 400));
await lumShot("c-css-grain");

await app.close();
console.log("done");
