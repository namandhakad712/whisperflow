import { useEffect } from "react";
import { useSettings } from "../store";
import { Card, Row, PageHeader, Select } from "../../shared/ui";

/**
 * A compact version of their language list — the codes whisper.cpp accepts
 * natively. Their picker carries 30+ (with a Hinglish tile); ours opens with
 * the common ones and can be extended without a schema change.
 */
const SUPPORTED_LANGUAGES: [code: string, name: string][] = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["nl", "Dutch"],
  ["hi", "Hindi"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
  ["ru", "Russian"],
  ["pl", "Polish"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["sv", "Swedish"],
];

export function AudioTab() {
  const config = useSettings((s) => s.config);
  const devices = useSettings((s) => s.devices);
  const loadDevices = useSettings((s) => s.loadDevices);
  const patch = useSettings((s) => s.patchConfig);
  if (!config) return null;

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  return (
    <section>
      <PageHeader title="Audio" tagline="Hear everything. Miss nothing." explainer="Microphone and voice-activity detection." />
      <Card>
        <Row label="Input device">
          <Select
            value={config.audio.deviceId}
            onChange={(v) => void patch({ audio: { deviceId: v } })}
            options={[
              { value: "default", label: "System default" },
              ...devices.map((d) => ({ value: d.deviceId, label: d.label || d.deviceId })),
            ]}
          />
        </Row>
        <Row label="Voice detection" hint="Energy VAD is built-in; Silero is a small optional model upgrade.">
          <Select
            value={config.audio.vad.kind}
            onChange={(v) => void patch({ audio: { vad: { kind: v as "rms" | "silero" } } })}
            options={[
              { value: "rms", label: "Energy (built-in)" },
              { value: "silero", label: "Silero (better, needs model)" },
            ]}
          />
        </Row>
        <Row label={`Sensitivity — ${Math.round(config.audio.vad.sensitivity * 100)}%`} hint="Higher detects quieter speech.">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.audio.vad.sensitivity}
            onChange={(e) => void patch({ audio: { vad: { sensitivity: Number(e.target.value) } } })}
            className="w-48 accent-[var(--color-accent)]"
          />
        </Row>
        <Row label="Silence ends dictation after (ms)" hint="Trailing quiet time that finishes a segment.">
          <input
            type="number"
            min={100}
            max={5000}
            step={100}
            value={config.audio.vad.silenceMs}
            onChange={(e) => void patch({ audio: { vad: { silenceMs: Number(e.target.value) } } })}
            className="w-28 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </Row>
        <Row
          label="Max dictation length (minutes)"
          hint="Their default is 20 minutes (a warning fires one minute before). 0 = unlimited."
        >
          <input
            type="number"
            min={0}
            max={180}
            step={1}
            value={config.audio.maxRecordingLengthMs ? config.audio.maxRecordingLengthMs / 60000 : 0}
            onChange={(e) =>
              void patch({
                audio: { maxRecordingLengthMs: Math.max(0, Number(e.target.value)) * 60000 },
              })
            }
            className="w-24 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </Row>
      </Card>
      <Card className="mt-5">
        <Row
          label="Automatic language detection"
          hint="Flow will detect your language automatically. Make sure all the languages you speak are selected."
        >
          <Select
            value={config.stt.autoDetect === false ? "off" : "on"}
            onChange={(v) => void patch({ stt: { autoDetect: v === "on" } })}
            options={[
              { value: "on", label: "On — detect while I speak" },
              { value: "off", label: "Off — use my languages" },
            ]}
          />
        </Row>
        <Row
          label="My languages"
          hint="One selected language is used explicitly; several act as detection hints. Auto-detect off + one language = never auto-detect."
        >
          <div className="flex max-w-[55%] flex-wrap gap-1.5">
            {SUPPORTED_LANGUAGES.map(([code, name]) => {
              const on = (config.stt.languages ?? []).includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    const set = new Set(config.stt.languages ?? []);
                    on ? set.delete(code) : set.add(code);
                    void patch({ stt: { languages: [...set] } });
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    on
                      ? "border-accent bg-accent/15 text-ink"
                      : "border-line text-ink-dim hover:border-accent/50"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </Row>
      </Card>
      {devices.length === 0 && (
        <p className="mt-4 text-xs text-ink-dim">
          Device names appear after the microphone permission is granted (first dictation or onboarding).
        </p>
      )}
    </section>
  );
}
