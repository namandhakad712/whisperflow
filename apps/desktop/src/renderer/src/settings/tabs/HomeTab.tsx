import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Cpu, Mic, PlayCircle, Settings2 } from "lucide-react";
import { useSettings } from "../store";
import { CountUp, DecryptText, SpotlightCard } from "../../shared/presskit";
import { THEMES, getTheme, readThemeId, applyTheme } from "../themes";

/**
 * THE FRONT PAGE (v0.1.49) — the console's home.
 *
 * One screen that answers "is my press okay, and how do I start?" —
 * hero with the halftone plate + jumbo CTA (real dictation), then a
 * bento strip: recent runs, setup status, today's print run, the six
 * prints. Patterns from the Nov-2026 design-wall study (see
 * INSPIRATION.md): one glowing focal element (ours is ink, not glow),
 * oversized display vs tiny mono meta, keyboard chip inside the CTA.
 */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "up late? the press waits for no one";
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

/** The halftone plate — a print disc behind the hero. Pure CSS: three
 *  radial ink rings + a repeating radial dot mask. It breathes. */
function HeroPlate() {
  return (
    <div className="hero-plate" aria-hidden="true">
      <span className="hero-plate-ring r1" />
      <span className="hero-plate-ring r2" />
      <span className="hero-plate-ring r3" />
      <span className="hero-plate-core" />
    </div>
  );
}

