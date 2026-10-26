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
      const { autoUpdater } = await import("electron-updater");
      autoUpdater.logger = null;
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
