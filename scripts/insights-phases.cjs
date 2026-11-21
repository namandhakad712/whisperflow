/** Phase-aware canvas check: sizes right after mount vs after data loads. */
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
  await new Promise((r) => server.listen(4753, r));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto("http://localhost:4753/");
  await page.evaluate(() => { localStorage.setItem("wf-onboarded", "1"); localStorage.setItem("wf-theme", "pressroom"); });
  await page.reload();
  await page.waitForSelector(".rail-item", { timeout: 8000 });
  await page.evaluate(() => { window.location.hash = "/activity/insights"; });
  await page.waitForTimeout(300);
  const early = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => `${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`));
  await page.waitForTimeout(2500);
  const late = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => {
    const r = c.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)} buf=${c.width}x${c.height}`;
  }));
  const dom = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('div[style*="height:"]')].filter(d => d.style.height.endsWith('%'));
    return bars.map(b => ({ h: b.style.height, rect: Math.round(b.getBoundingClientRect().height) }));
  });
  console.log('bar containers:', JSON.stringify(dom));
  await page.screenshot({ path: "/tmp/insights-fresh.png" });
  console.log("shot saved");
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
