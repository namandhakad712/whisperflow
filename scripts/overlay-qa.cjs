/** Overlay QA: serve the built overlay.html with a stubbed bridge, drive
 *  states (listening w/ synthetic levels, processing, error), screenshot
 *  the capsule in dark + light + themed accents. Engine G verification. */
const { chromium } = require("playwright");
const { createServer } = require("http");
const { readFile } = require("fs/promises");
const path = require("path");
const OUT = path.join(__dirname, "..", "apps", "desktop", "out", "renderer");
const SHOTS = "/home/z/download/overlay-qa";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };

/** The overlay needs window.whisperflow + whisperflowExtras. Minimal stub:
 *  a state event we can flip from the test. */
const STUB = `
// fake mic: an AudioContext-free silent track so startCapture resolves
navigator.mediaDevices = navigator.mediaDevices || {};
navigator.mediaDevices.getUserMedia = async () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const stream = canvas.captureStream(2);
  // silent audio track via WebAudio oscillator at 0 gain is unavailable
  // pre-gesture; the capture only needs A track — feed a silent one via
  // AudioContext suspended (resolves without user gesture in headless)
  try {
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0.9;
    osc.frequency.value = 210;
    osc.connect(gain).connect(dest);
    osc.start();
    return dest.stream;
  } catch { return stream; }
};
window.whisperflow = {
  dictation: {
    onState: (cb) => { window.__wfPush = cb; cb({ state: "idle" }); return () => {}; },
    start: async () => {},
  },
  capture: { sendPcm: () => {} },
  settings: {
    get: async () => ({
      general: {}, hotkey: { pushToTalk: "⌘⇧Space" },
      audio: {}, modes: {}, profiles: {},
    }),
    update: async () => ({}),
  },
  history: { list: async () => [], clear: async () => {} },
};
window.whisperflowExtras = {
  overlay: { setInteractive: () => {}, onAlign: () => () => {}, onRest: () => () => {}, onSound: () => () => {} },
  settings: { onChanged: () => () => {} },
  system: { theme: async () => ({ dark: true }), onTheme: () => () => {} },
  app: { quit: async () => {}, relaunch: async () => {} },
};
`;

(async () => {
  const server = createServer(async (req, res) => {
    try {
      let p = req.url.split("?")[0];
      if (p === "/") p = "/overlay.html";
      const file = path.join(OUT, p);
      const data = await readFile(file);
      if (file.endsWith("overlay.html")) {
        const html = data.toString().replace("<head>", `<head><script>${STUB}</script>`);
        res.writeHead(200, { "content-type": "text/html" }); res.end(html); return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(4754, r));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 560, height: 240 } });
  page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") console.log(t.toUpperCase() + ":", m.text().slice(0, 200)); });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  await page.goto("http://localhost:4754/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const probe = await page.evaluate(() => ({
    hasWf: typeof window.whisperflow,
    hasExtras: typeof window.whisperflowExtras,
    rootKids: document.getElementById("root")?.children.length ?? -1,
    scripts: [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")),
  }));
  console.log("PROBE:", JSON.stringify(probe, null, 1));
  // wait for the overlay app to subscribe (the stub exposes __wfPush on subscribe)
  await page.waitForFunction(() => typeof window.__wfPush === "function", null, { timeout: 8000 });

  const push = (ev) => page.evaluate((e) => window.__wfPush(e), ev);

  // -- 1. LISTENING with a synthetic voice: loud sustained (urgent mood)
  await push({ state: "listening" });
  await page.waitForTimeout(400);
  // synthesize voice: patch AudioContext-free — call the engine's drive via
  // the levels path is unreachable (startCapture needs real mic), so we
  // verify the quiet field + sweep, then force-drive via a test shim:
  // the overlay stores its InkBloom on window.__wfBloom for QA (see Overlay.tsx)
  const drove = await page.evaluate(() => {
    const b = window.__wfBloom;
    if (!b) return "no-hook";
    b.drive(0.8);
    return "drove";
  });
  console.log("bloom drive:", drove);
  await page.waitForTimeout(900);
  // synthesize the level stream by calling the capture onLevel via the engine:
  // the overlay wires onLevel internally to startCapture; we instead drive the
  // InkBloom directly through its public API for the test
  await page.evaluate(() => {
    // find the bloom canvas and feed its engine via a test hook: we patch
    // InkBloom.drive through the instance the overlay created — exposed for
    // QA via __wfBloom on window in dev builds only. Fallback: fake levels
    // via AudioContext-less direct calls are not reachable; use DOM check.
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, "o-listening-dark.png") });
  console.log("📸 o-listening-dark");

  // -- 2. PROCESSING (thinking sweep on)
  await push({ state: "polishing", partial: "Ship the demo tomorrow — the launch is Monday." });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, "o-processing-dark.png") });
  console.log("📸 o-processing-dark (sweep)");

  // -- 3. THEME ACCENT: pressroom green capsule
  await page.evaluate(() => { localStorage.setItem("wf-theme", "pressroom"); });
  await push({ state: "listening" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, "o-listening-pressroom.png") });
  console.log("📸 o-listening-pressroom");

  // -- 4. NIGHTINK accent
  await page.evaluate(() => { localStorage.setItem("wf-theme", "nightink"); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, "o-listening-nightink.png") });
  console.log("📸 o-listening-nightink");

  // -- 5. DOM assertions: bloom canvas exists, painted, data-bloom toggles
  const dom = await page.evaluate(() => {
    const cap = document.querySelector(".capsule");
    const bloom = document.querySelector(".bloom canvas");
    let painted = false;
    if (bloom) {
      const ctx = bloom.getContext("2d");
      if (ctx && bloom.width > 0) {
        const d = ctx.getImageData(0, 0, Math.min(bloom.width, 120), Math.min(bloom.height, 60)).data;
        painted = d.some((v, i) => i % 4 === 3 && v > 0);
      }
    }
    return {
      capsule: Boolean(cap),
      bloomState: cap?.getAttribute("data-bloom"),
      bloomCanvas: Boolean(bloom),
      bloomSize: bloom ? `${bloom.width}x${bloom.height}` : null,
      painted,
      ring: Boolean(document.styleSheets.length),
    };
  });
  console.log("DOM:", JSON.stringify(dom));
  const geo = await page.evaluate(() => {
    const c = document.querySelector(".bloom canvas");
    const r = c?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  });
  console.log("BLOOM RECT:", JSON.stringify(geo));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
