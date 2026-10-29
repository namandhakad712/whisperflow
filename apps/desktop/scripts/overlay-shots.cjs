/**
 * Renders the BUILT overlay (out/renderer/overlay.html) with the real preload,
 * feeds it every dictation state, and writes PNGs to the temp dir.
 *
 * Run after `npm run build -w apps/desktop`:
 *   node apps/desktop/scripts/overlay-shots.cjs    (then run electron on the
 *   generated dir, or: npx electron apps/desktop/scripts/overlay-shots.cjs)
 *
 * This exists because the overlay shipped with NO stylesheet once (the entry
 * never imported styles.css — invisible until screenshotted). Visual regressions
 * on the one surface users actually see should never slip through again.
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const OUT = path.join(require("node:os").tmpdir(), "wf-overlay-shots");
const BASE = path.resolve(__dirname, "../out");

const STATES = [
  ["listening", { state: "listening", partial: "The quick brown fox jumps over the lazy dog while we check the overlay design" }],
  ["transcribing", { state: "transcribing", partial: "…half a second of audio" }],
  ["done", { state: "done" }],
  ["error", { state: "error", error: "Microphone unavailable: permission denied" }],
  ["rec-typing", { state: "listening", partial: "Meeting notes: follow up with the design team", recording: true, typing: true }],
  ["clipboard-fallback", { state: "error", error: "couldn't paste into the focused window — the text is on your clipboard, press Ctrl+V" }],
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 440,
    height: 240, // tall enough to also capture the 200px notification card
    transparent: true,
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
  await new Promise((r) => setTimeout(r, 700));

  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, ev] of STATES) {
    win.webContents.send("dictation/state", ev);
    // Longer than the pill's 0.42s morph so captures settle past the spring.
    await new Promise((r) => setTimeout(r, 800));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `overlay-${name}.png`), img.toPNG());
    console.log(`overlay-${name}.png`);
  }
  app.exit(0);
});
