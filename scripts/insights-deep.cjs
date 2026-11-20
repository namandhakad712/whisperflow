/** Deep-dive: per-canvas size + painted area in insights, to find which bar canvases are blank. */
const { chromium } = require("playwright");
const { createServer } = require("http");
const { readFile } = require("fs/promises");
const path = require("path");
const { bridgeStubFactory } = require("./console-qa-stub.cjs");
const OUT = path.join(__dirname, "..", "apps", "desktop", "out", "renderer");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };

(async () => {
  const server = createServer(async (req, res) => {
    try {
      let p = req.url.split("?")[0];
      if (p === "/") p = "/settings.html";
      const file = path.join(OUT, p);
      const data = await readFile(file);
      if (file.endsWith("settings.html")) {
        const html = data.toString().replace("<head>", `<head><script>window.whisperflowReady=new Promise(r=>{ const bridgeStub = ${bridgeStubFactory.toString()}; const b = bridgeStub(); window.whisperflow = b.whisperflow; window.whisperflowExtras = b.whisperflowExtras; r(); })</script>`);
        res.writeHead(200, { "content-type": "text/html" }); res.end(html); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(4752, r));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  await page.goto("http://localhost:4752/");
  await page.evaluate(() => { localStorage.setItem("wf-onboarded", "1"); localStorage.setItem("wf-theme", "pressroom"); });
  await page.reload();
  await page.waitForSelector(".rail-item", { timeout: 8000 });
  await page.evaluate(() => { window.location.hash = "/activity/insights"; });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    return [...document.querySelectorAll("canvas")].map((c) => {
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext("2d");
      let paintedPx = 0;
      let sampleW = 0, sampleH = 0;
      if (ctx && c.width > 0 && c.height > 0) {
        sampleW = Math.min(c.width, 100);
        sampleH = Math.min(c.height, 100);
        const d = ctx.getImageData(0, 0, sampleW, sampleH).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) paintedPx++;
      }
      return {
        css: `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.top)}`,
        buf: `${c.width}x${c.height}`,
        paintedFrac: +(paintedPx / (sampleW * sampleH)).toFixed(3),
      };
    });
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
