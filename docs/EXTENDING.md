# Extending WhisperFlow — every knob, every recipe

WhisperFlow is built to be *yours*: nearly every behavior is a config value you can flip in
Settings or hand-edit on disk. This is the complete reference, grouped by how ambitions you are,
plus copy-paste setups and the honest gap list.

> **The config file:** `%APPDATA%\WhisperFlow\config.json` on Windows
> (`~/Library/Application Support/WhisperFlow/config.json` on macOS). It's plain JSON — edit it
> while the app is running and the app picks up your edits on the next save (Settings writes it
> back, so close the Settings window first if you mix both). **Never put API keys in a dotfile you
> sync publicly** — the key lives only in this file and only leaves your machine for the endpoint
> it configures.

---

## 1. "I just want it to behave" — the everyday switches

| Want | Where | Default |
| --- | --- | --- |
| Press once to start, press again to stop — or hold the key the whole time | Settings → Shortcuts → *Interaction mode* (`hotkey.mode`: `"toggle"` / `"hold"`) | toggle |
| Stop talking and the pill finishes by itself | Settings → Audio → *Silence ends the turn* (`audio.vad.autoStopMs`, ms; `0` = off) | 2500 |
| Re-type the last dictation without dictating again | `hotkey.shortcuts.pasteLast` | `Shift+Alt+Z` |
| Copy the last dictation to the clipboard | `hotkey.shortcuts.copyLast` | `Shift+Alt+X` |
| AI-edit the current selection (the lens) | `hotkey.shortcuts.lens` | `Ctrl+Super+Alt+L` |
| Chimes when a dictation starts / cancels | Settings → Audio → *Dictation chimes* (`general.sounds`) | on |
| Keep the resting pill between turns | Settings → General → *Resting bar* (`general.overlayRestBar`) | off |
| The pill follows my cursor vs. parks in a corner | Settings → General → *Overlay position* (`general.overlayPosition`: `cursor` \| `floating` \| `top-left` \| `top-right` \| `top` \| `bottom` \| `free`) | cursor |
| The pill matches my OS light/dark theme | Settings → General (`general.overlayFollowSystemTheme`) | off |
| Change the pill's color | `general.overlayTint` (any CSS color) | reference dark |
| A custom backdrop image on the overlay | `general.overlayBackdrop` (path or URL) | none |
| Pill shape | `general.overlayStyle`: `pill` \| `rect` \| `blob` | pill |
| Don't think, just capture the meeting | Settings → General → *Meeting mode* (`general.meetingMode`) — keeps the session open, inserts each utterance as you go | off |
| Keep the audio of every dictation | `general.saveAudio` (+ `general.recordingsDir`, empty = `<userData>/recordings`) | off |
| Cap a runaway dictation | `audio.maxRecordingLengthMs` (warns 1 min before; `0` = unlimited) | 20 min |

**Accessibility notes:** hold mode + chimes + a parked overlay is the lowest-effort setup for
repeated strain injuries; toggle mode + auto-stop needs the fewest keys pressed at all. Esc always
cancels the current dictation.

---

## 2. "I want my own shortcuts and vocabulary"

**The dictionary** (Settings → Dictionary): entries are terms as they *should* appear; the fuzzy
matcher fixes what the STT *said* — `WhisperFlow` fixes `wishper flow`, `Kubernetes` fixes
`kubernetties`. One edit per word, no training. `dictionaryAutoLearn` (default on) watches you
re-type a word after dictation and turns the correction into an entry automatically.

**Voice commands** (`commands` array): phrases spoken during dictation that act instead of being
typed.

```jsonc
"commands": [
  { "id": "c1", "phrase": "insert signature", "action": "insert", "payload": "— Naman Dhakad" },
  { "id": "c2", "phrase": "scratch that",     "action": "undo" },
  { "id": "c3", "phrase": "new paragraph",    "action": "insert", "payload": "\n\n" }
]
```

Actions are `undo` (wipe the last dictation), `insert` (type a fixed payload), and `replace`
(replace the utterance with the payload). `undo` is the one that saves you when dictation
mishears the whole sentence.

**Per-app behavior — Modes** (Settings → Modes): match an app by name, window title, or URL
substring (`"gmail"`, `"code.exe"`, `"Linear"`), then override the tone, cleanup level, format,
email signature, extra instructions, and even the *dictionary* for that app only:

