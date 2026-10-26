import { app } from "electron";
import type { WhisperFlowConfig } from "@whisperflow/shared";

/**
 * Auto-update wiring. Publishes to GitHub Releases (electron-builder.yml);
 * settings/history live in userData and survive updates untouched.
 * Checks at launch, every 6 hours, and on demand via checkNow().
 *
 * Delta efficiency: the release artifacts include .blockmap files, so
 * electron-updater downloads only the changed blocks between versions rather
 * than the whole installer.
 *
 * Safety: a *major* version bump is never auto-installed (breaking changes go
 * through the release notes), and the channel (stable/beta) follows the user's
 * config so beta opt-in is explicit.
 */

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string; releaseNotes?: string }
  | { state: "not-available"; version: string }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

interface UpdaterDeps {
  /** Latest config — used for the channel preference. */
  getConfig(): Promise<WhisperFlowConfig>;
  /** Pushes status into the settings window for the update banner. */
  send(status: UpdateStatus): void;
}

/** The slice of electron-updater's AppUpdater this file touches. */
interface ElectronUpdater {
  logger: unknown;
  autoDownload: boolean;
  channel: string;
  setFeedURL(url: unknown): void;
  on(event: "update-available" | "update-not-available" | "update-downloaded", handler: (info: UpdateInfo) => void): unknown;
  on(event: "error", handler: (err: unknown) => void): unknown;
  checkForUpdates(): Promise<{ updateInfo?: { version?: string } } | null>;
  quitAndInstall(silent?: boolean, forceRunAfter?: boolean): void;
}

/** Result info the updater hands back on its events. */
interface UpdateInfo {
  version?: string;
  releaseNotes?: string;
}

let checkNow: () => Promise<string> = async () => "dev build — updates skipped";
let installNow: () => void = () => {};

export function initUpdater(log: (...args: unknown[]) => void, deps?: UpdaterDeps): void {
  if (!app.isPackaged) {
    log("updater: skipped (dev build)");
    deps?.send({ state: "not-available", version: app.getVersion() });
    return;
  }
  void (async () => {
    try {
      // electron-updater exports autoUpdater as an Object.defineProperty
      // *getter*, which Node's CJS↔ESM interop cannot see as a named export —
      // so the namespace has no `autoUpdater`, and the classic
      // `const { autoUpdater } = await import(...)` destructures undefined.
      // The CJS `default` export is the real module object. Handle both shapes
      // (this only fails in a *packaged* build, since dev builds skip the path).
      const mod = (await import("electron-updater")) as {
        autoUpdater?: ElectronUpdater;
        default?: { autoUpdater?: ElectronUpdater };
      };
      const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater;
      if (!autoUpdater) {
        throw new Error(
          "electron-updater did not export autoUpdater " +
            `(keys: ${Object.keys(mod).slice(0, 8).join(",")}, ` +
            `default keys: ${mod.default ? Object.keys(mod.default).slice(0, 8).join(",") : "none"})`,
        );
      }
      autoUpdater.logger = null;
      // electron-builder only writes resources/app-update.yml when it PUBLISHES
      // (our releases are uploaded separately), so point electron-updater at the
      // repo ourselves. Keep in sync with the `publish` block in
      // electron-builder.yml — the repo is public, so no token is needed.
      try {
        autoUpdater.setFeedURL({ provider: "github", owner: "namandhakad712", repo: "whisperflow" });
      } catch (err) {
        log("updater: setFeedURL failed (app-update.yml will be used if present):", String(err).slice(0, 100));
      }
      autoUpdater.autoDownload = true;

      // Channel follows the user's preference (stable default).
      if (deps) {
        const cfg = await deps.getConfig().catch(() => null);
        autoUpdater.channel = cfg?.updates?.channel === "beta" ? "beta" : "latest";
        log(`updater: channel=${autoUpdater.channel}`);
      }

      let downloaded: string | null = null;

      autoUpdater.on("update-available", (info) => {
        deps?.send({ state: "available", version: info.version ?? "?" });
        log(`updater: v${info.version} available — downloading in the background`);
      });
      autoUpdater.on("update-not-available", (info) => {
        deps?.send({ state: "not-available", version: info?.version ?? app.getVersion() });
        log("updater: up to date —", info?.version ?? app.getVersion());
      });
      autoUpdater.on("error", (err) => {
        const message = String(err).slice(0, 140);
        deps?.send({ state: "error", message });
        log("updater: error:", message);
      });
      autoUpdater.on("update-downloaded", (info) => {
        const version = info?.version ?? "?";
        const nextMajor = parseInt(version.split(".")[0] || "0", 10);
        const curMajor = parseInt(app.getVersion().split(".")[0] || "0", 10);
        //Major releases carry breaking changes — never auto-install them.
        if (!isNaN(nextMajor) && nextMajor > curMajor) {
          log(`updater: v${version} is a major (breaking) release — not auto-installing; get it manually`);
          deps?.send({
            state: "available",
            version,
            releaseNotes: "Major release — install it manually from GitHub Releases when you're ready.",
          });
          return;
        }
        downloaded = version;
        deps?.send({ state: "downloaded", version });
        log("updater: update downloaded, installs on quit");
      });

      const check = async (): Promise<string> => {
        try {
          const r = await autoUpdater.checkForUpdates();
          return r?.updateInfo?.version ? `latest: ${r.updateInfo.version}` : "up to date";
        } catch (err) {
          return `check failed: ${String(err).slice(0, 80)}`;
        }
      };
      checkNow = check;
      installNow = () => {
        if (downloaded) autoUpdater.quitAndInstall(false, true);
        else log("updater: nothing downloaded yet — cannot install");
      };
      await check();
      setInterval(() => void check(), 6 * 60 * 60 * 1000);
    } catch (err) {
      log("updater: unavailable:", err);
    }
  })();
}

export function checkForUpdatesNow(): Promise<string> {
  return checkNow();
}

/** Installs a downloaded update and relaunches. No-op when nothing is staged. */
export function installDownloadedUpdate(): void {
  installNow();
}
