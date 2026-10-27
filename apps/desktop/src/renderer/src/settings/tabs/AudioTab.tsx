import { useEffect } from "react";
import { useSettings } from "../store";
import { Card, Row, PageHeader, Select } from "../../shared/ui";

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
          hint="0 = unlimited. Caps a runaway session so a stuck hotkey can't record for hours."
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
      {devices.length === 0 && (
        <p className="mt-4 text-xs text-ink-dim">
          Device names appear after the microphone permission is granted (first dictation or onboarding).
        </p>
      )}
    </section>
  );
}