```jsonc
"modes": { "profiles": [{
  "id": "slack-casual", "name": "Slack", "match": "slack", "enabled": true,
  "tone": "casual", "format": "casual", "cleanup": "light",
  "dictionary": [ { "id": "s1", "term": "WhisperFlow" } ]
}] }
```

---

## 3. "I want per-language settings"

`stt.language` is your default; `stt.languages` is the set you speak; `stt.autoDetect` decides
whether the model guesses. The resolution rule (in `resolveSttLanguage`):

- auto-detect **on** → `"auto"` (model guesses freely)
- auto-detect off + **exactly one** language → that language is *forced* (no guessing)
- auto-detect off + several languages → auto-detect restricted to that set

Pair this with a Mode per language? Not yet — Modes override polish, not STT language (see the
gap list).

---

## 4. "I want to bring my own models" (BYOK + local weights)

**STT, local (default):** whisper.cpp. Pick a model in Settings → Models; the catalog knows each
model's size and quality tier, and downloads are resumable. Add unknown GGUF/GGML models with the
`models.custom` entries (`role: "stt"` or `"polish"`, repo + file + URL), which keeps you off the
upgrade treadmill of whatever we ship.

**STT, cloud:** Settings → Models → provider, key, model. `stt.cloud.provider`:
`groq` (free tier: whisper-large-v3-turbo), `mistral` (Voxtral 3, pay-per-minute), `openai`
(gpt-transcribe), `deepgram` (Nova-3, `$200 credit, smart_format free`), or `custom`
(OpenAI-compatible endpoint). Override `stt.cloud.baseUrl` for a private endpoint.
`stt.fallback` (`"none"|"local"|"cloud"`) decides what happens when the primary fails — the
default `"none"` means a failed local run *never silently uploads your audio anywhere*.

**Polish (the rewrite pass):** `polish.provider` —
- `"llama-local"` (default): a local GGUF via node-llama-cpp. The CUDA backend ships as an
  optional extra; most machines use the Vulkan or CPU backend.
- `"openai-compat"`: any OpenAI-compatible chat endpoint. `polish.remote.provider` has presets for
  `groq` (gpt-oss-20b free tier), `openrouter` (free endpoints), `openai`, `mistral`, `ollama`
  (self-hosted — `ollama pull qwen2.5:3b`), or `custom`.
- `"none"`: no AI rewrite at all — the offline cleanup pass only.

`polish.fallbackToLocal: true` (default) means a dead cloud endpoint degrades to local, then to
offline cleanup: **dictation is never blocked by polish failing.** If the cloud polish fails after
producing text locally, the local transcript is what gets pasted (the failure contract).

**Tuning the rewrite:** `polish.tone` (`neutral`|`casual`|`professional`|`custom`),
`polish.customInstructions` (free-form, used with `custom`), `polish.format`
(`formatted`|`raw`|`casual`|`lowercase`), `polish.cleanup` (`none`|`light`|`medium`|`high`|`full`),
`polish.temperature` (0–2; low keeps it faithful).

---

## 5. "I want it private, and I want it backed up"

`privacy.localOnly: true` (the default) hard-blocks every network provider — no cloud STT, no
cloud polish, no telemetry. There is nothing to consent to.

**Backups:** Settings → Backup → Export writes `{config, history, scratchpad}` as JSON; Import
restores all three. **Recordings and the dictionary travel inside `config.json`** (dictionary) and
your recordings folder (audio), so an exported backup + the recordings folder is a full move.

---

## 6. Verified recipes (copy-paste into config.json — merge into the top level)

### The meeting note-taker
Meeting mode keeps the session open and appends each utterance, so you never restart the pill
between speakers.
```jsonc
{ "general": { "meetingMode": true, "saveAudio": true },
  "polish": { "cleanup": "medium", "format": "formatted" },
  "stt": { "provider": "cloud", "cloud": { "provider": "groq", "apiKey": "gsk_…" } } }
```

