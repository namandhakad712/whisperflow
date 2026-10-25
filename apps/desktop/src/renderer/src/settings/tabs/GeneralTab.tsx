import { useSettings } from "../store";
import { Card, Row, PageHeader, Select, TextInput, Toggle } from "../../shared/ui";
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
      <PageHeader
        title="Dictation"
        tagline="Talk like you. Type like a pro."
        explainer="Everyday behavior of the dictation engine — startup, overlay, language, and history."
      />
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
    </section>
  );
}
