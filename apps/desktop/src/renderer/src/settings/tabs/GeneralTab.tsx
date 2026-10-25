import { useSettings } from "../store";
import { Card, PageHeader } from "../../shared/ui";

/** Reference-measured settings anatomy: rows of [label + value] with a Change button. */
function ChangeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: React.ReactNode;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-5">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{label}</p>
        <p className="mt-1 truncate text-sm text-ink-dim">{value}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Change
      </button>
    </div>
  );
}

export function GeneralTab() {
  const config = useSettings((s) => s.config);
  const devices = useSettings((s) => s.devices);
  if (!config) return null;

  const go = (route: string) => {
    window.location.hash = `#/${route}`;
  };

  return (
    <section>
      <PageHeader title="General" tagline="The essentials, in one place." />
      <Card className="divide-y divide-line/70 p-0">
        <ChangeRow
          label="Shortcuts"
          value={
            <>
              Hold{" "}
              <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
                {config.hotkey.pushToTalk}
              </kbd>{" "}
              and speak.
            </>
          }
          onChange={() => go("shortcuts")}
        />
        <ChangeRow
          label="Microphone"
          value={
            devices.find((d) => d.deviceId === config.audio.deviceId)?.label ||
            (config.audio.deviceId === "default" ? "Auto-detect" : config.audio.deviceId)
          }
          onChange={() => go("audio")}
        />
        <ChangeRow
          label="My languages"
          value={config.stt.language === "auto" ? "Auto-detect" : config.stt.language}
          onChange={() => go("audio")}
        />
        <div className="flex items-center justify-between gap-6 px-5 py-5">
          <div>
            <p className="text-[15px] font-semibold">App theme</p>
            <p className="mt-1 text-sm text-ink-dim">Nocturne (dark) · Dawn (light) · Classic</p>
          </div>
          <select
            value={(() => {
              try {
                return localStorage.getItem("wf-skin") || "nocturne";
              } catch {
                return "nocturne";
              }
            })()}
            onChange={(e) => {
              const skin = e.target.value as "nocturne" | "classic" | "dawn";
              const root = document.documentElement;
              if (skin === "classic") {
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
            }}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
          >
            <option value="nocturne">Nocturne — dark</option>
            <option value="dawn">Dawn — light</option>
            <option value="classic">Classic</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-6 px-5 py-5">
          <div>
            <p className="text-[15px] font-semibold">Save dictation history</p>
            <p className="mt-1 text-sm text-ink-dim">Stored locally only. Never synced.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !config.general.historyEnabled;
              void useSettings.getState().patchConfig({ general: { historyEnabled: next } });
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              config.general.historyEnabled ? "bg-accent" : "bg-line"
            }`}
            role="switch"
            aria-checked={config.general.historyEnabled}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-transform ${
                config.general.historyEnabled ? "translate-x-[22px] bg-bg" : "translate-x-0.5 bg-bg"
              }`}
            />
          </button>
        </div>
      </Card>
      <p className="mt-5 text-xs leading-5 text-ink-dim">
        WhisperFlow v0.1.0 · local-first · Apache-2.0 · zero telemetry
      </p>
    </section>
  );
}
