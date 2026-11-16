import { useEffect, useState } from "react";
import type { AppUpdateStatus } from "@whisperflow/shared";
import { PanelLeftClose, PanelLeftOpen, Palette } from "lucide-react";
import { useAppVersion } from "../shared/useAppVersion";
import { useSettings } from "./store";
import { GeneralTab } from "./tabs/GeneralTab";
import { ShortcutsTab } from "./tabs/ShortcutsTab";
import { AudioTab } from "./tabs/AudioTab";
import { ModelsTab } from "./tabs/ModelsTab";
import { DictionaryTab } from "./tabs/DictionaryTab";
import { CommandsTab } from "./tabs/CommandsTab";
import { HooksTab } from "./tabs/HooksTab";
import { ProfilesTab } from "./tabs/ProfilesTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { PrivacyTab } from "./tabs/PrivacyTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { AboutTab } from "./tabs/AboutTab";
import { InsightsTab } from "./tabs/InsightsTab";
import { ScratchpadTab } from "./tabs/ScratchpadTab";
import { ModesTab } from "./tabs/ModesTab";
import { OverlayTab } from "./tabs/OverlayTab";
import { DiagnoseTab } from "./tabs/DiagnoseTab";
import { Onboarding } from "./Onboarding";
import { DEFAULT_ROUTE, PAGES, pageHome, resolveRoute, type SettingsPage } from "./nav";

/**
 * Settings shell.
 *
 * Five pages, each with its own sub-nav. The previous flat sixteen-item rail
 * read as a wall of options; grouping by intent fixed that without deleting a
 * single control. `#/advanced`-style routes still work — see nav.ts.
 */

function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, "");
}

/** First-run gate. Onboarding's finish/skip writes "wf-onboarded"; nothing
 *  else ever clears it, so a completed user never sees onboarding again —
 *  not on relaunch, not by hand-navigating to #/onboarding. */
function hasOnboarded(): boolean {
  try {
    return localStorage.getItem("wf-onboarded") === "1";
  } catch {
    // Storage unavailable (private mode) — don't trap the user in onboarding.
    return true;
  }
}

type Skin = "nocturne" | "classic" | "dawn";

function applySkin(skin: Skin): void {
  const root = document.documentElement;
  if (skin === "classic") {
    delete root.dataset.theme;
    root.dataset.theme = "classic";
    document.body.classList.remove("light");
  } else if (skin === "dawn") {
    delete root.dataset.theme;
    document.body.classList.add("light");
  } else {
    delete root.dataset.theme;
    document.body.classList.remove("light");
  }
  try {
    localStorage.setItem("wf-skin", skin);
  } catch {
    /* private mode */
  }
}

function readSkin(): Skin {
  try {
    const saved = localStorage.getItem("wf-skin");
    if (saved === "classic" || saved === "dawn" || saved === "nocturne") return saved;
    // migrate the older light-mode flag
    if (localStorage.getItem("wf-mode") === "light") return "dawn";
  } catch {
    /* first run */
  }
  return "nocturne";
}

const SKIN_LABEL: Record<Skin, string> = {
  nocturne: "Nocturne",
  classic: "Classic",
  dawn: "Dawn",
};

