/* Probe the grain bug in REAL Electron: does the feImage-based grain render
 * as a 50% black veil on this Chromium, while the direct-dots version renders
 * as faint dots? Measures both, prints pixel averages. */
import { _electron as electron } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "download", "grain-probe");
mkdirSync(out, { recursive: true });

// The EXACT grain rule from apps/desktop/src/renderer/src/styles.css (body::before)
const GRAIN_OLD = `body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cfilter id='d'%3E%3CfeImage href='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%228%22 height=%228%22%3E%3Crect width=%228%22 height=%228%22 fill=%22%23000%22 fill-opacity=%220%22/%3E%3Crect x=%220%22 y=%220%22 width=%221%22 height=%221%22 fill=%22%23fff%22 fill-opacity=%220.028%22/%3E%3Crect x=%222%22 y=%221%22 width=%221%22 height=%221%22 fill=%22%23fff%22 fill-opacity=%220.028%22/%3E%3C/svg%3E'/%3E%3C/filter%3E%3Crect width='24' height='24' filter='url(%23d)'/%3E%3C/svg%3E");
}`;

// The proposed fix: dots drawn directly, no feImage filter.
const GRAIN_FIX = `body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23000' fill-opacity='0.028'/%3E%3Crect x='2' y='1' width='1' height='1' fill='%23000' fill-opacity='0.028'/%3E%3C/svg%3E");
}`;

const html = (css) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body { height: 100%; }
  body { margin: 0; background-color: #F7F4EE; }
  .card { background: #FFFEFA; width: 200px; height: 100px; margin: 40px; padding: 20px; font-family: sans-serif; }
  ${css}
</style></head><body><div class="card">press room card</div></body></html>`;

writeFileSync(join(out, "case-old.html"), html(GRAIN_OLD));
writeFileSync(join(out, "case-fix.html"), html(GRAIN_FIX));

// tiny electron main that loads the file and reports nothing
const main = `const { app, BrowserWindow } = require("electron");
const path = process.argv[process.argv.length - 1];
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 300, show: true, backgroundColor: "#050505" });
  win.loadFile(path);
});`;
writeFileSync(join(out, "probe-main.cjs"), main);

const cases = {};
for (const name of ["old", "fix"]) {
  const eApp = await electron.launch({
    executablePath: "/home/z/my-project/node_modules/electron/dist/electron",
    args: ["--no-sandbox", join(out, "probe-main.cjs"), join(out, `case-${name}.html`)],
  });
  const win = await eApp.firstWindow();
  await win.waitForTimeout(400);
  await win.screenshot({ path: join(out, `electron-${name}.png`) });
  await eApp.close();
  cases[name] = join(out, `electron-${name}.png`);
}
console.log(JSON.stringify(cases, null, 2));
