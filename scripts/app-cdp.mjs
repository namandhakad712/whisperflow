
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
// CDP: matched styles for <html>
const cdp = await win.context().newCDPSession(win);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument");
const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "html" });
const styles = await cdp.send("CSS.getMatchedStylesForNode", { nodeId });
const hits = (styles.inline || []).concat(styles.matchedCSSRules || []).filter(s => {
  const t = (s.rule ? s.rule.style : s.style) || {};
  return t.cssProperties && t.cssProperties.some(p => p.name === "opacity");
});
console.log(JSON.stringify(hits, null, 1).slice(0, 1500));
await app.close();
