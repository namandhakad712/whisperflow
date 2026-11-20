/**
 * Theme Press QA v2 — screenshots the General tab (theme picker visible)
 * in ALL SIX themes, plus Models in serif-cast Night Ink to check the
 * display role swap. Writes to download/console-qa/.
 *
 * Usage: node scripts/theme-qa.cjs   (repo root)
 */
const { createServer } = require("http");
const { readFile, writeFile, mkdir } = require("fs/promises");
const path = require("path");
const { chromium } = require("playwright");
const { bridgeStubFactory } = require("./console-qa-stub.cjs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "apps", "desktop", "out", "renderer");
const SHOTS = path.join(ROOT, "..", "download", "console-qa");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png",
  ".json": "application/json",
};
const PORT = 4748;
const THEMES = ["lab", "pressroom", "nightink", "letterpress", "lino", "daylight"];

(async () => {
  await mkdir(SHOTS, { recursive: true });
  const server = createServer(async (req, res) => {
    try {
      let p = req.url.split("?")[0];
      if (p === "/") p = "/settings.html";
      const file = path.join(OUT, p.replace(/^\//, ""));
      const data = await readFile(file);
      if (file.endsWith("settings.html")) {
        const html = data
          .toString()
          .replace(
            "<head>",
            `<head><script>window.whisperflowReady=new Promise(r=>{ const bridgeStub = ${bridgeStubFactory.toString()}; const b = bridgeStub(); window.whisperflow = b.whisperflow; window.whisperflowExtras = b.whisperflowExtras; r(); })</script>`,
          );
        res.writeHead(200, { "content-type": "text/html" });
        res.end(html);
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });

  await page.goto(`http://localhost:${PORT}/`);
  try { await page.evaluate(() => localStorage.setItem("wf-onboarded", "1")); } catch {}

  for (const theme of THEMES) {
    await page.evaluate((t) => {
      localStorage.setItem("wf-theme", t);
      // applyTheme path also needs the reload to read it fresh
    }, theme);
    await page.reload();
    await page.waitForSelector(".rail-item", { timeout: 8000 });
    await page.waitForTimeout(450); // theme roll + stage-in settle
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.screenshot({ path: path.join(SHOTS, `t-${theme}-general.png`) });
    console.log(`📸 t-${theme}-general (data-theme=${attr})`);
    if (theme === "nightink") {
      await page.evaluate(() => { window.location.hash = "/models"; });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOTS, `t-${theme}-models.png`) });
      console.log(`📸 t-${theme}-models (serif cast)`);
    }
    // v0.1.46: insights — dithered bars, sparkline, heatmap (seeded history)
    await page.evaluate(() => { window.location.hash = "/dictation/insights"; });
    await page.waitForTimeout(1500); // entrance sweeps + bloom settle
    await page.screenshot({ path: path.join(SHOTS, `t-${theme}-insights.png`), fullPage: false });
    console.log(`📸 t-${theme}-insights (dithered)`);
  }

  await browser.close();
  server.close();
  console.log(`\ntheme QA done — ${THEMES.length}+1 shots in ${SHOTS}`);
})().catch((e) => { console.error(e); process.exit(1); });
