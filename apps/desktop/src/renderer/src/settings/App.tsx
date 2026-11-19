import { useEffect, useState } from "react";
import type { AppUpdateStatus } from "@whisperflow/shared";
import { PanelLeftClose, PanelLeftOpen, Moon, Sun, Search } from "lucide-react";
import { useAppVersion } from "../shared/useAppVersion";
import { useSettings } from "./store";
import { GeneralTab } from "./tabs/GeneralTab";
import { ShortcutsTab } from "./tabs/ShortcutsTab";
import { AudioTab } from "./tabs/AudioTab";
import { ModelsTab } from "./tabs/ModelsTab";
import { DictionaryTab } from "./tabs/DictionaryTab";
import { CommandsTab } from "./tabs/CommandsTab";
import { HooksTab } from "./tabs/HooksTab";
import { ExperimentsTab } from "./tabs/ExperimentsTab";
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
import { DEFAULT_ROUTE, PAGES, allScreens, pageHome, resolveRoute, type SettingsPage } from "./nav";

/**
 * Settings shell — "the console".
 *
 * Five pages, each with its own sub-nav. The Signal Standard skin: Lab (dark)
 * and Daylight (light). The copied "Classic" theme was removed with the
 * redesign — every remaining value is authored (see MOTION.md).
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

/** Lab = dark instrument, Daylight = light. Two skins, both ours. */
type Skin = "lab" | "daylight";

function applySkin(skin: Skin): void {
  const root = document.documentElement;
  delete root.dataset.theme;
  if (skin === "daylight") document.body.classList.add("light");
  else document.body.classList.remove("light");
  try {
    localStorage.setItem("wf-skin", skin);
  } catch {
    /* private mode */
  }
}

function readSkin(): Skin {
  try {
    const saved = localStorage.getItem("wf-skin");
    if (saved === "lab" || saved === "daylight") return saved;
    // migrate older flags from before the redesign
    if (localStorage.getItem("wf-skin") === "classic") return "lab";
    if (localStorage.getItem("wf-mode") === "light") return "daylight";
  } catch {
    /* first run */
  }
  return "lab";
}

const SKIN_LABEL: Record<Skin, string> = {
  lab: "Lab",
  daylight: "Daylight",
};

export function App() {
  // First run starts on onboarding (lazily checked so a completed user is
  // never re-triggered, whatever the hash says); everyone else resumes on
  // whatever screen the URL points at.
  const [rawRoute, setRawRoute] = useState(() => (hasOnboarded() ? currentRoute() : "onboarding"));
  const [collapsed, setCollapsed] = useState(false);
  const [skin, setSkin] = useState<Skin>(() => readSkin());
  const [search, setSearch] = useState("");
  const version = useAppVersion();
  const loadConfig = useSettings((s) => s.loadConfig);

  // Ctrl/⌘+K focuses the search box — the fastest way to reach any screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("wf-settings-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Search filters the flat screen list; Enter jumps straight there.
  const screens = allScreens();
  const q = search.trim().toLowerCase();
  const matches = q
    ? screens.filter(
        (s) => s.label.toLowerCase().includes(q) || s.page.toLowerCase().includes(q) || s.route.includes(q),
      )
    : [];

  const toggleSkin = () => {
    const next: Skin = skin === "lab" ? "daylight" : "lab";
    setSkin(next);
    applySkin(next);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* top bar with the pill row */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-rail px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="flex h-8 items-center gap-2 rounded-md border border-line bg-pill px-3 font-mono text-[12px] font-medium text-ink transition-colors duration-150 hover:border-phosphor/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60"
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {!collapsed && <span>panel</span>}
          </button>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            id="wf-settings-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearch("");
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Enter" && matches.length > 0) {
                window.location.hash = `/${matches[0]!.route}`;
                setSearch("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="find a setting… ^K"
            className="h-8 w-full rounded-md border border-line bg-paper-2/60 pl-9 pr-3 font-mono text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-dim/60 focus:border-phosphor/50 focus:ring-2 focus:ring-phosphor/25"
          />
          {q && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-9 z-20 max-h-64 overflow-y-auto rounded-lg border border-line bg-paper p-1 shadow-xl">
              {matches.slice(0, 8).map((s) => (
                <a
                  key={s.route}
                  href={`#/${s.route}`}
                  onClick={() => setSearch("")}
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2 font-mono text-[12.5px] text-ink hover:bg-paper-2"
                >
                  <span>{s.label}</span>
                  <span className="text-[11px] text-ink-faint">{s.page}</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSkin}
            aria-label={`Theme: ${SKIN_LABEL[skin]}. Click to change.`}
            className="flex h-8 items-center gap-2 rounded-md border border-line bg-pill px-3 font-mono text-[12px] font-medium text-ink transition-colors duration-150 hover:border-phosphor/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60"
          >
            {skin === "lab" ? <Moon size={14} /> : <Sun size={14} />}
            <span>{SKIN_LABEL[skin]}</span>
          </button>
        </div>
      </div>

      <UpdateBanner />

      <div className="flex min-h-0 flex-1">
        {/* rail — the channel strip */}
        <aside
          className={`flex shrink-0 flex-col gap-0.5 overflow-y-auto bg-rail px-3 py-3 transition-[width] ${
            collapsed ? "w-[68px]" : "w-[216px]"
          }`}
          aria-label="Sections"
        >
          {!collapsed && (
            <p className="px-3 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-rail-text-dim">
              whisperflow
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
            {sub.id === "experiments" && <ExperimentsTab />}
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
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60 ${
                on ? "bg-paper-2 text-phosphor" : "text-ink-dim hover:text-ink"
              }`}
            >
              <span className={`led ${on ? "" : "opacity-40"}`} data-on={on ? "live" : "off"} aria-hidden="true" />
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
      <div className="flex shrink-0 flex-col gap-1 border-b border-phosphor/30 bg-phosphor/10 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[13px] font-medium">
            <span className="text-phosphor">[ok]</span> whisperflow v{status.version} is ready — restart to finish installing.
          </p>
          <button
            type="button"
            onClick={() => void window.whisperflow.app.quitAndInstall()}
            className="shrink-0 rounded-lg bg-phosphor px-3.5 py-1.5 font-mono text-[13px] font-semibold text-[#07120D] transition-opacity hover:opacity-90"
          >
            restart now
          </button>
        </div>
        {notes ? <p className="font-mono text-[12px] text-ink-dim">what's new: {notes}</p> : null}
      </div>
    );
  }

  // available — downloading in the background
  if (status.state !== "available") return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-paper-2/50 px-4 py-2.5">
      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-phosphor" />
      <p className="font-mono text-[12.5px] text-ink-dim">
        whisperflow v{status.version} is downloading… it installs when you quit.
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
      className={`relative flex h-9 items-center rounded-md font-mono text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60 ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${first ? "" : "mt-1"} ${
        active
          ? "bg-rail-active text-phosphor"
          : "text-rail-text-dim hover:bg-rail-item hover:text-rail-text"
      }`}
    >
      {/* the phosphor edge: a 2px signal on the live channel */}
      {active && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-phosphor shadow-[0_0_8px_rgba(92,225,169,0.7)]"
          aria-hidden="true"
        />
      )}
      {children}
      {!collapsed && <span>{label}</span>}
    </a>
  );
}
