import {
  Cpu,
  History,
  Mic,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Settings navigation.
 *
 * The rail used to list all sixteen screens flat, which read as a wall of
 * options — the most common complaint about the app's settings. Five pages
 * group them by intent; each page shows its own screens as a sub-nav, so
 * nothing was deleted, only made findable.
 *
 * Every old route (`#/general`, `#/advanced`, …) still resolves, because deep
 * links are produced by the diagnostics report and the tray menu, and because
 * users bookmark settings screens.
 */
export interface SubTab {
  /** Route segment under the page, e.g. `dictation/general`. */
  id: string;
  label: string;
}

export interface SettingsPage {
  id: string;
  label: string;
  /** One line under the page title — says what the page is for. */
  hint: string;
  icon: LucideIcon;
  /** Non-empty: a page always opens on something. */
  subs: readonly [SubTab, ...SubTab[]];
}

export const PAGES: readonly [SettingsPage, ...SettingsPage[]] = [
  {
    id: "dictation",
    label: "Dictation",
    hint: "How WhisperFlow listens and where the text goes.",
    icon: Mic,
    subs: [
      { id: "general", label: "General" },
      { id: "audio", label: "Audio" },
      { id: "shortcuts", label: "Shortcuts" },
      { id: "overlay", label: "Overlay" },
    ],
  },
  {
    id: "models",
    label: "Models",
    hint: "What turns your voice into text, and what cleans it up.",
    icon: Cpu,
    subs: [
      { id: "models", label: "Transcription" },
      { id: "advanced", label: "Writing style" },
    ],
  },
  {
    id: "personalize",
    label: "Personalize",
    hint: "Your words, your apps, your defaults.",
    icon: UserRound,
    subs: [
      { id: "modes", label: "Modes" },
      { id: "profiles", label: "Profiles" },
      { id: "dictionary", label: "Dictionary" },
      { id: "commands", label: "Snippets" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    hint: "Everything you have dictated, and what it adds up to.",
    icon: History,
    subs: [
      { id: "history", label: "History" },
      { id: "insights", label: "Insights" },
      { id: "scratchpad", label: "Scratchpad" },
    ],
  },
  {
    id: "system",
    label: "System",
    hint: "Health checks, integrations, and the privacy contract.",
    icon: ShieldCheck,
    subs: [
      { id: "diagnose", label: "Health" },
      { id: "hooks", label: "Hooks" },
      { id: "privacy", label: "Privacy" },
      { id: "about", label: "About" },
    ],
  },
] as const;

/** Old flat routes → the page/sub screen that now hosts them. */
const LEGACY: Record<string, string> = {
  general: "dictation/general",
  audio: "dictation/audio",
  shortcuts: "dictation/shortcuts",
  overlay: "dictation/overlay",
  models: "models/models",
  advanced: "models/advanced",
  modes: "personalize/modes",
  profiles: "personalize/profiles",
  dictionary: "personalize/dictionary",
  commands: "personalize/commands",
  history: "activity/history",
  insights: "activity/insights",
  scratchpad: "activity/scratchpad",
  hooks: "system/hooks",
  privacy: "system/privacy",
  about: "system/about",
  diagnose: "system/diagnose",
};

export const DEFAULT_ROUTE = "dictation/general";

export interface ResolvedRoute {
  page: SettingsPage;
  sub: SubTab;
  /** Canonical `page/sub` string, for the URL and for highlight state. */
  route: string;
}

/**
 * Resolves any route string — current (`models/advanced`), page-only
 * (`models`), legacy (`advanced`), or nonsense — to a real screen.
 */
export function resolveRoute(raw: string): ResolvedRoute {
  const cleaned = raw.replace(/^#?\/?/, "").trim();
  const candidate = LEGACY[cleaned] ?? cleaned;

  if (candidate === "onboarding") {
    // Onboarding is not a page; callers special-case it before resolving.
    return resolveRoute(DEFAULT_ROUTE);
  }

  const [pageId, subId] = candidate.split("/");
  const page = PAGES.find((p) => p.id === pageId) ?? PAGES[0];
  const sub = page.subs.find((s) => s.id === subId) ?? page.subs[0];
  return { page, sub, route: `${page.id}/${sub.id}` };
}
/** The screen a page opens on when its rail item is clicked. */
export function pageHome(page: SettingsPage): string {
  return `${page.id}/${page.subs[0].id}`;
}