export function HomeTab() {
  const config = useSettings((s) => s.config);
  const history = useSettings((s) => s.history);
  const statuses = useSettings((s) => s.statuses);
  const catalog = useSettings((s) => s.catalog);
  const loadHistory = useSettings((s) => s.loadHistory);
  const loadModels = useSettings((s) => s.loadModels);
  const bindProgress = useSettings((s) => s.bindProgress);
  const [engineLive, setEngineLive] = useState<string>("ready");
  const [themeId, setThemeId] = useState(readThemeId());

  useEffect(() => {
    void loadHistory();
    void loadModels();
    return bindProgress();
  }, [loadHistory, loadModels, bindProgress]);

  useEffect(() => {
    return window.whisperflow.dictation.onState((ev) => setEngineLive(ev.state));
  }, []);

  useEffect(() => {
    const onTheme = () => setThemeId(readThemeId());
    window.addEventListener("wf-theme-changed", onTheme);
    return () => window.removeEventListener("wf-theme-changed", onTheme);
  }, []);

  const hotkey = config?.hotkey?.pushToTalk ?? "";
  const activeModel =
    catalog.find((m) => m.id === config?.stt?.modelId)?.name ?? config?.stt?.modelId ?? "—";

  // today's chars: history items from today
  const midnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todays = history.filter((h) => h.createdAt >= midnight);
  const todayChars = todays.reduce(
    (n, h) => n + (h.finalText ?? h.rawText ?? "").length,
    0,
  );

  // setup: engine + model present?
  const sttCloud = config?.stt.provider === "cloud";
  const engineReady =
    sttCloud || statuses.some((s) => s.entryId === "whisper-bin-x64" && s.state === "downloaded");
  const modelReady =
    sttCloud || statuses.some((s) => s.entryId === config?.stt.modelId && s.state === "downloaded");
  const pressReady = engineReady && modelReady;

  const recent = history.slice(0, 3);

  const start = () => {
    void window.whisperflow.dictation.start();
  };

  return (
    <div>
      {/* ---- the hero ---- */}
      <section className="hero-front relative overflow-hidden" data-stage-row>
        <HeroPlate />
        <p className="wf-header-channel">the front page</p>
        <h1 className="hero-title">
          speak. <em>it writes.</em>
        </h1>
        <p className="hero-sub mt-3">
          <DecryptText
            text={`${greeting()} — the press is ${engineLive === "idle" ? "ready" : engineLive}. Nothing leaves this machine.`}
            duration={620}
          />
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <MagneticCTA onPress={start} hotkey={hotkey} ready={pressReady} />
          {!pressReady && (
            <a
              href="#/models/models"
              className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-accent hover:text-accent-strong"
            >
              finish setting up the engine <ArrowRight size={13} />
            </a>
          )}
        </div>
        <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          local · {activeModel} · <CountUp to={todayChars} duration={800} /> chars today
        </p>
      </section>

      {/* ---- the bento ---- */}
      <div className="mt-8 grid gap-4 md:grid-cols-2" data-stage-row>
        {/* recent runs */}
        <SpotlightCard className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              recent print runs
            </p>
            <a href="#/activity/history" className="font-mono text-[11px] text-ink-dim hover:text-ink">
              all →
            </a>
          </div>
          {recent.length === 0 ? (
            <p className="py-4 text-sm leading-6 text-ink-dim">
              No runs yet. Press{" "}
              <kbd className="rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[11px]">
                {hotkey || "your hotkey"}
              </kbd>{" "}
              anywhere, or use the button above — the first words land here.
            </p>
          ) : (
            <ul className="fan-list">
              {recent.map((h) => (
                <li key={h.id} className="fan-item">
                  <ClipboardList size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                  <p className="min-w-0 flex-1 truncate text-sm">{h.finalText ?? h.rawText}</p>
                  <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">
                    {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SpotlightCard>

        {/* press status */}
        <SpotlightCard className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              press status
            </p>
            <span className={`led ${pressReady ? "led-breathe" : ""}`} data-on={pressReady ? "live" : "busy"} aria-hidden="true" />
          </div>
          <ul className="space-y-2.5">
            <StatusRow icon={<Cpu size={15} />} ok={engineReady} label="transcription engine" hint={sttCloud ? "cloud provider" : "whisper.cpp, on this machine"} href="#/models/models" />
            <StatusRow icon={<Mic size={15} />} ok={modelReady} label="active model" hint={activeModel} href="#/models/models" />
            <StatusRow icon={<Settings2 size={15} />} ok={(config?.dictionary.length ?? 0) > 0} label="dictionary + snippets" hint={`${config?.dictionary.length ?? 0} words · ${config?.commands.length ?? 0} snippets`} href="#/personalize/dictionary" />
          </ul>
        </SpotlightCard>

        {/* today's run */}
        <SpotlightCard className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              today's print run
            </p>
            <a href="#/activity/insights" className="font-mono text-[11px] text-ink-dim hover:text-ink">
              insights →
            </a>
          </div>
          {todays.length === 0 ? (
            <p className="py-3 text-sm leading-6 text-ink-dim">
              No runs yet today. The first words you dictate land here — chars, seconds, and the
              hour's rhythm, printed as they happen.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat value={<CountUp to={todays.length} />} label="runs" />
              <Stat value={<CountUp to={todayChars} />} label="chars" />
              <Stat
                value={<CountUp to={Math.round(todays.reduce((n, h) => n + (h.durationMs ?? 0), 0) / 1000)} />}
                label="secs spoken"
              />
            </div>
          )}
        </SpotlightCard>

        {/* the six prints — quick press */}
        <SpotlightCard className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
              the six prints
            </p>
            <a href="#/dictation/general" className="font-mono text-[11px] text-ink-dim hover:text-ink">
              customize →
            </a>
          </div>
          <div className="press-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  applyTheme(t.id);
                  window.dispatchEvent(new Event("wf-theme-changed"));
                }}
                className={`press-sheet ${themeId === t.id ? "on" : ""}`}
                title={`${t.label} — ${t.blurb}`}
              >
                <span className="press-sheet-swatches" aria-hidden="true">
                  <i style={{ background: t.tokens.bg }} />
                  <i style={{ background: t.tokens.ink }} />
                  <i style={{ background: t.tokens.accent }} />
                </span>
                <span className="press-sheet-name">{t.label}</span>
              </button>
            ))}
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

/** The jumbo pill CTA — ink floods on hover; the hotkey rides inside. */
function MagneticCTA({ onPress, hotkey, ready }: { onPress: () => void; hotkey: string; ready: boolean }) {
  return (
    <button type="button" onClick={onPress} className="pk-btn pk-btn-cta" disabled={!ready}>
      <span className="pk-btn-ink" aria-hidden="true" />
      <span className="pk-btn-gloss" aria-hidden="true" />
      <PlayCircle size={17} strokeWidth={2} />
      <span className="pk-btn-label">{ready ? "Start dictating" : "Set up the engine first"}</span>
      {hotkey && (
        <kbd className="cta-kbd font-mono text-[10.5px] tracking-[0.06em]">{hotkey}</kbd>
      )}
    </button>
  );
}

function StatusRow({ icon, ok, label, hint, href }: { icon: React.ReactNode; ok: boolean; label: string; hint: string; href: string }) {
  return (
    <li>
      <a href={href} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-paper-2/60">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${ok ? "border-accent/40 text-accent" : "border-line text-ink-faint"}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block truncate font-mono text-[10.5px] text-ink-faint">{hint}</span>
        </span>
        <span className={`font-mono text-[11px] ${ok ? "text-accent" : "text-amber"}`}>{ok ? "[ok]" : "[ .. ]"}</span>
      </a>
    </li>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-paper-2/40 px-3 py-2.5">
      <p className="font-mono text-lg font-medium leading-none">{value}</p>
      <p className="mt-1.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
    </div>
  );
}
