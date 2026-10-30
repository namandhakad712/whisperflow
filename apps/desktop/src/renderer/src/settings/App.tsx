import { useEffect, useState } from "react";
import type { AppUpdateStatus } from "@whisperflow/shared";
import {
  Mic,
  Volume2,
  Cpu,
  Book,
  TextSelect,
  Sparkles,
  History,
  Keyboard,
  ShieldCheck,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  Palette,
  BarChart3,
  StickyNote,
  AppWindow,
} from "lucide-react";
import { useSettings } from "./store";
import { GeneralTab } from "./tabs/GeneralTab";
import { ShortcutsTab } from "./tabs/ShortcutsTab";
import { AudioTab } from "./tabs/AudioTab";
import { ModelsTab } from "./tabs/ModelsTab";
import { DictionaryTab } from "./tabs/DictionaryTab";
import { CommandsTab } from "./tabs/CommandsTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { PrivacyTab } from "./tabs/PrivacyTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { AboutTab } from "./tabs/AboutTab";
import { InsightsTab } from "./tabs/InsightsTab";
import { ScratchpadTab } from "./tabs/ScratchpadTab";
import { OverlayTab } from "./tabs/OverlayTab";
import { Onboarding } from "./Onboarding";

/** Rail layout mirrors the measured reference hub: 192px rail, 36px items, 6px radius.
 *  Grouped so the five things everyone touches sit apart from the collections and
 *  the system tools — the flat 13-item list read as one wall of options. */
const ESSENTIALS = [
  { id: "general", label: "Dictation", icon: Mic },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "models", label: "Models", icon: Cpu },
  { id: "overlay", label: "Overlay", icon: AppWindow },
  { id: "advanced", label: "Style", icon: Sparkles },
] as const;

const COLLECTIONS = [
  { id: "dictionary", label: "Dictionary", icon: Book },
  { id: "commands", label: "Snippets", icon: TextSelect },
  { id: "history", label: "History", icon: History },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "scratchpad", label: "Scratchpad", icon: StickyNote },
] as const;

const SYSTEM = [
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "about", label: "Help", icon: CircleHelp },
] as const;

const RAIL_GROUPS = [
  { label: "Essentials", items: ESSENTIALS },
  { label: "Your stuff", items: COLLECTIONS },
  { label: "System", items: SYSTEM },
] as const;

type TabId =
  | (typeof ESSENTIALS)[number]["id"]
  | (typeof COLLECTIONS)[number]["id"]
  | (typeof SYSTEM)[number]["id"];

/** Rail render groups (Essentials first, then collections + system). */
const MAIN = ESSENTIALS;
const SECONDARY = [...COLLECTIONS, ...SYSTEM];

function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, "") || "general";
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
  const [route, setRoute] = useState(currentRoute);
  const [collapsed, setCollapsed] = useState(false);
  const [skin, setSkin] = useState<Skin>(() => readSkin());
  const loadConfig = useSettings((s) => s.loadConfig);

  useEffect(() => {
    void loadConfig();
    applySkin(readSkin());
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    const unsubNavigate = window.whisperflowExtras.app.onNavigate((r) => {
      window.location.hash = r.startsWith("/") ? r : `/${r}`;
      setRoute(r.replace(/^\//, ""));
    });
    return () => {
      window.removeEventListener("hashchange", onHash);
      unsubNavigate();
    };
  }, [loadConfig]);

  if (route === "onboarding") return <Onboarding />;
  const allTabs: Array<{ id: string }> = RAIL_GROUPS.flatMap((g) => [...g.items]);
  const tab = (allTabs.find((t) => t.id === route)?.id ?? "general") as TabId;

  const cycleSkin = () => {
    const next: Skin = skin === "nocturne" ? "classic" : skin === "classic" ? "dawn" : "nocturne";
    setSkin(next);
    applySkin(next);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* top bar with the reference hub's pill row */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="flex h-8 items-center gap-2 rounded-lg bg-pill px-3 text-[13px] font-medium text-ink transition-opacity hover:opacity-85"
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            {!collapsed && <span>Toggle sidebar</span>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (window.location.hash = "/about")}
            className="flex h-8 items-center gap-2 rounded-lg bg-pill px-3 text-[13px] font-medium text-ink transition-opacity hover:opacity-85"
          >
            <UserRound size={15} />
            <span>Account</span>
          </button>
          <button
            type="button"
            onClick={cycleSkin}
            aria-label={`Theme: ${SKIN_LABEL[skin]}. Click to change.`}
            className="flex h-8 items-center gap-2 rounded-lg bg-pill px-3 text-[13px] font-medium text-ink transition-opacity hover:opacity-85"
          >
            <Palette size={15} />
            <span>Theme · {SKIN_LABEL[skin]}</span>
          </button>
        </div>
      </div>

      <UpdateBanner />

      <div className="flex min-h-0 flex-1">
        {/* rail — measured: 192px, items 36px, 6px radius, icon+label */}
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
          {MAIN.map((item) => (
            <RailItem
              key={item.id}
              active={tab === item.id}
              collapsed={collapsed}
              label={item.label}
              href={`#/${item.id}`}
            >
              <item.icon size={17} strokeWidth={1.8} />
            </RailItem>
          ))}
          <div className="my-3 border-t border-white/10" />
          {SECONDARY.map((item) => (
            <RailItem
              key={item.id}
              active={tab === item.id}
              collapsed={collapsed}
              label={item.label}
              href={`#/${item.id}`}
            >
              <item.icon size={17} strokeWidth={1.8} />
            </RailItem>
          ))}
          <div className="mt-auto px-3 pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-rail-text-dim">
            {collapsed ? "v0.1" : <>local-first · apache-2.0<br />v0.1.0 · no telemetry</>}
          </div>
        </aside>

        <main className="h-full flex-1 overflow-y-auto bg-bg px-8 py-7">
          <div className="mx-auto max-w-2xl">
            {tab === "general" && <GeneralTab />}
            {tab === "shortcuts" && <ShortcutsTab />}
            {tab === "audio" && <AudioTab />}
            {tab === "models" && <ModelsTab />}
            {tab === "overlay" && <OverlayTab />}
            {tab === "dictionary" && <DictionaryTab />}
            {tab === "commands" && <CommandsTab />}
            {tab === "history" && <HistoryTab />}
            {tab === "privacy" && <PrivacyTab />}
            {tab === "advanced" && <AdvancedTab />}
            {tab === "about" && <AboutTab />}
            {tab === "insights" && <InsightsTab />}
            {tab === "scratchpad" && <ScratchpadTab />}
          </div>
        </main>
      </div>
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
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2.5">
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
    );
  }

  // available — downloading in the background
  if (status.state !== "available") return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-2/50 px-4 py-2.5">
      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="text-[13px] text-ink-dim">
        WhisperFlow v{status.version} is downloading… it installs when you quit.
        {status.releaseNotes ? ` ${status.releaseNotes}` : ""}
      </p>
    </div>
  );
}

function RailItem({  active,
  collapsed,
  label,
  href,
  children,
}: {
  active: boolean;
  collapsed: boolean;
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={collapsed ? label : undefined}
      className={`flex h-9 items-center rounded-md text-[15px] font-[550] transition-colors ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${active ? "bg-rail-active text-rail-text" : "text-rail-text-dim hover:bg-rail-item hover:text-rail-text"}`}
    >
      {children}
      {!collapsed && <span>{label}</span>}
    </a>
  );
}
