/* Dump the html element's runtime state: computed opacity, inline style,
 * classes, dataset — hunting what sets opacity 0.5 on <html>. */
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
await new Promise((r) => setTimeout(r, 1500));
const res = await win.evaluate(() => {
  const html = document.documentElement;
  const cs = getComputedStyle(html);
  return {
    computedOpacity: cs.opacity,
    inlineStyle: html.getAttribute("style"),
    classes: html.className,
    dataset: { ...html.dataset },
    sheetCount: document.styleSheets.length,
  };
});
console.log(JSON.stringify(res, null, 2));
await app.close();