export function App() {
  // First run starts on onboarding (lazily checked so a completed user is
  // never re-triggered, whatever the hash says); everyone else resumes on
  // whatever screen the URL points at.
  const [rawRoute, setRawRoute] = useState(() => (hasOnboarded() ? currentRoute() : "onboarding"));
  const [collapsed, setCollapsed] = useState(false);
  const [skin, setSkin] = useState<Skin>(() => readSkin());
  const version = useAppVersion();
  const loadConfig = useSettings((s) => s.loadConfig);

  useEffect(() => {
    void loadConfig();
    applySkin(readSkin());
    const onHash = () => setRawRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    const unsubNavigate = window.whisperflowExtras.app.onNavigate((r) => {
      const target = r.replace(/^\//, "");
      window.location.hash = `/${target}`;
      setRawRoute(target);
    });
    if (!hasOnboarded()) window.location.hash = "/onboarding";
    return () => {
      window.removeEventListener("hashchange", onHash);
      unsubNavigate();
    };
  }, [loadConfig]);

  if (rawRoute === "onboarding" && !hasOnboarded()) return <Onboarding />;

  // An empty hash lands on the first screen, not on a blank page.
  const { page, sub, route } = resolveRoute(rawRoute || DEFAULT_ROUTE);

  const cycleSkin = () => {
    const next: Skin = skin === "nocturne" ? "classic" : skin === "classic" ? "dawn" : "nocturne";
    setSkin(next);
    applySkin(next);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* top bar with the pill row */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="flex h-8 items-center gap-2 rounded-full bg-pill px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {!collapsed && <span>Toggle sidebar</span>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleSkin}
            aria-label={`Theme: ${SKIN_LABEL[skin]}. Click to change.`}
            className="flex h-8 items-center gap-2 rounded-full bg-pill px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Palette size={15} />
            <span>Theme · {SKIN_LABEL[skin]}</span>
          </button>
        </div>
      </div>

      <UpdateBanner />

      <div className="flex min-h-0 flex-1">
        {/* rail — 192px, items 36px, 6px radius, icon+label */}
        <aside
          className={`flex shrink-0 flex-col gap-0.5 overflow-y-auto bg-rail px-3 py-3 transition-[width] ${
            collapsed ? "w-[68px]" : "w-[216px]"
          }`}
          aria-label="Sections"
        >
          {!collapsed && (
            <p className="px-3 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-rail-text-dim">
              WhisperFlow
            </p>
          )}
          {PAGES.map((item, i) => (
            <RailItem
              key={item.id}
              active={page.id === item.id}
              collapsed={collapsed}
              label={item.label}
              href={`#/${pageHome(item)}`}
              first={i === 0}
            >
              <item.icon size={17} strokeWidth={1.75} />
            </RailItem>
          ))}
          <div className="mt-auto px-3 pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-rail-text-dim">
            {collapsed ? `v${version}` : <>local-first · apache-2.0<br />v{version} · no telemetry</>}
          </div>
        </aside>

        <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg px-8 py-7">
          <div className="mx-auto min-w-0 max-w-2xl">
            <SubNav page={page} active={sub.id} />
            {sub.id === "general" && <GeneralTab />}
            {sub.id === "audio" && <AudioTab />}
            {sub.id === "shortcuts" && <ShortcutsTab />}
            {sub.id === "overlay" && <OverlayTab />}
            {sub.id === "models" && <ModelsTab />}
            {sub.id === "advanced" && <AdvancedTab />}
            {sub.id === "modes" && <ModesTab />}
            {sub.id === "profiles" && <ProfilesTab />}
            {sub.id === "dictionary" && <DictionaryTab />}
            {sub.id === "commands" && <CommandsTab />}
            {sub.id === "history" && <HistoryTab />}
            {sub.id === "insights" && <InsightsTab />}
            {sub.id === "scratchpad" && <ScratchpadTab />}
            {sub.id === "diagnose" && <DiagnoseTab />}
            {sub.id === "hooks" && <HooksTab />}
            {sub.id === "privacy" && <PrivacyTab />}
            {sub.id === "about" && <AboutTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Sub-navigation for one page. Rendered above the tab body, which keeps
 * owning its own `PageHeader` — one screen per view, unchanged.
 */
function SubNav({ page, active }: { page: SettingsPage; active: string }) {
  return (
    <div className="mb-5 border-b border-line pb-4">
      <p className="text-[12px] leading-5 text-ink-dim">{page.hint}</p>
      <nav
        className="mt-3 flex flex-wrap items-center gap-1"
        aria-label={`${page.label} sections`}
      >
        {page.subs.map((s) => {
          const on = s.id === active;
          return (
            <a
              key={s.id}
              href={`#/${page.id}/${s.id}`}
              aria-current={on ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                on ? "bg-surface-2 text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * The auto-update banner. Shows only when something actionable is happening:
 * a release is downloading, or one is staged and waiting for a restart.
 * Settings and history live outside the app folder, so installing never
 * touches the user's data.
 */
function UpdateBanner() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);

  useEffect(() => {
    const unsub = window.whisperflow.updates.onStatus((s) => {
      // Errors are logged in main; the banner is for actionable states only.
      if (s.state === "error") return;
      setStatus(s);
    });
    return unsub;
  }, []);

  if (!status || status.state === "not-available" || status.state === "checking") return null;

  if (status.state === "downloaded") {
    const notes = status.releaseNotes ? summarizeReleaseNotes(status.releaseNotes) : null;
    return (
      <div className="flex shrink-0 flex-col gap-1 border-b border-accent/30 bg-accent/10 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium">
            WhisperFlow v{status.version} is ready — restart to finish installing.
          </p>
          <button
            type="button"
            onClick={() => void window.whisperflow.app.quitAndInstall()}
            className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Restart now
          </button>
        </div>
        {notes ? <p className="text-[12px] text-ink-dim">What’s new: {notes}</p> : null}
      </div>
    );
  }

  // available — downloading in the background
  if (status.state !== "available") return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-2/50 px-4 py-2.5">
      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="text-[13px] text-ink-dim">
        WhisperFlow v{status.version} is downloading… it installs when you quit.
        {status.releaseNotes ? ` ${summarizeReleaseNotes(status.releaseNotes)}` : ""}
      </p>
    </div>
  );
}

/** GitHub release notes arrive as HTML or long markdown; the banner needs the
 *  first line of substance, not the whole changelog. */
function summarizeReleaseNotes(raw: string): string {
  const text = raw
    .replace(/<\/(p|div|li|h\d)>/gi, "\n") // block ends → newlines
    .replace(/<[^>]+>/g, "") // any remaining tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  // First sentence-ish chunk up to ~180 chars, at a line boundary if possible.
  const firstLine = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return firstLine.length > 180 ? `${text.slice(0, 177)}…` : firstLine;
}

function RailItem({
  active,
  collapsed,
  label,
  href,
  children,
  first,
}: {
  active: boolean;
  collapsed: boolean;
  label: string;
  href: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <a
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center rounded-md text-[15px] font-[550] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${first ? "" : "mt-1"} ${
        active
          ? "bg-rail-active text-rail-text ring-1 ring-inset ring-white/[0.06]"
          : "text-rail-text-dim hover:bg-rail-item hover:text-rail-text"
      }`}
    >
      {children}
      {!collapsed && <span>{label}</span>}
    </a>
  );
}
