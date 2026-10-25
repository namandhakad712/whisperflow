---
layout: ../../layouts/Doc.astro
title: Hotkeys & overlay
description: Push-to-talk, toggle mode, rebinding, and how the dictation overlay behaves.
---

## Push-to-talk

The default hotkey is **Ctrl+Shift+Space**:

- **Hold** to record; **release** to finish and polish. This is push-to-talk mode.
- The overlay appears near your cursor the moment recording starts.

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
