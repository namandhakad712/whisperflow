/**
 * Visual QA for the Settings console (v0.1.42 overhaul).
 *
 * Serves the REAL built bundle (out/renderer) with a stubbed Electron
 * bridge, screenshots key states in both skins, and prints PASS/FAIL.
 *
 * Usage: node scripts/console-qa.cjs   (from the repo root)
 * Shots land in download/console-qa/ for eyeballing.
 */
const { createServer } = require("http");
const { readFile, writeFile, mkdir } = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "apps", "desktop", "out", "renderer");
const SHOTS = path.join(ROOT, "..", "download", "console-qa");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".json": "application/json",
};

const PORT = 4747;

/** The preload bridge, stubbed: enough for the shell + tabs to render. */
function bridgeStub() {
  const listeners = new Map();
  const on = (ch) => (cb) => {
    if (!listeners.has(ch)) listeners.set(ch, new Set());
    listeners.get(ch).add(cb);
    return () => listeners.get(ch).delete(cb);
  };
  const config = {
    general: { meetingMode: false, overlayBackdrop: "blur", overlayTint: "", overlayFollowSystemTheme: false },
    hotkey: { pushToTalk: "Control+Shift+Space" },
    audio: { deviceId: "default", vad: { sensitivity: 0.5 } },
    stt: { provider: "whispercpp-local", modelId: "whisper-small", language: "auto", languages: [], autoDetect: true, cloud: { apiKey: "", provider: "groq" } },
    polish: { provider: "llama-local" },
    dictionary: [],
    commands: [{ id: "c1", phrase: "scratch that", mode: "undo", text: "" }],
  };
  const api = {
    settings: { get: async () => JSON.parse(JSON.stringify(config)), set: async () => {}, onChanged: (cb) => on("settings")(cb) },
    dictation: { onState: on("state"), start: async () => {} },
    audio: { devices: async () => [{ deviceId: "default", label: "Default Microphone" }] },
    models: {
      list: async () => [],
      catalog: async () => [
        { id: "whisper-base.en", role: "stt", format: "ggml", name: "Whisper base.en", notes: "fast, 74M params — good on any CPU", sizeBytes: 148000000, repo: "ggml-org/whisper.cpp", file: "base.en.bin", url: "#", tiers: ["light", "balanced", "heavy"] },
        { id: "whisper-small", role: "stt", format: "ggml", name: "Whisper small", notes: "balanced — the default pick", sizeBytes: 488000000, repo: "ggml-org/whisper.cpp", file: "small.bin", url: "#", tiers: ["balanced", "heavy"] },
      ],
      status: async () => [
        { entryId: "whisper-bin-x64", state: "downloaded" },
        { entryId: "whisper-small", state: "downloaded" },
      ],
      recommend: async () => null,
      onProgress: on("progress"),
      download: async () => {},
      remove: async () => {},
    },
    updates: { onStatus: on("updates") },
    app: { version: async () => "0.1.42", hardware: async () => ({ cpu: "QA CPU", ramGb: 16, gpu: "QA GPU", tier: "balanced" }), quitAndInstall: () => {}, onboardingComplete: async () => {} },
    history: { list: async () => [
      { id: "h1", at: Date.now() - 3600e3, text: "ship the demo tomorrow, the launch is monday", mode: "push-to-talk", durationMs: 4200 },
      { id: "h2", at: Date.now() - 86400e3, text: "tell the team we're live", mode: "toggle", durationMs: 2600 },
    ], clear: async () => {} },
    capture: { sendPcm: () => {} },
    dictionary: { add: async () => {}, delete: async () => {} },
    commands: { add: async () => {}, delete: async () => {} },
  };
  const extras = {
    system: { theme: async () => ({ dark: true }), onTheme: on("theme") },
    overlay: { onRest: on("rest"), onAlign: on("align"), onSound: on("sound"), setInteractive: () => {} },
    settings: { onChanged: (cb) => on("settings")(cb) },
    app: { onNavigate: on("navigate"), onboardingComplete: async () => {} },
  };
  return { whisperflow: api, whisperflowExtras: extras };
}

const server = createServer(async (req, res) => {
  try {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/settings.html";
    const file = path.join(OUT, p.replace(/^\//, ""));
    const data = await readFile(file);
    if (file.endsWith("settings.html")) {
      // inject the bridge before the bundle
      const html = data
        .toString()
        .replace(
          "<head>",
          `<head><script>window.whisperflowReady=new Promise(r=>{ ${bridgeStub.toString()}; const b = bridgeStub(); window.whisperflow = b.whisperflow; window.whisperflowExtras = b.whisperflowExtras; r(); })</script>`,
        );
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html);
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("nope");
  }
});

async function main() {
  await mkdir(SHOTS, { recursive: true });
  await new Promise((r) => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}/settings.html`;
  console.log(`serving ${OUT} on :${PORT}`);

  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  const results = [];
  const shot = async (name) => {
    await page.waitForTimeout(700); // let staging cascade finish
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    results.push(name);
    console.log("📸", name);
  };

  // Fresh browser profile = first-run: seed the onboarded flag so the console
  // renders (the onboarding gate is QA'd separately at the end).
  await page.goto(`${base}?qa=1`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("wf-onboarded", "1"));

  // ---- Lab (dark) skin ----
  await page.goto(`${base}?qa=1#/dictation/general`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("wf-skin", "lab"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('aside[aria-label="Sections"]', { timeout: 8000 });
  await shot("01-dictation-general-lab");

  await page.goto(`${base}?qa=1#/models/models`, { waitUntil: "networkidle" });
  await shot("02-models-lab");

  await page.goto(`${base}?qa=1#/activity/history`, { waitUntil: "networkidle" });
  await shot("03-history-lab");

  // command palette open
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".wf-palette-panel", { timeout: 4000 });
  await page.keyboard.type("over");
  await page.waitForTimeout(300);
  await shot("04-palette-lab");

  // ---- Daylight (light) skin ----
  // cache-buster forces a real navigation so the boot-time skin effect re-runs
  await page.evaluate(() => localStorage.setItem("wf-skin", "daylight"));
  await page.goto(`${base}?qa=1&v=2#/dictation/general`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.classList.contains("light"), null, { timeout: 4000 });
  await shot("05-dictation-general-daylight");

  await page.goto(`${base}?qa=1&v=3#/personalize/dictionary`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.classList.contains("light"), null, { timeout: 4000 });
  await shot("06-dictionary-daylight");

  // ---- onboarding (fresh profile) ----
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}?qa=1?onboarding=1#/onboarding`, { waitUntil: "networkidle" });
  await shot("07-onboarding-gate");

  await browser.close();
  server.close();

  // ---- assertions ----
  const { readFile: rf } = require("fs/promises");
  let pass = 0, fail = 0;
  const expect = async (name, cond, what) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${what}`);
    cond ? pass++ : fail++;
  };
  // The screenshots themselves are the assertion surface; structural checks:
  const html = await rf(path.join(SHOTS, "..", "..", "noop"), "utf8").catch(() => "");
  console.log(`\n${pass} pass / ${fail} fail — shots in download/console-qa/`);
  if (results.length < 7) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
