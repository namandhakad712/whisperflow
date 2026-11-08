# WhisperFlow — Improvement Plan (the next tier)

Status as of 2026-11-08, v0.1.31, 177 tests. Everything below is ranked by (user pain × effort),
and every item has a concrete verification. The plan is the contract: code ships only when the
verify line is green.

---

## P0 — the launch glitch (do first)

**The one visual bug users actually feel:** at dictation start, `dictationController.start()`
calls `showOverlay(undefined, "cursor")` for *instant* feedback (before the slow UIA probe), then
~5 s later `showOverlay(undefined, position)` re-anchors at the *configured* position. The pill
**teleports**. Every `setBounds` is instant (`animate: false`), so there's no motion — just a jump.

**Fix: animate the second setBounds.** Add an `animateTo(bounds)` on the overlay window that
moves the window toward the target bounds in ~180 ms with an ease (compute per-frame bounds in a
timer; the window is small, so a 60 fps frame cost is trivial), and have the *second*
`showOverlay` call in the controller pass `animate: true` when the first one already showed at the
cursor. Also run the same animation on `resizeOverlay` (the listening→card growth) so every
geometry change is a motion, not a jump.

- Files: `WindowManager.ts` (add `animateTo`), `dictationController.ts` (second show passes
  animate).
- Verify: boot smoke + the overlay harness — capture frames across a start and confirm no
  teleport frame (the pill's x changes monotonically, never 2 jumps in 2 frames).

## P1 — per-mode STT model + language (the P1 from the personas study)

Modes today override polish only. A developer wants a small fast model for Slack and a big
accurate one for Gmail. `ModeProfile` gains an optional `stt` block:

```ts
stt: z.object({
  modelId: z.string().optional(),
  language: z.string().optional(),
}).optional()
```

`resolveMode` applies it (clone config, set `stt.modelId` / `stt.language` when present);
`startDictation` already passes the mode-resolved config to the session. The Modes editor gains
two selects (model from the catalog, language from the same list as Settings → Models).

- Files: `packages/shared/src/config.ts`, `packages/engine/src/modes/resolve.ts`,
  `apps/desktop/src/renderer/src/settings/tabs/ModesTab.tsx`.
- Verify: modes.test.ts asserts the resolved session config picks the mode's model; the editor
  persists and re-reads it.

## P1 — the sub-100 MB installer

At 134.5 MB we're ~35 MB over Hex. The remaining weight is the two llama backends (Vulkan 71 MB
+ CPU 31 MB) that ship for local polish. **Make local polish a post-install download**: the
release keeps the *whisper* binaries (the actual dictation path), and the llama runtime +
GGUF downloads on first use of local polish (the model catalog already downloads models — add the
runtime binary as a catalog-style download with a progress event on the Models tab). Nobody who
uses cloud polish pays for the runtime; local-polish users get a one-time ~100 MB download with a
clear progress UI. The installer goes under ~90 MB.

- Files: `packages/engine/src/models/catalog.ts` (+ runtime entry), a new runtime-download IPC +
  Models-tab progress, `electron-builder.yml` (exclude `@node-llama-cpp/*` from `files`).
- Verify: CI release size in `gh release view`; local polish still works after the download
  (smoke boot + a polish run via the harness).

## P2 — config profiles (work / home)

`profiles: { [name]: Partial<WhisperFlowConfig> }` + an active pointer in the config root. The
General tab gets a profile picker (name, create, duplicate, delete); switching applies the
overrides over the base config. All existing config knobs keep working — a profile is a *layer*.

- Files: `packages/shared/src/config.ts`, the store, `GeneralTab.tsx`.
- Verify: schema round-trip test; a profile switch changes `polish.tone` live.

## P2 — post-dictation hook: markdown/JSON option

Hooks send the transcript as plain text today. Add a `format` field (`text` | `json`) — JSON
hooks already get `{ app, event, text, timestamp }`; the command STDIN gets `text` today and
could carry `json` as `{"text": "…"}` when chosen in the editor DOM element, not the command
line — the safety contract (never interpolate into argv) holds either way.

- Files: `packages/shared/src/config.ts`, `runHooks.ts`, `HooksTab.tsx`.
- Verify: hooks.test asserts the JSON stdin path.

## P2 — multi-device sync via the user's own cloud

OneDrive/Dropbox folder as the sync agent: the user picks a folder; WhisperFlow writes
`whisperflow-sync.json` (config + dictionary + scratchpad, never audio) on change and watches it
for remote updates (with a conflict-safe merge — last-writer-wins per top-level key). No server
of ours exists, so the privacy story holds: it's the *user's* cloud.

- Files: new `apps/desktop/src/main/sync/` module + a Sync section in Settings.
- Verify: two copies of the app pointed at one folder converge (test writes a change in one
  store, reads it in the other).

## P2 — audit log (enterprise checkbox)

`logs/audit-<date>.log`: timestamped lines "what was dictated where, what was sent where (none,
by default), what was pasted". Local-only, append-only, rotated with the log. This is the
enterprise "what leaves the machine" answer — and it's *honest*, which matches the product.

- Files: `apps/desktop/src/main/lib/audit.ts` (a small append-only writer + rotation), called
  from the controller's finish/cancel.
- Verify: a harness run produces the file with the expected lines.

## P3 — enterprise-ish niceties (only after the above)

- **MSI/SCCM-style deployment**: NSIS installer + a `.msi`-adjacent silent-install story.
  (electron-builder can emit both; verify the silent flags on CI.)
- **Managed update channel docs**: document `updates.channel` for admins; the updater already
  gates majors.

---

## The contract

1. Every item ships through the **verification loop** (shared → engine → both typechecks →
   `npm test` → electron-vite build) *before* the tag.
2. Releases keep the tag/version match (that bug cost us one wrong installer already).
3. **No new dependency without a size justification** — the sub-100 MB diet is a standing rule.
4. The plan lives in `docs/ROADMAP.md` after P0; items move to `done` with a release note.