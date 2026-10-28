/**
 * Active-app classification — replicated from the reference app (v1.6.1264),
 * module 1576 of its main bundle: the `AppType` enum, the exact
 * WINDOWS_*_PROCESS_NAME lists, and the `getAppType` classifier's match order.
 *
 * Their taxonomy is what *conditions* downstream behavior: email apps get a
 * signature, messaging apps strip trailing periods, AI apps skip auto-cleanup,
 * and instruct-mode auto-detect only fires outside AI/Terminal.
 *
 * One honest gap: they read identity `{appName, bundleId, url}` from a native
 * "Wispr Flow Helper" process (UIA + browser URL extraction). We read the
 * foreground process name and window title from a PowerShell one-shot, so the
 * `url` we classify from is the browser *title* (page title), not the address
 * bar URL. Every list below is theirs verbatim; the URL half of the match is
 * best-effort until we have a helper of our own.
 */

export const AppType = {
  Email: "email",
  AI: "ai",
  Terminal: "terminal",
  Other: "other",
} as const;
export type AppType = (typeof AppType)[keyof typeof AppType];

export const MeetingPlatform = {
  Teams: "teams",
  Zoom: "zoom",
  Meet: "meet",
  Webex: "webex",
  Slack: "slack",
  Discord: "discord",
  Other: "other",
} as const;
export type MeetingPlatform = (typeof MeetingPlatform)[keyof typeof MeetingPlatform];

/** Their WINDOWS_EMAIL_PROCESS_NAMES verbatim (bundleId / process-name matches). */
export const EMAIL_PROCESS_NAMES = [
  "mail", "outlook", "thunderbird", "postbox", "emclient", "mimestream", "superhuman", "gmail",
  "spark", "edisonmail", "front", "hey", "canarymail", "fastmail", "zoho", "proton", "yahoo",
  "aol", "paddle", "em client", "kiwi for gmail", "shift", "franz", "ferdium", "rambox",
  "wavebox", "notion mail",
];

/** Web-mail hosts (their list; matched against the URL/title). */
export const EMAIL_URL_HOSTS = [
  "mail.google.com", "outlook.live.com", "outlook.office.com", "mail.yahoo.com",
  "mail.proton.me", "app.hey.com", "app.shortwave.com", "m365.cloud.microsoft",
];

/** Their WINDOWS_AI_PROCESS_NAMES verbatim. */
export const AI_PROCESS_NAMES = [
  "chatgpt", "claude", "cursor", "windsurf", "code", "wispr flow", "granola", "manus", "gemini",
  "copilot", "notebooklm", "lm studio", "boltai", "ollama", "warp", "ghostty",
];

export const AI_URL_HOSTS = [
  "chatgpt.com", "claude.ai", "gemini.google.com", "chat.deepseek.com",
];

/** Their WINDOWS_TERMINAL_PROCESS_NAMES verbatim. */
export const TERMINAL_PROCESS_NAMES = [
  "windowsterminal", "cmd", "powershell", "pwsh", "warp", "alacritty", "hyper", "kitty", "wezterm",
];

/** Their WINDOWS_MESSAGING_PROCESS_NAMES verbatim. */
export const MESSAGING_PROCESS_NAMES = [
  "slack", "discord", "msteams", "whatsapp", "telegram", "signal", "messenger", "beeper",
  "wechat", "texts", "rakuten viber", "zalo", "weixin",
];

/** Their meeting platform classifier: native client process names (Windows .exe names). */
export const MEETING_PROCESS_NAMES: Record<string, MeetingPlatform> = {
  "zoom.exe": MeetingPlatform.Zoom,
  "zoom": MeetingPlatform.Zoom,
  "ms-teams.exe": MeetingPlatform.Teams,
  "ms-teams": MeetingPlatform.Teams,
  "teams.exe": MeetingPlatform.Teams,
  "teams": MeetingPlatform.Teams,
  "wemeetapp.exe": MeetingPlatform.Other,
  "webex.exe": MeetingPlatform.Webex,
  "webex": MeetingPlatform.Webex,
  "slack.exe": MeetingPlatform.Slack,
  "aircall.exe": MeetingPlatform.Other,
  "discord.exe": MeetingPlatform.Discord,
  "discord": MeetingPlatform.Discord,
};

