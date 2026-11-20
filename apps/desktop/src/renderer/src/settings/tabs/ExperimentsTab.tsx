import { useSettings } from "../store";
import { Card, PageHeader, Switch } from "../../shared/ui";

/**
 * Experiments — features that are real and usable but still baking.
 *
 * Sequential dictation: while one utterance is being transcribed and polished,
 * the mic stays open and the next utterance queues behind it — each one is
 * pasted in order the moment it's ready.
 */
export function ExperimentsTab() {
  const config = useSettings((s) => s.config);
  const patchConfig = useSettings((s) => s.patchConfig);

  if (!config) return null;

  const sequential = config.audio.sequential === true;

  const toggleSequential = () => {
    void patchConfig({ audio: { sequential: !sequential } });
  };

  return (
    <div>
      <PageHeader title="Experiments" tagline="Bleeding edge, still baking." explainer="Features that work today and keep getting better." />
      <div className="mt-6 space-y-3">
        <Card className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">Sequential dictation</p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-dim">
              Keep talking while the previous sentence is transcribed and polished — each
              utterance queues up and is pasted in order, so a slow AI polish never blocks
              your next thought.
            </p>
          </div>
          <Switch checked={sequential} onChange={toggleSequential} aria-label="Sequential dictation" />
        </Card>
      </div>
    </div>
  );
}