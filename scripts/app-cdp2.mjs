/* CDP: dump EVERY matched style block for <html> that sets opacity,
 * printing selector + sheetId, robustly via raw JSON output to a file. */
import { _electron as electron } from "playwright";
import { writeFile } from "node:fs/promises";

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

const cdp = await win.context().newCDPSession(win);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument");
const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "html" });
const styles = await cdp.send("CSS.getMatchedStylesForNode", { nodeId });

const hits = [];
for (const entry of [...(styles.inline ?? []), ...(styles.matchedCSSRules ?? [])]) {
  const rule = entry.rule;
  const selector = entry.selectorList
    ? entry.selectorList.text
    : rule
      ? rule.selectorList.text
      : "(inline)";
  const props = (rule ? rule.style : entry.style)?.cssProperties ?? [];
  for (const p of props) {
    if (p.name === "opacity") {
      hits.push({
        selector,
        value: p.value,
        sheet: rule ? rule.styleSheetId : "(inline)",
        range: p.range ? `${p.range.startLine}:${p.range.startColumn}` : null,
      });
    }
  }
}
await writeFile("/tmp/refs/html-opacity.json", JSON.stringify(hits, null, 2));
console.log(JSON.stringify(hits, null, 2));
await app.close();