### The developer (raw text in the IDE, prose everywhere else)
Two Modes — no AI formatting where you're writing code, normal polish in chat.
```jsonc
{ "polish": { "tone": "professional", "cleanup": "medium" },
  "modes": { "profiles": [
    { "id": "ide", "name": "Code editors", "match": "code", "enabled": true,
      "format": "raw", "cleanup": "none",
      "customInstructions": "never add punctuation, never capitalize" },
    { "id": "chat", "name": "Chat apps", "match": "slack", "enabled": true,
      "tone": "casual", "format": "casual" }
  ] } }
```

### The non-native speaker (forced language + vocabulary)
```jsonc
{ "stt": { "language": "en", "languages": ["en"], "autoDetect": false },
  "dictionary": [
    { "id": "d1", "term": "Kubernetes" },
    { "id": "d2", "term": "RPC" },
    { "id": "d3", "term": "QWERTY" }
  ],
  "polish": { "cleanup": "light" } }
```
Forcing the language (autoDetect off, exactly one) is the single biggest accuracy win for an
accent — whisper stops second-guessing.

### Accessibility / RSI setup
```jsonc
{ "hotkey": { "mode": "hold", "pushToTalk": "F8" },
  "general": { "sounds": true, "overlayRestBar": true, "overlayPosition": "bottom" },
  "audio": { "vad": { "sensitivity": 0.65 } } }
```

### Privacy-paranoid (nothing ever leaves the machine)
```jsonc
{ "privacy": { "localOnly": true },
  "stt": { "provider": "whispercpp-local", "fallback": "none" },
  "polish": { "provider": "llama-local", "fallbackToLocal": true } }
```

### Cheapest cloud setup (a free Groq key does both)
```jsonc
{ "privacy": { "localOnly": false },
  "stt": { "provider": "cloud", "cloud": { "provider": "groq", "apiKey": "gsk_…" } },
  "polish": { "provider": "openai-compat",
    "remote": { "provider": "groq", "apiKey": "gsk_…", "model": "openai/gpt-oss-20b" } } }
```

### The email setup (Gmail gets a signature, nothing else does)
```jsonc
{ "polish": { "emailSignature": true, "emailSignatureText": "— Sent from my WhisperFlow" },
  "modes": { "profiles": [
    { "id": "gmail", "name": "Gmail", "match": "gmail", "enabled": true,
      "tone": "professional", "emailSignature": "on" }
  ] } }
```
(emailSignature only ever appends when the target app is detected as an email client.)

---

## 7. What you can't configure yet (the honest gap list)

Ranked by how often it's asked for, with where it would live:

1. **Per-language / per-mode STT models.** Modes override polish only; a Mode that also picks the
   model (a big model for English, a small fast one for chat) needs `ModeProfile.stt` —
   `packages/shared/src/config.ts` + `packages/engine/src/modes/resolve.ts`.
2. **Dictionary import/export.** Entries are editable one-by-one; a CSV/JSON share for vocabulary
   packs (medical, legal, a team's jargon) is a few hours on the Dictionary tab. This is the
   single biggest team-level ask.
3. **Post-dictation hooks.** No "after each dictation, run X on the text" (pipe to a script,
   append to a scratchpad, send an HTTP webhook). An optional `hooks` section + a main-process
   runner would make WhisperFlow a pipeline tool, not just an input method.
4. **Sound customization.** The start/cancel chimes are generated WAVs (`apps/desktop/resources/sounds`);
   an import-your-own path is one IPC handler away.
5. **Multiple profiles (work / home).** One config per user; a profile switcher is a config-layer
   feature, not a schema one (`profiles: { [name]: WhisperFlowConfig }` + an active pointer).
6. **Advanced whisper flags.** No beam size / temperature / `--no-speech-threshold` exposure —
   `packages/engine/src/providers/stt/WhisperCppProvider.ts` takes options from config only.
7. **Keyboard navigation in Settings.** Tabs are reachable, but the overlay and lens are pointer-first.
8. **Plugin/theming share.** Themes are per-field (tint, backdrop); there's no theme
   export/import bundle.

If the thing you want is here, open a feature request with your *outcome* (not just the
implementation) — the team often finds a better path when the need is written down.

---

*Schema-level reference: `packages/shared/src/config.ts` is the source of truth — every field
above is defined there with its zod validator, and this document is regenerated by hand when it
changes. If they disagree, the code wins; please file an issue so the doc follows.*
