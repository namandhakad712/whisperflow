# Wispr Flow — behavioural notes from the shipped app

Source: the user's installed build at `%LOCALAPPDATA%\WisprFlow\app-1.6.1264`
(Squirrel/Electron). Analysed by extracting `resources/app.asar` and reading
`.webpack/main/index.js` (9.7 MB bundle) and the renderer chunks.

These are **observations from a shipped artifact**, not documentation the vendor
publishes. They exist to keep our parity work grounded. Nothing here is copied
code — only behaviour, options and geometry were reproduced.

## Settings surface (their store keys → what we implemented)

Their renderer default state enumerates the whole settings store. Settings that
mapped onto real features and are now in WhisperFlow:

| Their key / label | Ours |
| --- | --- |
| `aiFormatting`, `polishEnabled`, `polishAutoPaste`, `autoPolishAfterDictation` | `polish.enabled` (master toggle) — also already had provider/tone |
| `autoCleanup.level` | `polish.cleanup` — `off` / `light` / `strong`, drives the polish prompt |
| `internal.maxRecordingLengthMs` | `audio.maxRecordingLengthMs` — hard cap, 0 = unlimited |
| `overrideAudioDeviceId`, `rankedAudioDevices` | `audio.deviceId` picker (Audio tab) — **now actually used** by the overlay capture (it was silently ignored) |
| `usedLanguages` / `selectedLanguages`, "Automatic language detection" | `stt.language` already defaults to `"auto"` |

Not implemented (and why): `App Language`/`uiLocale` (full i18n), per-app
**Styles** (`styleDetectionEnabled`, styles per app — a big subsystem), the
**Flow Bar** resting state pill + scratchpad in the bar, **mouse-flow** (hold a
mouse button to dictate — needs the OS hook listening for mouse buttons, doable
on top of uiohook-napi), `emailAutoSignature`, BLE device pairing, granola/otter
imports, cloud sync, telemetry.

## Data model (from their migration filenames)

Their SQLite schema (`flow.sqlite`, `node:sqlite`, daily 12:00 backup cron into
`backups/`) keeps per-dictation: app, language, mic device, speech duration,
e2e + network latency, pasted text + divergence score, edit distance, edited
text, tone-matched text, axText/axHtml, opus chunks, logprobs, feedback. We
adopted the **daily backup** (`lifecycle/backup.ts`, 7-day rotation) and the
per-dictation **app attribution** (`system/foreground.ts`). SQLite history and
edit-distance learning remain on the roadmap.

## Overlay panel window (what we replicated)

`createPanelWindow` builds the pill panel with:

```js
new BrowserWindow({
  x, y, width, height,
  show: false,
  transparent: true,
  backgroundColor: "#00000000",
  hasShadow: false,
  type: isMac ? "panel" : "toolbar",   // Windows: toolbar
  frame: false, fullscreen: false, fullscreenable: false,
  maximizable: false, minimizable: false,
  resizable: false, movable: false, closable: false,
  skipTaskbar: true,
  focusable: true,
  alwaysOnTop: true,
})
win.setAlwaysOnTop(true, isMac ? "floating" : "screen-saver")
win.setIgnoreMouseEvents(true, { forward: true })
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true }) // mac
win.setFullScreenable(false)
win.showInactive()        // never steals focus from the target app
```

Interactivity: the renderer posts `overlay:panelInteractive`, and main toggles
`setIgnoreMouseEvents(false)` while the pointer is over a control, then back to
`true, {forward:true}`. After `did-finish-load` it resets to click-through.

Anchors (all relative to the display's **work area**, all clamped inside it):

| anchor | position |
| --- | --- |
| `floating` | bottom-right, **14 px** inset |
| `top-left` / `top-right` | corner, 14 px inset; bounds re-applied on `display-removed` / `display-metrics-changed` |
| `full-screen` | the whole work area |
| default | clamped around the requested point, on the display nearest the point |

Display selection: `screen.getDisplayNearestPoint({ x: b.x + b.width/2, y: b.y + b.height/2 })`.

Implemented for WhisperFlow in `apps/desktop/src/main/windows/overlayAnchor.ts`
(pure, unit-tested) and `WindowManager`. Same flags, same inset, same clamping,
same interactivity protocol.

## Other panels they ship

- **status window** — `type:"toolbar"`, `focusable:false`, `alwaysOnTop("screen-saver")`.
  State machine: `hidden · resting · context-menu · initializing · ready ·
  active_ptt · active_popo · processing · polish_processing …` (PTT = press-to-talk,
  POPO = press-once/press-off, i.e. our toggle mode).
- **context menu window** — `type:"toolbar"`, `focusable:false`, top-most.
- **dim window** — full-screen, `backgroundColor:"#000000"`, `transparent:false`,
  `focusable:false`; used to dim the screen behind an expanded preview.
- Renderer bundles: `overlay`, `status`, `hub`, `scratchpad`, `meeting_recorder`,
  `meeting_ax_inspector`, `contextMenu`, `accessibility_drop`, `feature_tour`.
- `resources/ax-inspect*.mjs` + a `meeting_ax_inspector` renderer → they read the
  focused control through **Windows UI Automation** (accessibility tree), used
  for meeting capture and editability checks.
- They bundle a **Jabra device connector** (`native_modules/jabra-device-connector`)
  for Bluetooth headset button/audio integration.
- Audio: Opus encoder workers + `recorderWorklet.js` in the renderer.
- Design system: Tailwind-style CSS variables with a warm neutral palette
  (`--sand-*`, `--vast-*`), shadcn-like tokens (`--primary-foreground`,
  `--shadow-xs/sm/lg`, `--ring`, `--border`).

## Injection (paste) — what we learned and changed

`PasteAnalyticsPayload` carries `clipboardLengthBefore`, `clipboardLengthAfter`,
`clipboardWriteSuccessful`, `clipboardOwnerApp`, `clipboardOpenApp`, plus
`keystrokeTrace`, `pastedText`, `pasteId` and a `NotEditable` outcome. So their
injection is: **check the target is editable → write the clipboard → synthesise
a paste → verify it landed → restore the clipboard**.

WhisperFlow already pasted via clipboard + Ctrl+V, but this analysis exposed a
real bug in ours: Electron 45 refuses to write back a `ClipboardItem` returned by
`clipboard.read()`, so our restore threw and was swallowed — leaving the dictated
text on the user's clipboard after every dictation. Fixed by rebuilding items
with `getType` + `new ClipboardItem(...)`, with a plain-text fallback.

Still to adopt from their approach: preflight "is the focused control editable"
(via UI Automation) and post-paste verification.

## Not replicated (and why)

- **Cloud ASR + account, analytics, telemetry** — WhisperFlow is local-first by
  design; there is no server to send keystroke traces to.
- **Jabra SDK / Bluetooth device integration** — a vendor SDK with licensing and
  device-specific testing we cannot do here.
- **UI Automation context reading** — plausible for us later (meeting mode could
  read on-screen text), but it is a privacy-sensitive capability that deserves a
  documented opt-in.
- **Their exact visual design** (palette, spacing, motion) — only the structural
  parts (window flags, geometry, click-through, anchors) were reproduced; the
  look stays our own.
