
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
await new Promise((r) => setTimeout(r, 2000));
const res = await win.evaluate(() => {
  const html = document.documentElement;
  const anims = html.getAnimations({ subtree: false }).map(a => ({
    name: a.animationName ?? a.transitionProperty,
    type: a.constructor.name,
    state: a.playState,
    timing: a.effect?.getTiming ? JSON.stringify(a.effect.getTiming()) : null,
  }));
  return { opacity: getComputedStyle(html).opacity, anims };
});
console.log(JSON.stringify(res, null, 2));
await app.close();
