import { useEffect, useState } from "react";
import { useSettings } from "../store";
import { Card, PageHeader, Row, TextInput, Toggle } from "../../shared/ui";

type Shape = "pill" | "rect" | "blob";
type Position = "cursor" | "floating" | "top-left" | "top-right" | "top" | "bottom";

const SHAPES: Array<{ id: Shape; label: string; className: string }> = [
  { id: "pill", label: "Pill", className: "rounded-2xl" },
  { id: "rect", label: "Rectangle", className: "rounded-md" },
  { id: "blob", label: "Blob", className: "rounded-[38px_24px_42px_20px]" },
];

const POSITIONS: Array<{ id: Position; label: string; hint: string }> = [
  { id: "cursor", label: "Near cursor", hint: "Pops up where you're already typing" },
  {
    id: "floating",
    label: "Floating",
    hint: "Parked bottom-right of the active display — never under the taskbar",
  },
  { id: "top-left", label: "Top left", hint: "Pinned to the corner; re-clamped when monitors change" },
  { id: "top-right", label: "Top right", hint: "Pinned to the corner; re-clamped when monitors change" },
  { id: "top", label: "Top center", hint: "Fixed to the top center of your display" },
  { id: "bottom", label: "Bottom center", hint: "Fixed to the bottom center — out of the way" },
];

export function OverlayTab() {
  const config = useSettings((s) => s.config);
  const patch = useSettings((s) => s.patchConfig);
  const [backdropLocal, setBackdropLocal] = useState("");

  useEffect(() => {
    if (config) setBackdropLocal(config.general.overlayBackdrop);
  }, [config]);

  if (!config) return null;
  const g = config.general;

  return (
    <section>
      <PageHeader
        title="Overlay"
        tagline="The pill that follows your voice."
        explainer="Shape, position, and your own backdrop — plus dictation modes for meetings and recording."
      />

      <Card className="mb-5">
        <Row label="Shape" hint="The silhouette of the floating pill.">
          <div className="flex gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void patch({ general: { overlayStyle: s.id } })}
                className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  g.overlayStyle === s.id
                    ? "border-accent/70 bg-accent/10 text-ink"
                    : "border-line bg-surface-2/60 text-ink-dim hover:border-accent/40"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Position" hint="Where the pill appears when you start dictating.">
          <div className="flex gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void patch({ general: { overlayPosition: p.id } })}
                className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  g.overlayPosition === p.id
                    ? "border-accent/70 bg-accent/10 text-ink"
                    : "border-line bg-surface-2/60 text-ink-dim hover:border-accent/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Custom backdrop" hint="An image or GIF drawn behind the pill, under a dark scrim.">
          <div className="flex gap-2">
            <TextInput
              value={backdropLocal}
              onChange={setBackdropLocal}
              placeholder="C:\pics\wave.gif or https://…"
              className="w-56"
              onKeyDown={(e) => {
                if (e.key === "Enter") void patch({ general: { overlayBackdrop: backdropLocal } });
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const picked = await window.whisperflow.app.pickFile({
                  title: "Choose a backdrop image or GIF",
                  filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
                });
                if (!picked.canceled && picked.path) {
                  setBackdropLocal(picked.path);
                  void patch({ general: { overlayBackdrop: picked.path } });
                }
              }}
              className="shrink-0 rounded-lg border border-line bg-surface-2 px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent/50"
            >
              Browse…
            </button>
            {g.overlayBackdrop && (
              <button
                type="button"
                onClick={() => {
                  setBackdropLocal("");
                  void patch({ general: { overlayBackdrop: "" } });
                }}
                className="shrink-0 rounded-lg border border-line bg-surface-2 px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent/50"
              >
                Clear
              </button>
            )}
          </div>
        </Row>
      </Card>

      {/* Live preview in the chosen shape/position */}
      <Card className="mb-5">
        <p className="mb-3 text-[15px] font-semibold">Preview</p>
        <div className="flex h-44 items-center justify-center rounded-xl border border-line bg-bg/40">
          <div
            className={`h-24 w-64 border border-line/70 bg-surface/90 p-3 backdrop-blur-xl shadow-[0_10px_44px_rgba(41,82,227,0.18)] ${
              SHAPES.find((s) => s.id === g.overlayStyle)?.className ?? "rounded-2xl"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-ink-dim">Listening</p>
            </div>
            <div className="mt-3 flex h-8 items-center justify-center gap-1">
              {Array.from({ length: 18 }, (_, i) => (
                <span
                  key={i}
                  className="h-full w-1 rounded-full bg-accent/80"
                  style={{ transform: `scaleY(${0.25 + ((i * 37) % 70) / 100})` }}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <Row
          label="Meeting mode"
          hint="Keep the session open across pauses. Each finished utterance is pasted the moment it's transcribed — meetings, lectures, interviews. Press the hotkey again to finish."
        >
          <Toggle
            checked={g.meetingMode}
            onChange={(v) => void patch({ general: { meetingMode: v } })}
          />
        </Row>
        <Row
          label="Save dictation audio"
          hint="Every dictation's WAV is saved next to its transcript, in your recordings folder."
        >
          <Toggle checked={g.saveAudio} onChange={(v) => void patch({ general: { saveAudio: v } })} />
        </Row>
        <Row label="Recordings folder" hint="Blank = %APPDATA%/WhisperFlow/recordings.">
          <div className="flex gap-2">
            <TextInput
              value={g.recordingsDir}
              onChange={(v) => void patch({ general: { recordingsDir: v } })}
              placeholder="C:\Users\you\Music\WhisperFlow recordings"
              className="w-64"
            />
            <button
              type="button"
              onClick={async () => {
                const picked = await window.whisperflow.app.pickFolder({
                  title: "Choose the recordings folder",
                });
                if (!picked.canceled && picked.path) {
                  void patch({ general: { recordingsDir: picked.path } });
                }
              }}
              className="shrink-0 rounded-lg border border-line bg-surface-2 px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent/50"
            >
              Browse…
            </button>
          </div>
        </Row>
      </Card>

      <p className="mt-5 text-xs leading-5 text-ink-dim">
        Start a pure recording from the tray menu — “Start recorder…” runs meeting mode and saves the
        WAV without you touching a window.
      </p>
    </section>
  );
}