/** Their conference-URL domains (browser meetings). */
export const MEETING_URL_HOSTS: [host: string, platform: MeetingPlatform][] = [
  ["zoom.us", MeetingPlatform.Zoom],
  ["zoomgov.com", MeetingPlatform.Zoom],
  ["meet.google.com", MeetingPlatform.Meet],
  ["teams.microsoft.com", MeetingPlatform.Teams],
  ["teams.live.com", MeetingPlatform.Teams],
  ["webex.com", MeetingPlatform.Webex],
  ["slack.com", MeetingPlatform.Slack],
  ["discord.com", MeetingPlatform.Discord],
];

/** Their Zoom Meet-code regex (also used for meeting detection in browsers). */
export const MEET_CODE_REGEX = /[a-z]{3}-[a-z]{4}-[a-z]{3}/;
export const ZOOM_CODE_REGEX = /\/(?:j|wc)\/(\d+)/;

const startsWithAny = (value: string, list: readonly string[]): boolean =>
  list.some((n) => value.startsWith(n.toLowerCase()));

/**
 * Their classifier matches the URL by prefix; we classify from the window
 * title (browser page titles, address-bar text), so host matches use
 * `includes` — "Inbox (3) - Gmail" and "mail.google.com/u/0" both classify.
 */
const includesAny = (value: string, list: readonly string[]): boolean =>
  list.some((n) => value.includes(n.toLowerCase()));

/**
 * Their classifier, order preserved: AI list (process name *and* url) → then
 * Email list (process name *and* url) → else Other. (In their build the
 * terminal list maps to Other — the Terminal value only surfaces via other
 * paths — we keep the enum and expose `isTerminalApp` for the instruct gate.)
 */
export function getAppType(processName: string, url: string = ""): AppType {
  const name = processName.toLowerCase().trim();
  const u = url.toLowerCase().trim();
  if (startsWithAny(name, AI_PROCESS_NAMES) || (u && includesAny(u, AI_URL_HOSTS))) {
    return AppType.AI;
  }
  if (startsWithAny(name, EMAIL_PROCESS_NAMES) || (u && includesAny(u, EMAIL_URL_HOSTS))) {
    return AppType.Email;
  }
  return AppType.Other;
}

/** Terminals are a separate predicate (their instruct/auto-classify gate). */
export function isTerminalApp(processName: string): boolean {
  return startsWithAny(processName.toLowerCase().trim(), TERMINAL_PROCESS_NAMES);
}

/** Their ContextualNudgeAppType mapping, messaging half. */
export function isMessagingApp(processName: string, url: string = ""): boolean {
  const name = processName.toLowerCase().trim();
  if (startsWithAny(name, MESSAGING_PROCESS_NAMES)) return true;
  const u = url.toLowerCase().trim();
  return u ? MESSAGING_PROCESS_NAMES.some((m) => u.includes(m)) : false;
}

export function isTerminalOrAi(processName: string, url: string = ""): boolean {
  return isTerminalApp(processName) || getAppType(processName, url) === AppType.AI;
}

/** Which meeting platform is running, if any (native client or browser tab). */
export function classifyMeeting(
  processName: string,
  title: string = "",
): MeetingPlatform | null {
  const exe = processName.toLowerCase().trim();
  const direct = MEETING_PROCESS_NAMES[exe] ?? MEETING_PROCESS_NAMES[exe + ".exe"];
  if (direct) return direct;
  const t = title.toLowerCase();
  for (const [host, platform] of MEETING_URL_HOSTS) {
    if (t.includes(host)) return platform;
  }
  // Their code regexes: Google Meet room codes and Zoom /j/ or /wc/ paths —
  // browser titles carry the code, so match it there too.
  if (MEET_CODE_REGEX.test(t) || MEET_CODE_REGEX.test(exe)) return MeetingPlatform.Meet;
  if (ZOOM_CODE_REGEX.test(t)) return MeetingPlatform.Zoom;
  // Native clients whose window title carries the product name.
  if (t.includes("google meet") || /\bmeet\b/.test(t)) return MeetingPlatform.Meet;
  if (/\bzoom\b/.test(t) || /zoom meeting|zoom webinar/.test(t)) return MeetingPlatform.Zoom;
  if (t.includes("microsoft teams") || /\bteams\b/.test(t)) return MeetingPlatform.Teams;
  if (/\bwebex\b/.test(t)) return MeetingPlatform.Webex;
  if (t.includes("slack huddle") || t.includes("slack call")) return MeetingPlatform.Slack;
  return null;
}
