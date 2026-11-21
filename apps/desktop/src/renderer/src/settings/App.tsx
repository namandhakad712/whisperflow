import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { AppUpdateStatus } from "@whisperflow/shared";
import { Moon, Sun, Command } from "lucide-react";
import { useAppVersion } from "../shared/useAppVersion";
import { CommandPalette, type PaletteAction } from "../shared/CommandPalette";
import { AuroraField, CountUp, DecryptText, DotRadar, Magnetic } from "../shared/presskit";
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
import { HomeTab } from "./tabs/HomeTab";
import { initPressPrefs } from "./tabs/PressPrefsCard";
import { Onboarding } from "./Onboarding";
import { THEMES, getTheme, readThemeId, applyTheme } from "./themes";
import { DEFAULT_ROUTE, PAGES, pageHome, resolveRoute, type SettingsPage } from "./nav";

/**
 * The console — v0.1.48 "the press room".
 *
 * Three panes: the rail (channels), the sheet (content over a two-ink
 * aurora), and the LIVE rail — mic meter, engine state, model, today's
 * count — the instrument cluster the v0.1.47 critique asked for. Free-
 * world grammar (reactbits/canvasui/21st.dev, browsed only) in our print
 * language; see scripts/v2-design-spec.md and INSPIRATION.md.
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
  // Alt+1..9 (v0.1.50) jumps straight to a rail channel — the numbers
  // printed beside each icon.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
        const target = PAGES[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          window.location.hash = `#/${pageHome(target)}`;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void loadConfig();
    applyTheme(readThemeId());
    initPressPrefs();
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
            · the press room
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Magnetic strength={1.2}>
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
          </Magnetic>
          <Magnetic strength={1.2}>
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
          </Magnetic>
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
          {/* v0.1.50: the rail reads in three sections — the press you
              drive, the records it prints, the system under it. */}
          <RailSection title="the press" />
          {PAGES.map((item, i) => (
            <Fragment key={item.id}>
              {item.id === "activity" && <RailSection title="the records" />}
              {item.id === "system" && <RailSection title="the system" />}
              <RailItem
                active={page.id === item.id}
                label={item.label}
                channel={String(i).padStart(2, "0")}
                href={`#/${pageHome(item)}`}
                first={i === 0}
              >
                <item.icon size={17} strokeWidth={1.75} />
              </RailItem>
            </Fragment>
          ))}
          <div className="mt-auto px-3 pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-ink-dim">
            local-first · apache-2.0
            <br />
            v{version} · no telemetry
          </div>
        </aside>

        {/* the sheet: content over the two-ink aurora */}
        <main className="relative h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg">
          <AuroraField className="pointer-events-none fixed inset-0" />
          <div className="relative mx-auto min-w-0 max-w-3xl px-8 py-7">
            {/* the screen stages on every route change (see styles.css) */}
            <div key={route} className="wf-stage">
              {page.id !== "home" && <SubNav page={page} active={sub.id} route={route} />}
              {sub.id === "front" && <HomeTab />}
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

        {/* the LIVE rail — the instrument cluster (wide sheets only) */}
        <LiveRail route={route} />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} extraActions={paletteActions} />
    </div>
  );
}

/**
 * The live rail: mic meter, engine + model state, today's line, quick
 * actions. Hidden under 1100px — the sheet breathes instead.
 */
