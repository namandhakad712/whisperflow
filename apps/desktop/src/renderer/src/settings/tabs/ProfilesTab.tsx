import { useState } from "react";
import { useSettings } from "../store";
import { Button, Card, EmptyState, PageHeader, TextInput } from "../../shared/ui";

/**
 * Config profiles: named work/home layers over the base config. Switching
 * applies the layer live (a top-level-key merge); the base config never
 * changes. Each profile stores its own top-level patch.
 */
export function ProfilesTab() {
  const config = useSettings((s) => s.config);
  const patchConfig = useSettings((s) => s.patchConfig);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  if (!config) return null;

  const layers = config.profiles?.layers ?? {};
  const active = config.profiles?.active ?? "";
  const names = Object.keys(layers);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Give the profile a name.");
      window.setTimeout(() => setNotice(null), 4000);
      return;
    }
    if (layers[trimmed]) {
      setNotice(`"${trimmed}" already exists.`);
      window.setTimeout(() => setNotice(null), 4000);
      return;
    }
    void patchConfig({ profiles: { layers: { ...layers, [trimmed]: {} } } }).then(() => setName(""));
  };

  const activate = (n: string) => {
    void patchConfig({ profiles: { active: n } });
  };

  const remove = (n: string) => {
    const next = { ...layers };
    delete next[n];
    void patchConfig({
      profiles: {
        ...(active === n ? { active: "" } : {}),
        layers: next,
      },
    });
  };

  return (
    <section>
      <PageHeader
        title="Profiles"
        actions={
          <div className="flex gap-2">
            <TextInput
              value={name}
              onChange={setName}
              placeholder="New profile name — work, home…"
              className="w-48"
            />
            <Button onClick={create}>Create</Button>
          </div>
        }
        tagline="Work and home, one machine."
        explainer="A profile is a layer over your base config: switch it and dictation behaves differently (tone, models, dictionary) without losing your global settings."
      />

      {names.length === 0 && (
        <EmptyState
          icon="👥"
          title="No profiles yet"
          body="Create one to keep a separate work or home setup."
        />
      )}

      {names.map((n) => (
        <Card key={n} className="mb-2">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {n} {active === n && <span className="text-xs text-accent">· active</span>}
              </p>
              <p className="truncate text-xs text-ink-dim">
                {Object.keys(layers[n] ?? {}).length
                  ? `${Object.keys(layers[n]!).length} override(s)`
                  : "No overrides yet"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {active !== n && <Button onClick={() => activate(n)}>Switch</Button>}
              {active === n && <Button variant="ghost" disabled>Active</Button>}
              <Button variant="ghost" onClick={() => remove(n)}>Delete</Button>
            </div>
          </div>
        </Card>
      ))}

      {notice && <p className="mt-2 text-xs text-ink-dim">{notice}</p>}
    </section>
  );
}