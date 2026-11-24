/* Inspect the computed body::before grain layer + theme inside the REAL
 * built app, under Xvfb — diagnosing the smoke-test veil. */
import { _electron as electron } from "playwright";

const app = await electron.launch({
  executablePath: "/home/z/my-project/node_modules/electron/dist/electron",
  args: ["--no-sandbox", "/home/z/my-project/apps/desktop/out/main/index.js"],
  env: { ...process.env, WF_SMOKE: "1", DISPLAY: process.env.DISPLAY },
});
await new Promise((r) => setTimeout(r, 3000));
const win = app.windows()[0];
const diag = await win.evaluate(() => {
  const cs = getComputedStyle(document.body);
  const csB = getComputedStyle(document.body, "::before");
  const root = document.documentElement;
  return {
    url: location.hash,
    bg: cs.backgroundColor,
    beforeOpacity: csB.opacity,
    beforeContent: csB.content,
    beforeBgImage: (csB.backgroundImage || "").slice(0, 90),
    theme: root.dataset.theme,
    grain: root.dataset.grain ?? "(unset)",
    motion: root.dataset.motion ?? "(unset)",
    density: root.dataset.density ?? "(unset)",
  };
});
console.log(JSON.stringify(diag, null, 2));
await app.close();
