/* Page-walk probe: inside the REAL app, enumerate every element that
 * covers the viewport, with its computed paint-affecting props. Prints
 * any layer with background/black/opacity/blend that could veil. */
import { _electron as electron } from "playwright";

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

const report = await win.evaluate(() => {
  const vw = innerWidth;
  const vh = innerHeight;
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    // elements covering >= 60% of the viewport
    if ((r.width / vw) * (r.height / vh) < 0.6) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || +cs.opacity === 0) continue;
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = (typeof el.className === "string" ? el.className : "").slice(0, 60);
    out.push({
      tag: tag + id + (cls ? "." + cls.split(" ").slice(0, 3).join(".") : ""),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      z: cs.zIndex,
      opacity: cs.opacity,
      bg: cs.backgroundColor,
      bgi: (cs.backgroundImage || "").slice(0, 70),
      filter: cs.filter,
      blend: cs.mixBlendMode,
      pos: cs.position,
    });
  }
  return out;
});
console.log(JSON.stringify(report, null, 2));

// also: the html element's background
const htmlBg = await win.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return { bg: cs.backgroundColor, bgi: (cs.backgroundImage || "").slice(0, 70) };
});
console.log("html:", JSON.stringify(htmlBg));
await app.close();
