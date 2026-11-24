/* v0.1.53 smoke: real Electron app, seeded history spanning the week
 * AND month, then drive the DayStrip range chips: day → week → month.
 * Screenshots each range + luminance check. */
import { _electron as electron } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "download", "app-smoke53");
mkdirSync(shots, { recursive: true });

const EXE = "/home/z/my-project/node_modules/electron/dist/electron";
const DIST = "/home/z/my-project/apps/desktop/out/main/index.js";
const userData = "/home/z/.config/WhisperFlow";

// Seed runs across the month: today (several hours), this week (past
// days), and earlier in the month.
const now = new Date();
const mk = (dOffset, h, m, dur, text) => {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dOffset, h, m).getTime();
  return { id: `s-${dOffset}-${h}${m}`, createdAt: at, app: "Seed", rawText: text, finalText: text, durationMs: dur * 1000, sttModel: "whisper-base" };
};
const items = [
  mk(0, 8, 12, 14, "today morning — the strip reads the day"),
  mk(0, 11, 40, 32, "today noon — dots sized by length"),
  mk(0, 15, 5, 8, "today afternoon — quick note"),
  mk(1, 9, 30, 21, "yesterday — standup notes"),
  mk(2, 14, 15, 45, "two days back — the press run"),
  mk(4, 10, 0, 12, "four days back — short memo"),
  mk(6, 16, 45, 27, "start of the week — late run"),
  mk(9, 9, 0, 18, "nine back — morning pages"),
  mk(15, 13, 20, 36, "mid month — the long one"),
  mk(22, 11, 10, 24, "three weeks in — steady"),
  mk(27, 15, 30, 15, "near month start — wrap"),
];
writeFileSync(join(userData, "history.json"), JSON.stringify(items, null, 2));
console.log("seeded", items.length, "runs across the month");

const app = await electron.launch({
  executablePath: EXE,
  args: ["--no-sandbox", DIST],
  env: { ...process.env, WF_SMOKE: "1", DISPLAY: process.env.DISPLAY },
});

let settings = null;
for (let i = 0; i < 40 && !settings; i++) {
  for (const w of app.windows()) {
    if (w.url().includes("settings")) { settings = w; break; }
  }
  await new Promise((r) => setTimeout(r, 300));
}
if (!settings) throw new Error("settings window never appeared");

await settings.evaluate(() => {
  localStorage.setItem("wf-onboarded", "1");
  localStorage.setItem("wf-theme", "pressroom");
});
await settings.reload();
await settings.waitForTimeout(2000);
await settings.evaluate(() => {
  window.location.hash = "/activity/history";
});
await settings.waitForTimeout(1500);

// day range (default)
await settings.screenshot({ path: join(shots, "53-day.png") });
console.log("📸 day");

// week chip
await settings.click('button[aria-pressed="false"]:has-text("week")');
await settings.waitForTimeout(900);
await settings.screenshot({ path: join(shots, "53-week.png") });
console.log("📸 week");

// month chip
await settings.click('button[aria-pressed="false"]:has-text("month")');
await settings.waitForTimeout(900);
await settings.screenshot({ path: join(shots, "53-month.png") });
console.log("📸 month");

// back to day (chips toggle state check)
await settings.click('button[aria-pressed="false"]:has-text("today")');
await settings.waitForTimeout(600);
const pressed = await settings.evaluate(() => {
  const b = document.querySelector('button[aria-pressed="true"]');
  return b ? b.textContent : "none";
});
console.log("restored active chip:", pressed);

const lum = await settings.evaluate(() => {
  const b = getComputedStyle(document.body).backgroundColor;
  const m = b.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
});
console.log("body luminance:", lum.toFixed(0), lum > 225 ? "BRIGHT ✓" : "DIM ✗");

await app.close();
console.log("v53 smoke done");
