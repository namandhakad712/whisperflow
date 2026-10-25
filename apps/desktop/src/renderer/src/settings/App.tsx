import { useEffect, useState } from "react";
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

const TABS = [
  { id: "general", label: "General" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "audio", label: "Audio" },
  { id: "models", label: "Models" },
  { id: "dictionary", label: "Dictionary" },
  { id: "commands", label: "Commands" },
  { id: "history", label: "History" },
  { id: "privacy", label: "Privacy" },
  { id: "advanced", label: "Advanced" },
  { id: "about", label: "About" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, "") || "general";
}

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const loadConfig = useSettings((s) => s.loadConfig);

  useEffect(() => {
    void loadConfig();
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

  const tab = TABS.find((t) => t.id === route)?.id ?? "general";

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface/40 p-3">
        <div className="mb-5 flex items-center gap-2 px-2 pt-2">
          <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#22d3ee" />
            <g fill="#0b1220">
              <rect x="14" y="26" width="5" height="12" rx="2.5" />
              <rect x="23" y="18" width="5" height="28" rx="2.5" />
              <rect x="32" y="10" width="5" height="44" rx="2.5" />
              <rect x="41" y="20" width="5" height="24" rx="2.5" />
              <rect x="50" y="28" width="5" height="8" rx="2.5" />
            </g>
          </svg>
          <span className="font-semibold">WhisperFlow</span>
        </div>
        <nav className="space-y-0.5" aria-label="Settings sections">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`#/${t.id}`}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                t.id === tab ? "bg-surface-2 font-medium text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
        <p className="mt-auto px-3 pb-1 text-[11px] text-ink-dim">Local-first · Apache-2.0</p>
      </aside>
      <main className="h-full flex-1 overflow-y-auto px-8 py-6">
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
  );
}
