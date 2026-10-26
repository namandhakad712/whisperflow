import { useSettings } from "../store";
import { Button, Card, Row, SectionTitle, Toggle } from "../../shared/ui";

export function PrivacyTab() {
  const config = useSettings((s) => s.config);
  const patch = useSettings((s) => s.patchConfig);
  if (!config) return null;

  return (
    <section>
      <SectionTitle title="Privacy" hint="WhisperFlow ships with zero telemetry. These switches make the guarantees visible." />
      <Card>
        <Row
          label="Local-only lock"
          hint="When on, remote providers are impossible — the app cannot send transcript text anywhere, even if an endpoint is configured."
        >
          <Toggle
            checked={config.privacy.localOnly}
            onChange={(v) => void patch({ privacy: { localOnly: v } })}
          />
        </Row>
        <Row label="Save history" hint="Off = dictations are processed in memory and forgotten.">
          <Toggle
            checked={config.general.historyEnabled}
            onChange={(v) => void patch({ general: { historyEnabled: v } })}
          />
        </Row>
      </Card>

      <div className="mt-6">
        <SectionTitle title="Your data" hint="Everything lives under %APPDATA%/WhisperFlow. Delete it whenever." />
        <Card>
          <Row label="Dictation history" hint="history.json — every transcript with timestamps.">
            <Button
              variant="danger"
              onClick={() => void window.whisperflow.history.clear()}
            >
              Clear history
            </Button>
          </Row>
          <Row
            label="Export backup"
            hint="One JSON file with your full config + history. Updates never touch your settings."
          >
            <Button
              variant="ghost"
              onClick={() =>
                void window.whisperflowExtras.app.exportBackup().then((r) => {
                  if (r.exported && r.path) {
                    window.alert(`Backup saved:\n${r.path}`);
                  }
                })
              }
            >
              Export…
            </Button>
          </Row>
          <Row
            label="Import backup"
            hint="Restores config and merges history — existing entries are never duplicated."
          >
            <Button
              variant="ghost"
              onClick={async () => {
                const picked = await window.whisperflow.app.pickFile({
                  title: "Choose a WhisperFlow backup",
                  filters: [{ name: "WhisperFlow backup", extensions: ["json"] }],
                });
                if (picked.canceled || !picked.path) return;
                const r = await window.whisperflow.app.importBackup({ path: picked.path });
                window.alert(
                  r.ok
                    ? `Import complete — ${r.addedHistory ?? 0} history entries merged.`
                    : `Import failed: ${r.message ?? "unknown error"}`,
                );
              }}
            >
              Import…
            </Button>
          </Row>
          <Row
            label="Update channel"
            hint="Stable is everyone's default. Beta gets fixes sooner and may be rougher."
          >
            <select
              value={config.updates.channel}
              onChange={(e) => void patch({ updates: { channel: e.target.value as "stable" | "beta" } })}
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
            >
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </Row>
          <Row
            label="App updates"
            hint="Checks GitHub Releases at launch and every 6 hours; installs on quit. Settings are preserved."
          >
            <Button
              variant="ghost"
              onClick={() =>
                void window.whisperflowExtras.app.checkForUpdates().then((r) => window.alert(r.message))
              }
            >
              Check now
            </Button>
          </Row>
          <Row label="Downloaded models" hint="models/ + bin/ — reclaim gigabytes via the Models tab.">
            <Button variant="ghost" onClick={() => (window.location.hash = "/models")}>
              Manage models
            </Button>
          </Row>
        </Card>
      </div>

      <p className="mt-6 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-xs leading-5 text-ink-dim">
        Audio is always transcribed locally by whisper.cpp. Transcript text only leaves the machine if
        you disable the lock AND configure a remote polish endpoint. The source code (Apache-2.0) is
        the proof — audit it, or watch the app work behind a firewall.
      </p>
    </section>
  );
}
