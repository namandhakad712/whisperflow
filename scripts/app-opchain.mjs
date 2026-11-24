/* Opacity chain + live sampling on <html>: which ancestor has opacity,
 * and does it change over 2.4s (stuck transition)? */
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

const chain = await win.evaluate(() => {
  const out = [];
  let el = document.body;
  while (el) {
    out.push({ tag: el.tagName, op: getComputedStyle(el).opacity });
    el = el.parentElement;
  }
  return out;
});
console.log("chain:", JSON.stringify(chain));

const samples = [];
for (let i = 0; i < 6; i++) {
  samples.push(
    await win.evaluate(() => getComputedStyle(document.documentElement).opacity),
  );
  await new Promise((r) => setTimeout(r, 400));
}
console.log("html opacity over 2.4s:", JSON.stringify(samples));
await app.close();