function LiveRail({ route }: { route: string }) {
  const config = useSettings((s) => s.config);
  const statuses = useSettings((s) => s.statuses);
  const barsRef = useRef<HTMLDivElement | null>(null);

  // engine state: listen to dictation for the LED + label
  const [dictState, setDictState] = useState<string>("idle");
  useEffect(() => {
    return window.whisperflow.dictation.onState((ev) => setDictState(ev.state));
  }, []);

  // the mic meter: analyze the default input while the panel is alive.
  // Silent rooms read as a calm floor — that IS the signal (live instrument).
  const [levels, setLevels] = useState<number[]>(() => new Array(14).fill(0.18));
  /** On-demand mic test (v0.1.50): the ambient meter never prompts, so
   *  this button is where the user actively asks to be heard. A real
   *  getUserMedia doubles as the permission grant for the overlay too. */
  const [, forceMeter] = useState(0);
  async function testMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const start = performance.now();
      const paint = () => {
        const raf = requestAnimationFrame(paint);
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevels((prev) => [...prev.slice(1), Math.max(0.18, Math.min(1, rms * 5))]);
        if (performance.now() - start > 10_000) {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close();
          forceMeter((n) => n + 1);
        }
      };
      paint();
    } catch {
      /* denied — the hint stays, the meter stays at its floor */
    }
  }
  useEffect(() => {
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let stopped = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    (async () => {
      try {
        // never prompt from settings: only meter when permission is already
        // granted (first-run onboarding / first dictation does the asking)
        const perm = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (perm && perm.state !== "granted") return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stopped) return;
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        let last = 0;
        const tick = () => {
          raf = requestAnimationFrame(tick);
          const now = performance.now();
          if (now - last < 90) return; // ~11fps is plenty for a meter
          last = now;
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevels((prev) => [...prev.slice(1), Math.max(0.18, Math.min(1, rms * 5))]);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        /* mic denied or absent — the meter stays at its floor */
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, []);

  // model state from the store (downloaded count + the transcription pick)
  const models = useSettings((s) => s.catalog);
  const downloaded = statuses.filter((s) => s.state === "downloaded").length;
  const activeId = config?.stt?.modelId ?? "";
  const activeModel = models.find((m) => m.id === activeId)?.name ?? (activeId || "—");
  const hotkey = config?.hotkey?.pushToTalk ?? "—";

  // today (v0.1.50): the WHOLE day's print run, not just the first line —
  // runs, chars, seconds — recomputed whenever history lands/changes.
  const history = useSettings((s) => s.history);
  const midnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todaysRuns = useMemo(() => history.filter((h) => h.createdAt >= midnight), [history, midnight]);
  const todayChars = useMemo(
    () => todaysRuns.reduce((n, h) => n + (h.finalText ?? h.rawText ?? "").length, 0),
    [todaysRuns],
  );
  const todaySecs = useMemo(
    () => Math.round(todaysRuns.reduce((n, h) => n + (h.durationMs ?? 0), 0) / 1000),
    [todaysRuns],
  );

  const engineLabel =
    dictState === "listening"
      ? "listening"
      : dictState === "polishing" || dictState === "transcribing"
        ? "printing"
        : dictState === "error"
          ? "error"
          : "ready";

  return (
    <aside className="live-rail hidden w-[260px] shrink-0 overflow-y-auto py-4 xl:flex" aria-label="Live status">
      <DotRadar className="pointer-events-none fixed h-0 w-0" />
      {/* mic — live meter, and a test button when the meter sits at its
          floor (permission never granted / no input yet) */}
      <div className="live-rail-cell">
        <div className="live-rail-label">
          <span>mic · live</span>
          <span className={`led ${dictState === "listening" ? "led-breathe" : ""}`} data-on={dictState === "listening" ? "live" : "off"} />
        </div>
        <div className="meter-bars" ref={barsRef} aria-hidden="true">
          {levels.map((v, i) => (
            <span key={i} style={{ height: `${Math.round(v * 100)}%` }} data-live={v > 0.14} />
          ))}
        </div>
        {levels.every((v) => v <= 0.19) && (
          <button type="button" className="live-rail-test" onClick={() => void testMic()}>
            test the mic →
          </button>
        )}
      </div>
      {/* engine */}
      <div className="live-rail-cell">
        <div className="live-rail-label">
          <span>engine</span>
          <span className={`led ${engineLabel === "printing" ? "led-breathe" : ""}`} data-on={engineLabel === "error" ? "error" : engineLabel === "printing" ? "busy" : "live"} />
        </div>
        <p className="live-rail-value">
          <DecryptText text={engineLabel} duration={420} runKey={`${route}/${engineLabel}`} />
        </p>
      </div>
      {/* model */}
      <div className="live-rail-cell">
        <div className="live-rail-label">
          <span>model</span>
          <span className="pr-1">{downloaded} ready</span>
        </div>
        <p className="live-rail-value truncate" title={activeModel}>
          {activeModel}
        </p>
      </div>
      {/* hotkey */}
      <div className="live-rail-cell">
        <div className="live-rail-label">
          <span>hotkey</span>
        </div>
        <p className="live-rail-value">{hotkey}</p>
      </div>
      {/* today */}
      <div className="live-rail-cell">
        <div className="live-rail-label">
          <span>today</span>
        </div>
        <p className="live-rail-value">
          <CountUp
            to={todayChars}
            duration={700}
            format={(n) => `${n.toLocaleString()} chars`}
          />
        </p>
        <p className="live-rail-sub">
          {todaysRuns.length} run{todaysRuns.length === 1 ? "" : "s"} · {todaySecs}s spoken
        </p>
      </div>
      <div className="live-rail-foot mt-auto px-1 pb-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-ink-dim">
        the press runs local
        <br />
        nothing leaves this machine
      </div>
    </aside>
  );
}

/**
 * Sub-navigation for one page — v0.1.48: the PillNav rides a sticky bar
 * with the channel marker, and the page hint decrypts on route change.
 */
function SubNav({ page, active, route }: { page: SettingsPage; active: string; route: string }) {
  return (
    <div className="mb-5 border-b border-line pb-4">
      <p className="wf-header-channel">
        {route.replace("/", " / ")}
      </p>
      <p className="mt-1.5 text-[12px] leading-5 text-ink-dim">
        <DecryptText text={page.hint} duration={480} runKey={route} />
      </p>
      <nav className="pk-pillnav mt-3" aria-label={`${page.label} sections`}>
        {page.subs.map((s) => {
          const on = s.id === active;
          return (
            <a
              key={s.id}
              href={`#/${page.id}/${s.id}`}
              aria-current={on ? "page" : undefined}
              className={`pk-pillnav-tab ${on ? "on" : ""}`}
            >
              <span className={`led mr-1 ${on ? "" : "opacity-40"}`} data-on={on ? "live" : "off"} aria-hidden="true" />
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

/** A mono section header in the rail — the press / records / system. */
function RailSection({ title }: { title: string }) {
  return <p className="rail-section">{title}</p>;
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
    <Magnetic strength={1.4} className={first ? "" : "mt-1"}>
      <a
        href={href}
        aria-current={active ? "page" : undefined}
        className={`rail-item relative flex h-9 items-center gap-3 rounded-md px-3 font-mono text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phosphor/60 ${
          active ? "is-active bg-rail-active text-ink" : "text-rail-text-dim hover:bg-rail-item hover:text-rail-text"
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
        <span className="flex-1">{label}</span>
        <span className="rail-channel" aria-hidden="true" data-channel={channel}>
          {channel}
        </span>
      </a>
    </Magnetic>
  );
}
