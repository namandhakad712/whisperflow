import { useEffect, useMemo, useState } from "react";
import type { AppUpdateStatus } from "@whisperflow/shared";
import { Moon, Sun, Command } from "lucide-react";
import { useAppVersion } from "../shared/useAppVersion";
import { CommandPalette, type PaletteAction } from "../shared/CommandPalette";
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
import { THEMES, getTheme, readThemeId, applyTheme } from "./themes";
import { Scramble } from "./useScramble";
import { DEFAULT_ROUTE, PAGES, pageHome, resolveRoute, type SettingsPage } from "./nav";

/**
 * Settings shell — "the console".
 *
 * Five pages, each with its own sub-nav, plus the command palette (⌘K):
 * the patch bay that jumps to any screen or runs a live action. The Signal
 * Standard skin: Lab (dark) and Daylight (light).
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

/* The Theme Press (v0.1.45): six themes, each a print process with its
 * own type cast — see themes.ts. The old two-skin toggle is retired;
 * saved wf-skin values migrate (lab/daylight are theme ids too). */

export function App() {
  // First run starts on onboarding (lazily checked so a completed user is
  // never re-triggered, whatever the hash says); everyone else resumes on
  // whatever screen the URL points at.
  const [rawRoute, setRawRoute] = useState(() => (hasOnboarded() ? currentRoute() : "onboarding"));
  const [themeId, setThemeId] = useState<string>(() => readThemeId());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const version = useAppVersion();
  const loadConfig = useSettings((s) => s.loadConfig);

  // Ctrl/⌘+K opens the command palette — the patch bay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void loadConfig();
    applyTheme(readThemeId());
    const onTheme = () => setThemeId(readThemeId());
    window.addEventListener("wf-theme-changed", onTheme);
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
      window.removeEventListener("wf-theme-changed", onTheme);
      unsubNavigate();
    };
  }, [loadConfig]);

  // An empty hash lands on the first screen, not on a blank page.
  const { page, sub, route } = resolveRoute(rawRoute || DEFAULT_ROUTE);

  // The topbar button cycles the press; the picker (General) and the
  // palette pick directly. All three roll the console on `scope`.
  const cycleTheme = () => {
    const i = THEMES.findIndex((t) => t.id === themeId);
    const next = THEMES[(i + 1) % THEMES.length]!;
    applyTheme(next.id);
    setThemeId(next.id);
    window.dispatchEvent(new Event("wf-theme-changed"));
  };

  // Live actions for the palette. (All hooks must run before the onboarding
  // early-return below — React forbids conditional hook counts.)
  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      ...THEMES.map((t) => ({
        id: `act:theme:${t.id}`,
        label: `theme: ${t.label} — ${t.blurb}`,
        group: "actions",
        hint: "theme",
        run: () => {
          applyTheme(t.id);
          setThemeId(t.id);
          window.dispatchEvent(new Event("wf-theme-changed"));
        },
      })),
      {
        id: "act:onboarding",
        label: "replay onboarding",
        group: "actions",
        hint: "setup",
        run: () => {
          try {
            localStorage.removeItem("wf-onboarded");
          } catch {
            /* private mode — onboarding guard already treats it as done */
          }
          window.location.hash = "/onboarding";
          setRawRoute("onboarding");
        },
      },
    ],
    [themeId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // First-run gate — AFTER every hook, so the hook count never varies.
  if (rawRoute === "onboarding" && !hasOnboarded()) return <Onboarding />;

  return (
    <div className="flex h-screen flex-col">
      {/* top bar — the console nameplate */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-rail px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-rail-text">
            whisperflow
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
            · the console
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            aria-keyshortcuts="Control+K"
            className="flex h-8 items-center gap-2 rounded-md border border-line bg-pill px-3 font-mono text-[12px] text-ink-dim transition-colors duration-150 hover:border-phosphor/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60"
          >
            <Command size={13} />
            <span className="hidden sm:inline">jump to…</span>
            <kbd className="rounded border border-line-soft bg-paper-2 px-1 py-0.5 text-[10px] text-ink-faint">
              ^K
            </kbd>
          </button>
          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`Theme: ${getTheme(themeId).label}. Click for the next print.`}
            title={`${getTheme(themeId).blurb} — click to cycle the press`}
            className="flex h-8 items-center gap-2 rounded-md border border-line bg-pill px-3 font-mono text-[12px] font-medium text-ink transition-colors duration-150 hover:border-phosphor/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60"
          >
            {getTheme(themeId).dark ? <Moon size={14} /> : <Sun size={14} />}
            <span>{getTheme(themeId).label}</span>
          </button>
        </div>
      </div>

      <UpdateBanner />

      <div className="flex min-h-0 flex-1">
        {/* rail — the channel strip */}
        <aside
          className="flex shrink-0 flex-col gap-0.5 overflow-y-auto bg-rail px-3 py-3"
          aria-label="Sections"
          style={{ width: 216 }}
        >
          {PAGES.map((item, i) => (
            <RailItem
              key={item.id}
              active={page.id === item.id}
              label={item.label}
              channel={String(i + 1).padStart(2, "0")}
              href={`#/${pageHome(item)}`}
              first={i === 0}
            >
              <item.icon size={17} strokeWidth={1.75} />
            </RailItem>
          ))}
          <div className="mt-auto px-3 pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-rail-text-dim">
            local-first · apache-2.0
            <br />
            v{version} · no telemetry
          </div>
        </aside>

        <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg px-8 py-7">
          <div className="mx-auto min-w-0 max-w-2xl">
            {/* the screen stages on every route change (see styles.css) */}
            <div key={route} className="wf-stage">
              <SubNav page={page} active={sub.id} route={route} />
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
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} extraActions={paletteActions} />
    </div>
  );
}

/**
 * Sub-navigation for one page. Rendered above the tab body, which keeps
 * owning its own `PageHeader` — one screen per view, unchanged.
 */
function SubNav({ page, active, route }: { page: SettingsPage; active: string; route: string }) {
  return (
    <div className="mb-5 border-b border-line pb-4">
      <p className="wf-header-channel">
        {page.label.toLowerCase()} · {route.replace("/", " / ")}
      </p>
      <p className="mt-1.5 text-[12px] leading-5 text-ink-dim">{page.hint}</p>
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
                on ? "bg-paper-2 text-ink" : "text-ink-dim hover:text-ink"
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
  label,
  channel,
  href,
  children,
  first,
}: {
  active: boolean;
  label: string;
  channel: string;
  href: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rail-item relative flex h-9 items-center gap-3 rounded-md px-3 font-mono text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60 ${
        first ? "" : "mt-1"
      } ${active ? "is-active bg-rail-active text-ink" : "text-rail-text-dim hover:bg-rail-item hover:text-rail-text"}`}
    >
      {/* the phosphor edge: a 2px signal on the live channel */}
      {active && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-phosphor shadow-[0_0_8px_rgba(92,225,169,0.7)]"
          aria-hidden="true"
        />
      )}
      {children}
      <span className="flex-1">{label}</span>
      <span className="rail-channel" aria-hidden="true" data-channel={channel}>
        <Scramble text={channel} />
      </span>
    </a>
  );
}
