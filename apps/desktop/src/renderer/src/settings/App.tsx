import { useEffect, useState } from "react";
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
  SlidersHorizontal,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  Palette,
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
import { Onboarding } from "./Onboarding";

/** Rail layout mirrors the measured reference hub: 192px rail, 36px items, 6px radius. */
const MAIN = [
  { id: "general", label: "Dictation", icon: Mic },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "models", label: "Models", icon: Cpu },
  { id: "dictionary", label: "Dictionary", icon: Book },
  { id: "commands", label: "Snippets", icon: TextSelect },
  { id: "advanced", label: "Style", icon: Sparkles },
  { id: "history", label: "History", icon: History },
] as const;

const SECONDARY = [
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "about", label: "Help", icon: CircleHelp },
] as const;

type TabId = (typeof MAIN)[number]["id"] | (typeof SECONDARY)[number]["id"];

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

  const allTabs: Array<{ id: string }> = [...MAIN, ...SECONDARY];
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
            {tab === "dictionary" && <DictionaryTab />}
            {tab === "commands" && <CommandsTab />}
            {tab === "history" && <HistoryTab />}
            {tab === "privacy" && <PrivacyTab />}
            {tab === "advanced" && <AdvancedTab />}
            {tab === "about" && <AboutTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

function RailItem({
  active,
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
