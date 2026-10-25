import { useSettings } from "../store";
import { Card, Row, SectionTitle, Select, TextInput, Toggle } from "../../shared/ui";
import type { ToneId } from "@whisperflow/shared";

const LANGUAGES = [
  ["auto", "Auto-detect"],
  ["en", "English"],
  ["hi", "Hindi"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
] as const;

const TONES: Array<{ value: ToneId; label: string }> = [
  { value: "neutral", label: "Neutral" },
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "custom", label: "Custom instructions" },
];

export function GeneralTab() {
  const config = useSettings((s) => s.config);
  const patch = useSettings((s) => s.patchConfig);
  if (!config) return null;

  return (
    <section>
      <SectionTitle title="General" hint="Everyday behavior of the app." />
      <Card>
        <Row label="Start with Windows" hint="Runs hidden in the tray.">
          <Toggle
            checked={config.general.launchAtLogin}
            onChange={(v) => {
              void window.whisperflowExtras.app.setLaunchAtLogin(v);
              void patch({ general: { launchAtLogin: v } });
            }}
          />
        </Row>
        <Row label="Overlay follows the cursor" hint="Show the dictation pill near your pointer instead of a fixed spot.">
          <Toggle
            checked={config.general.overlayFollowsCursor}
            onChange={(v) => void patch({ general: { overlayFollowsCursor: v } })}
          />
        </Row>
        <Row label="Save dictation history" hint="Stored locally only. Turn off for zero persistence.">
          <Toggle
            checked={config.general.historyEnabled}
            onChange={(v) => void patch({ general: { historyEnabled: v } })}
          />
        </Row>
        <Row label="Dictation language" hint="Auto-detect works well for bilingual speakers.">
          <Select
            value={config.stt.language}
            onChange={(v) => void patch({ stt: { language: v } })}
            options={LANGUAGES.map(([value, label]) => ({ value, label }))}
          />
        </Row>
      </Card>

      <div className="mt-6">
        <SectionTitle title="Polish tone" hint="How the AI rewrites your speech." />
        <Card>
          <Row label="Tone preset">
            <Select
              value={config.polish.tone}
              onChange={(v) => void patch({ polish: { tone: v as ToneId } })}
              options={TONES}
            />
          </Row>
          {config.polish.tone === "custom" && (
            <div className="pt-4">
              <TextInput
                value={config.polish.customInstructions}
                onChange={(v) => void patch({ polish: { customInstructions: v } })}
                placeholder="e.g. Keep it terse, bullet points, no greetings"
              />
              <p className="mt-2 text-xs text-ink-dim">
                These instructions replace the tone preset. Meaning is always preserved.
              </p>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
