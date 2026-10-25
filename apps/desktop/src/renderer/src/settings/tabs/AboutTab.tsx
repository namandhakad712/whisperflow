import { useEffect, useState } from "react";
import { Card, SectionTitle } from "../../shared/ui";

export function AboutTab() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    void window.whisperflow.app.version().then(setVersion);
  }, []);

  return (
    <section>
      <SectionTitle title="About" />
      <Card>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#22d3ee" />
            <g fill="#0b1220">
              <rect x="14" y="26" width="5" height="12" rx="2.5" />
              <rect x="23" y="18" width="5" height="28" rx="2.5" />
              <rect x="32" y="10" width="5" height="44" rx="2.5" />
              <rect x="41" y="20" width="5" height="24" rx="2.5" />
              <rect x="50" y="28" width="5" height="8" rx="2.5" />
            </g>
          </svg>
          <div>
            <p className="font-semibold">WhisperFlow {version}</p>
            <p className="text-xs text-ink-dim">Open-source, local-first AI voice dictation.</p>
          </div>
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-dim">Engine</dt>
            <dd>whisper.cpp · llama.cpp · HuggingFace models</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-dim">License</dt>
            <dd>Apache-2.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-dim">Telemetry</dt>
            <dd>None — not a single line</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-dim">Source</dt>
            <dd>
              <a className="text-accent hover:underline" href="https://github.com/whisperflow/whisperflow">
                github.com/whisperflow
              </a>
            </dd>
          </div>
        </dl>
        <p className="mt-5 border-t border-line/60 pt-4 text-xs leading-5 text-ink-dim">
          Not affiliated with Wispr Inc., OpenAI, Meta, or the Qwen team. Independent clean-room
          project; all code, art, and copy are original.
        </p>
      </Card>
    </section>
  );
}
