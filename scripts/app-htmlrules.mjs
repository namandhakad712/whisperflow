
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
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list) => {
      for (const rule of list) {
        if (rule.selectorText && /(^|,)\s*html(\s|$|,|:|\[)/.test(rule.selectorText)) {
          out.push({ sel: rule.selectorText, css: rule.cssText.slice(0, 200) });
        }
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    walk(rules);
  }
  return out;
});
console.log(JSON.stringify(res, null, 2));
await app.close();
