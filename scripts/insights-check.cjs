/** Insights DOM verification: canvases painted, replay + tooltip wired. */
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
  await new Promise((r) => server.listen(4751, r));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  await page.goto("http://localhost:4751/");
  await page.evaluate(() => { localStorage.setItem("wf-onboarded", "1"); localStorage.setItem("wf-theme", "pressroom"); });
  await page.reload();
  await page.waitForSelector(".rail-item", { timeout: 8000 });
  await page.evaluate(() => { window.location.hash = "/activity/insights"; });
  await page.waitForTimeout(1600);
  const r1 = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    const painted = canvases.filter((c) => {
      const ctx = c.getContext("2d");
      if (!ctx || c.width === 0) return false;
      const d = ctx.getImageData(0, 0, Math.min(c.width, 80), Math.min(c.height, 40)).data;
      return d.some((v, i) => i % 4 === 3 && v > 0);
    });
    return {
      canvases: canvases.length,
      painted: painted.length,
      replayBtn: [...document.querySelectorAll("button")].some((b) => b.textContent.includes("replay")),
      heatmapCells: [...document.querySelectorAll("[title]")].filter((e) => e.className.includes("rounded-sm")).length,
    };
  });
  console.log("insights DOM:", JSON.stringify(r1));
  // tooltip appears on bar hover
  const canvases = await page.$$("canvas");
  if (canvases[1]) {
    await canvases[1].hover();
    await page.waitForTimeout(250);
    const tip = await page.evaluate(() => {
      const tips = [...document.querySelectorAll("div")].filter((d) => /words · \d+ dictations/.test(d.textContent || ""));
      return tips.map((t) => getComputedStyle(t).opacity);
    });
    console.log("tooltip opacity on hover:", tip);
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
