/**
 * Visual QA harness — renders the BUILT surfaces (out/renderer/*.html) with the
 * real preload, drives every dictation state + the status bar rest/hover, and
 * writes PNGs for review.
 *
 * Run after `npm run build -w apps/desktop` (clear ELECTRON_RUN_AS_NODE!):
 *   npx electron apps/desktop/scripts/overlay-shots.cjs [out-dir] [--zoom=1.25] [--align]
 *
 *   out-dir  defaults to %TEMP%/wf-qa
 *   --zoom   applies a page zoom factor (emulates high-DPI geometry stress)
 *   --align  also captures the overlay after sending an "overlay/align" hint
 *
 * This exists because the overlay shipped with NO stylesheet once (the entry
 * never imported styles.css — invisible until screenshotted). Visual regressions
 * on the one surface users actually see should never slip through again.
 *
 * Capture windows use an OPAQUE WHITE backdrop (not the production transparent
 * one) so dark/semi-transparent chrome — the 30×6 rest dash, the pill borders —
 * stays visible in the PNGs. Geometry is otherwise identical to production.
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith("--"));
const OUT = path.resolve(pos[0] ?? path.join(os.tmpdir(), "wf-qa"));
const zoom = parseFloat((args.find((a) => a.startsWith("--zoom=")) ?? "--zoom=1").slice(7));
const doAlign = args.includes("--align");
const BASE = path.resolve(__dirname, "../out");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY_STATES = [
  // mini (416×48): live transcript with the mic waveform
  ["listening-mini", { state: "listening", partial: "The quick brown fox jumps over the lazy dog while we check the overlay design", recording: true }],
  ["listening-placeholder", { state: "listening" }],
  ["listening-typing", { state: "listening", partial: "Meeting notes: follow up with the design team", recording: true, typing: true }],
  // card (416×80): the processing states — the known clipping suspect
  ["transcribing-card", { state: "transcribing", partial: "half a second of audio came in" }],
  ["transcribing-empty", { state: "transcribing" }],
  ["polishing-card", { state: "polishing" }],
  ["injecting-card", { state: "injecting" }],
  // l4 (416×322): long partial expands the transcript body
  [
    "transcribing-l4",
    {
      state: "transcribing",
      partial:
        "This is a much longer running transcript that pushes the pill into the expanded layout so the multiline transcript body, its padding and its scrollbar can all be reviewed against the card edges.",
    },
  ],
  // rest (30×6) + error surfaces
  ["done-rest", { state: "done" }],
  ["error", { state: "error", error: "Microphone unavailable: permission denied" }],
  [
    "clipboard-fallback",
    { state: "error", error: "couldn't paste into the focused window — the text is on your clipboard, press Ctrl+V" },
  ],
];

async function overlayShots() {
  // Production geometry exactly (WindowManager.ensureOverlay): 440×400.
  const win = new BrowserWindow({
    width: 440,
    height: 400,
    transparent: false,
    backgroundColor: "#ffffff",
    frame: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(BASE, "preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  await win.loadFile(path.join(BASE, "renderer/overlay.html"));
  if (zoom !== 1) win.webContents.setZoomFactor(zoom);
  await sleep(700);

  for (const [name, ev] of OVERLAY_STATES) {
    win.webContents.send("dictation/state", ev);
    // Longer than the pill's 0.42s morph so captures settle past the spring.
    await sleep(800);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `overlay-${name}.png`), img.toPNG());
    console.log(`overlay-${name}.png`);
  }

  if (doAlign) {
    // Top-anchored overlay: the pill should hang from the TOP of the window.
    // Reset to a clean processing state, then send the alignment hint.
    win.webContents.send("dictation/state", { state: "transcribing", partial: "half a second of audio came in" });
    await sleep(600);
    win.webContents.send("overlay/align", { edge: "top" });
    await sleep(600);
    let img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `overlay-align-top-card.png`), img.toPNG());
    console.log("overlay-align-top-card.png");

    win.webContents.send("dictation/state", { state: "listening", partial: "The quick brown fox jumps over the lazy dog", recording: true });
    await sleep(800);
    img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `overlay-align-top-mini.png`), img.toPNG());
    console.log("overlay-align-top-mini.png");

    // And back to bottom for a round-trip check.
    win.webContents.send("overlay/align", { edge: "bottom" });
    await sleep(600);
    img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `overlay-align-bottom-mini.png`), img.toPNG());
    console.log("overlay-align-bottom-mini.png");
  }
  win.destroy();
}

/**
 * Status-bar captures: the resting dash and the hover capsule, at the current
 * hit-zone size and at the widened 80×80 candidate, plus a zoom-stress pass.
 * `data-hover="true"` drives the same CSS path as a real :hover.
 */
async function statusShots() {
  for (const size of [56, 80]) {
    for (const [label, hover] of [
      ["rest", false],
      ["hover", true],
    ]) {
      const win = new BrowserWindow({
        width: size,
        height: size,
        transparent: false,
        backgroundColor: "#ffffff",
        frame: false,
        hasShadow: false,
        show: false,
        webPreferences: {
          preload: path.join(BASE, "preload/index.mjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      await win.loadFile(path.join(BASE, "renderer/status.html"));
      if (zoom !== 1) win.webContents.setZoomFactor(zoom);
      await sleep(500);
      if (hover) {
        await win.webContents.executeJavaScript(
          `document.getElementById("status-zone").setAttribute("data-hover", "true")`,
        );
        await sleep(500);
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(OUT, `status-${size}-${label}.png`), img.toPNG());
      console.log(`status-${size}-${label}.png`);
      win.destroy();
    }
  }
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await overlayShots();
  await statusShots();
  console.log(`shots → ${OUT}`);
  app.exit(0);
});
