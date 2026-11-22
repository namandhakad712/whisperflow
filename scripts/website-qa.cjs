/** Website QA: serve the built dist/ through the /whisperflow symlink path,
 *  screenshot the CTA nocturne + hero in both modes. */
const { chromium } = require("playwright");
const { createServer } = require("http");
const { readFile } = require("fs/promises");
const path = require("path");
const DIST = path.join(__dirname, "..", "apps", "website", "dist");
const SHOTS = "/home/z/download/website-qa";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

(async () => {
  // Local QA rule: serve dist/ from the PARENT dir through the symlink, or all
  // routes 404 (base: "/whisperflow").
  const parent = path.join(DIST, "..");
  const server = createServer(async (req, res) => {
    try {
      const p = req.url.split("?")[0].replace(/^\/whisperflow/, "") || "/";
      const file = path.join(DIST, p === "/" ? "index.html" : p);
      const data = await readFile(file);
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end("nf"); }
  });
  await new Promise((r) => server.listen(4755, r));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:4755/whisperflow/");
  await page.waitForTimeout(2500);

  // CTA nocturne (bottom of page) — light mode
  await page.evaluate(() => document.querySelector("#cta-scene")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(SHOTS, "w-cta-nocturne-light.png") });
  console.log("📸 w-cta-nocturne-light");

  // dark mode: second print
  await page.evaluate(() => { document.documentElement.dataset.mode = "dark"; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, "w-cta-nocturne-dark.png") });
  console.log("📸 w-cta-nocturne-dark");

  // DOM: canvas alive?
  const dom = await page.evaluate(() => {
    const c = document.querySelector("#cta-scene");
    return { cta: Boolean(c), w: c?.width ?? 0, h: c?.height ?? 0 };
  });
  console.log("CTA DOM:", JSON.stringify(dom));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
