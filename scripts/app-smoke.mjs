/* BREAKTHROUGH QA v2: launch the REAL built Electron app under Xvfb with
 * SEEDED history (real history.json in userData) so the DayStrip has data,
 * then exercise: home, history (+timeline), rail collapse (real click on
 * the toggle), palette. Screenshots + luminance checks. */
import { _electron as electron } from "playwright";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "download", "app-smoke");
mkdirSync(shots, { recursive: true });

const EXE = "/home/z/my-project/node_modules/electron/dist/electron";
const DIST = "/home/z/my-project/apps/desktop/out/main/index.js";

async function waitWindow(app, predicate, label, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const w of app.windows()) {
      try {
        if (await predicate(w)) return w;
      } catch {
        /* not this one */
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`window not found: ${label}`);
}

// Find the userData dir Electron will use (app name from package.json).
// The app sets a custom userData? Check main/index.ts line 21 comment says
// it pins %APPDATA%/WhisperFlow — default userData for the app name.
const appName = JSON.parse(readFileSync("/home/z/my-project/apps/desktop/package.json", "utf8")).name;
const HOME = process.env.HOME ?? "/home/z";
const userData = join(HOME, ".config", appName || "whisperflow");
mkdirSync(userData, { recursive: true });
console.log("userData:", userData);

// Seed today's runs at various hours: 07:12 (14s), 09:40 (32s), 11:05 (8s),
// 13:30 (45s), 15:48 (21s), 17:02 (6s), 18:44 (38s)
const today = new Date();
const mk = (h, m, dur, text) => {
  const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime();
  return { id: `seed-${h}${m}`, createdAt: at, app: "Seeded", rawText: text, finalText: text, durationMs: dur * 1000, sttModel: "whisper-base" };
};
const items = [
  mk(7, 12, 14, "morning notes — standup at nine, ship the veil fix"),
  mk(9, 40, 32, "add that tag test to the release checklist before tagging"),
  mk(11, 5, 8, "call the print shop about proofs"),
  mk(13, 30, 45, "the halftone strip reads the day as ink — ship it"),
  mk(15, 48, 21, "review the palette v2 recents, drop the chatty ones"),
  mk(17, 2, 6, "dinner at seven"),
  mk(18, 44, 38, "can you find the letterpress specimen for the press card"),
];
writeFileSync(join(userData, "history.json"), JSON.stringify(items, null, 2));
console.log("seeded", items.length, "runs");

const app = await electron.launch({
  executablePath: EXE,
  args: ["--no-sandbox", DIST],
  env: { ...process.env, WF_SMOKE: "1", DISPLAY: process.env.DISPLAY },
});
console.log("app launched, pid", app.process().pid);

const settings = await waitWindow(app, async (w) => w.url().includes("settings"), "settings console");
await settings.evaluate(() => {
  localStorage.setItem("wf-onboarded", "1");
  localStorage.setItem("wf-theme", "pressroom");
});
await settings.reload();
await settings.waitForTimeout(2200);
await settings.screenshot({ path: join(shots, "smoke-01-settings-home.png") });
console.log("📸 settings home");

await settings.evaluate(() => {
  window.location.hash = "/activity/history";
});
await settings.waitForTimeout(1600);
await settings.screenshot({ path: join(shots, "smoke-02-history.png") });
console.log("📸 history + DayStrip (seeded)");

// rail collapse via the real toggle button
const toggle = settings.locator('button[aria-label*="rail"]');
if (await toggle.count()) {
  await toggle.first().click();
  await settings.waitForTimeout(700);
  await settings.screenshot({ path: join(shots, "smoke-03-rail-collapsed.png") });
  console.log("📸 rail collapsed (toggle clicked)");
} else {
  console.log("!! toggle not found — shooting anyway");
  await settings.screenshot({ path: join(shots, "smoke-03-rail-collapsed.png") });
}

// restore + palette
await settings.locator('button[aria-label*="rail"]').first().click();
await settings.waitForTimeout(400);
await settings.keyboard.press("Control+k");
await settings.waitForTimeout(500);
await settings.screenshot({ path: join(shots, "smoke-04-palette.png") });
await settings.keyboard.press("Escape");

const lum = await settings.evaluate(() => {
  const b = getComputedStyle(document.body).backgroundColor;
  const m = b.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
});
console.log("computed body luminance:", lum.toFixed(0), lum > 225 ? "BRIGHT ✓" : "DIM ✗");

await app.close();
console.log("smoke v2 done");
