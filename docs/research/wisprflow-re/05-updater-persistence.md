# Wispr Flow — Updating system & non-SQLite persistence (RE)

Install had moved on to app-1.6.1297 while extracting; real Electron userData is `%APPDATA%\Wispr Flow` (Roaming), not Local.

# A. UPDATING SYSTEM

## A1. Squirrel mechanics (exact log lines)
- Update.exe invoked as `--update https://dl.wisprflow.com/wispr-flow/win32/x64`. Fetches `RELEASES?id=WisprFlow&localVersion=<cur>&arch=amd64`, downloads `WisprFlow-<ver>-full.nupkg`, writes `app-<ver>` stage dir, rigs execution stub, `fixPinnedExecutables`, "Fixing up tray icons", `cleanDeadVersions: exclude current + new version folders`.
- Observed chain: 1.6.1174→1209→1253→1264→1297. A nupkg retry failed ("connection was aborted"), a lowercase retry 404'd, then "Failed to apply updates, falling back to full updates" and a fresh RELEASES+full-nupkg pass succeeded.
- Staging user ID persistent: "Using existing staging user ID: 46e75a22-…".
- CheckForUpdate runs Electron-driven `--checkForUpdate`; observed cadence ≈ every 2h56m.
- ProcessStart.log: `--processStartAndWait Wispr Flow.exe` → root stub waits on the versioned app (first run and after each version bump).
- Squirrel hook errors tolerated: "Couldn't run Squirrel hook, continuing: … Win32Exception: Access is denied".

