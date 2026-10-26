---
layout: ../../layouts/Doc.astro
title: Hotkeys & overlay
description: Press-and-hold push-to-talk, typing detection, toggle mode, rebinding, and how the dictation overlay behaves.
---

## Push-to-talk

The default hotkey is **Ctrl+Shift+Space**:

- **Hold** to record; **release** to finish and polish. This is push-to-talk mode.
- The overlay appears near your cursor the moment recording starts.

### How the key release is detected

Electron's global shortcuts only fire on key-down — the OS never tells an app
when a key goes back up. Press-and-hold therefore uses a small global keyboard
hook (`uiohook-napi`, MIT, bundled). It watches for your configured combination
only; while you dictate, other keys are counted as booleans so the session can
be held open — **nothing you type is ever recorded, stored, or sent**.

If the hook cannot load on your machine, the setting stays visible but switches
itself off and the app keeps working in toggle mode.

## Typing while dictating

Say a sentence, type a correction, keep talking — WhisperFlow holds the session
open when it detects typing and the overlay says so (`⌨ typing — dictation
held`). Dictation ends only when you release the hotkey (or press it again, in
toggle mode).

## Toggle mode

Prefer hands-free? In Settings → Shortcuts, enable **Toggle mode**: press once to start,
press again to finish. Silence detection still ends segments automatically after a
configurable timeout (default 700 ms of silence finalizes a segment).

## Rebinding and conflicts

- Any Electron accelerator works: e.g. `Alt+Q`, `Ctrl+Shift+D`, `F9`.
- If another app owns your chosen combo, WhisperFlow tells you at bind time — pick another.
- The hotkey works system-wide, including over full-screen apps (games, terminals, RDP).

## Overlay states

| State          | What you see                              | How to exit        |
| -------------- | ----------------------------------------- | ------------------ |
| `listening`    | Waveform + live partial transcript        | Release key / Esc  |
| `transcribing` | Final pass over the audio                | wait (~0.2–2 s)    |
| `polishing`    | Spinner while the LLM formats text       | wait / Esc         |
| `done`         | Text injected, brief confirmation        | auto-dismiss       |
| `error`        | What failed and why                      | click / Esc        |

**Esc always cancels** the current dictation without pasting anything.

## Overlay placement

By default the pill appears near your text cursor (or mouse pointer as fallback). Settings →
General has a static-position option if you prefer it docked.

Next: [Models & hardware](/docs/models/)