## A2. In-app updater (module 63364)
- Constants: base `https://dl.wisprflow.com`, feed builder `${base}/${channel}/${platform}/${arch}` (+ `/RELEASES.json` on mac); channel `wispr-flow`, override channel `wispr-flow-override`. Server type: mac "json", win "default".
- Interval constants: 30min, 5h, 10min, **20min**, 3h, 90min, **24h**, 60min.
- Cadence: `pollIntervalMinutes` = internal user ? 10min : `Math.random()*(5h-30min)+30min`; then check immediately, then poll. MDM registry `HKLM\SOFTWARE\Policies\WisprAI\Flow` value `UpdateFrequency` ∈ {auto,weekly,bi-weekly,monthly} gates checks; `lastSuccessfulUpdateCheckAt` persisted in `prefs.updateRetry`.
- Channel/staging: internal users alternate beta/prod each check; normal users first `fetch(<override url>)` → JSON {overrideActive, overrideVersion} and switch feed when active; failures fall back to prod.
- On update-available: Squirrel downloads via Update.exe (Electron's Squirrel autoUpdater), **no user prompt during download**. On "update-downloaded": schedules apply with backoff `20min * 2^retryCount` (20/40/80) + random stagger up to 1h; retries capped 3 per version, then 24h cooldown. **Apply deferred while**: dictation active, meeting session active, meeting audio hold (60min), re-staging, or (flag DeferUpdatesWhileActive) user engaged (window focused + idle<300s). **After 3h deferral → `promptRestartAtCeiling`**: dialog "Update ready" / **"A new version of Wispr Flow is ready"**, buttons "Later"/"Restart now". `applyUpdate()` → persist isUpdating/showHubAfterUpdate, `autoUpdater.quitAndInstall()`. 5 consecutive errors → error log; ignores Squirrel "is already running".
- MSI variant (`isMsiInstall()`): packaged + no Update.exe + `.installInfo.json` marker → "the machine updater handles updates, Squirrel is not used"; machine state polled every 5min; apply via runMsiUpdaterTask.
- **No app-level rollback** — only Squirrel's old-version-dir retention via cleanDeadVersions exclusions.

## A3. Shortcuts
- First run `--squirrel-install` → Update.exe `--createShortcut=Wispr Flow.exe --icon <exe>` → Start Menu `…\Wispr AI\Wispr Flow.lnk` + Desktop `\Wispr Flow.lnk` (toastActivatorCSLID cbb00cbd-…).
- Run-on-login: first `app.setLoginItemSettings({openAtLogin:false})`, then spawns Update.exe `--createShortcut=<exe> --shortcut-locations Startup --icon <exe>` (→ `Start Menu\Programs\Startup\Wispr Flow.lnk`); disabling runs `--removeShortcut … --shortcut-locations Startup`. MSI installs use `app.setLoginItemSettings`. IPC `app:setOpenAtLogin`; on login the hub window is hidden ("Not showing hub window at launch: app was opened at login").
- Post-update `--squirrel-updated`: creates Desktop+StartMenu shortcuts if a Desktop lnk already existed, else StartMenu only. `--squirrel-uninstall` → removeShortcut; `--squirrel-obsolete` → exit(0).

## A4. Feature flags
- Cache `Roaming\Wispr Flow\feature-flags-cache.json` (87 KB): `{anonymous:{schemaVersion:1,kind:"anonymous",distinctId,fetchedAt,flags:{…444…}}, identified:{kind:"identified",distinctId,fetchedAt,flags:{…487…}}}`; flag objects `{enabled, variant?, payload?}`.
- Written by an electron-store wrapper `({name:"feature-flags-cache", clearInvalidConfig:true})`; reader validates schemaVersion===1, kind, distinctId, fetchedAt, flags; "identified" deleted on sign-out.
- Source: **PostHog** (phc_… key, host us.i.posthog.com with relay ph.wisprflow.ai). `featureFlagsPollingInterval` default **30 000 ms**; refresh also event-driven. A WorkOS SDK is also bundled (mid-migration; "posthog-migration-test" flag present).

# B. PERSISTENCE BEYOND SQLITE

## B1. backups/
- `join(userData,"backups")`; cron `"0 12 * * *"` (daily noon local).
- Job: flow.sqlite missing → skip; `PRAGMA wal_checkpoint(TRUNCATE)` (skip if busy); copyFile → `backups/.backup-<ISO>.sqlite.tmp`; open READONLY + `PRAGMA integrity_check`; if "ok" rename tmp→`backup-<ISO>.sqlite` (EBUSY/EPERM retried 5× with backoff); delete all `.backup-*` `.tmp`; delete every `backup-*.sqlite` **except the newest (retention = 1)**.
- Actual dir: 8 daily runs 17..27-10; only `backup-2026-10-27T06-30-00.217Z.sqlite` (75 MB) survives; 7 orphaned `.tmp-shm`/`.tmp-wal` pairs remain (their cleanup filter matches files *ending* in ".tmp" only).

## B2. meetings/
`Roaming\Wispr Flow\meetings\` **exists but is empty**. No meetings path constant or .opus writer found in the main bundle — Opus is used only in-memory for dictation streaming.

## B3. JSONL sidecars (ax-inspect-lib.mjs)
"local, unencrypted flow.sqlite … plus dev-only JSONL sidecars written by the app, joined by dictation uuid." `sidecarTracePaths(logsDir)` → `paste-formatting-debug.jsonl`, `proper-noun-debug.jsonl`, `textbox-context-debug.jsonl`, `insertion-verification-debug.jsonl`, `dictation-event-debug.jsonl`, `edited-text-debug.jsonl`, `context-capture-debug.jsonl`. Loaders key a `Map<uuid, line>` and join SQLite rows via `r.transcriptEntityId`. Launched via `utilityProcess.fork` on an ephemeral loopback port. Logs dir on this machine is empty (dev-only).

## B4. Local Storage / Preferences / session.json
- `session.json`: single key `sb-dodjkfqhwrzqjwkfnthl-auth-token` = Supabase GoTrue session (JWT + refresh_token, expires_in 604800). Supabase URL `https://dodjkfqhwrzqjwkfnthl.supabase.co`.
- `Preferences`: `{"electron":{"media":{"device_id_salt":"…"}},"spellcheck":{"dictionaries":["en-US"]}}`. Local State / Local Storage essentially empty.
- `config.json` (40 KB) is the main non-SQLite store: voiceProfile, notifications, nudge, activationCron, syncCoordinator, prefs{sessionId, anonymousId, deviceId, appLastClosedTime, firstLaunchTs, activeDictationSession, version, isUpdating, showHubAfterUpdate, updateRetry, cache}, helperLaunch, calendarSync, degradedNetwork, autodetectReminder*.
- Division: **flow.sqlite = transcripts/dictations/meetings content; config.json = UI/feature/lifecycle prefs; session.json = auth**.

# CANNOT DETERMINE
1. What writes meetings/ (empty dir; no path constant or audio-file writer found).
2. Exact write cadence of feature-flags-cache.json (observed fetchedAt delta ~10 days between entries).
3. PostHog vs WorkOS as the live flag source (both bundled).
4. Any app-visible update-rollback path (none in code).
5. Origin of `@whisperflowdesktop-updater\installer.exe` (427 MB; dir name matches electron-updater's `<appName>-updater` cache convention).
