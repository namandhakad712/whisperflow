/**
 * Cloud STT via any OpenAI-compatible `/audio/transcriptions` endpoint —
 * primarily Groq's generous free tier (whisper-large-v3-turbo), but any
 * compatible server works. Hard-blocked when the local-only privacy lock
 * is on, exactly like the remote polish provider.
 *
 * One HTTP POST per VAD segment; multipart form with a WAV blob.
 */
import { CLOUD_STT_PRESETS, type WhisperFlowConfig } from "@whisperflow/shared";
import { pcmToWav } from "../../audio/wav.js";

export interface CloudSttOpts {
  language: string;
  prompt?: string;
}

export class CloudSttProvider {
  readonly id = "cloud" as const;

  constructor(private readonly config: () => WhisperFlowConfig) {}

  /** Configured and allowed by privacy settings — segments are skipped otherwise. */
  isReady(): boolean {
    const cfg = this.config();
    if (cfg.privacy.localOnly) return false;
    return Boolean(this.resolved().apiKey);
  }

  async transcribe(pcm: Float32Array, opts: CloudSttOpts): Promise<string> {
    const cfg = this.config();
    if (cfg.privacy.localOnly) {
      throw new Error("Local-only mode is enabled — cloud STT is blocked.");
    }
    const { baseUrl, apiKey, model } = this.resolved();
    if (!apiKey) throw new Error("Cloud STT is not configured (API key missing).");
    if (!model) throw new Error("Cloud STT is not configured (model missing).");

    const wav = pcmToWav(pcm, 16000);
    const form = new FormData();
    form.append("file", new Blob([wav], { type: "audio/wav" }), "chunk.wav");
    form.append("model", model);
    form.append("response_format", "json");
    if (opts.language && opts.language !== "auto") form.append("language", opts.language);
    if (opts.prompt) form.append("prompt", opts.prompt.slice(-500));

    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      body: form,
    });
    if (!res.ok) {
      throw new Error(`cloud STT HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { text?: string };
    return (json.text ?? "").replace(/\s+/g, " ").trim();
  }

  /** Ping the endpoint with the key — verifies auth without sending audio. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const cfg = this.config();
    if (cfg.privacy.localOnly) {
      return { ok: false, message: "Local-only mode is on — cloud STT is blocked." };
    }
    const { baseUrl, apiKey, model } = this.resolved();
    if (!apiKey) return { ok: false, message: "Add an API key first." };
    const base = baseUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${apiKey}` } });
      if (res.status === 401 || res.status === 403) return { ok: false, message: "Key rejected (401/403)." };
      if (!res.ok) return { ok: true, message: `Endpoint answered ${res.status} — key looks usable.` };

      // Best-effort: does the endpoint actually expose the configured model id?
      try {
        const body = (await res.json()) as { data?: Array<{ id?: string }> };
        const ids = (body.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
        if (ids.length > 0 && model && !ids.includes(model)) {
          return {
            ok: true,
            message: `Key works, but "${model}" is not in this endpoint's model list (e.g. ${ids.slice(0, 3).join(", ")}). Double-check the id.`,
          };
        }
      } catch {
        /* non-JSON /models — the 200 already proved the key */
      }
      return { ok: true, message: `Key works — ready to use ${model}.` };
    } catch (err) {
      return { ok: false, message: `Could not reach ${baseUrl}: ${String(err).slice(0, 80)}` };
    }
  }

  /** Resolves preset defaults over user overrides. */
  private resolved(): { baseUrl: string; apiKey: string; model: string } {
    const cloud = this.config().stt.cloud;
    const preset = CLOUD_STT_PRESETS[cloud.provider];
    return {
      baseUrl: cloud.baseUrl || preset.baseUrl,
      apiKey: cloud.apiKey,
      model: cloud.model || preset.defaultModel,
    };
  }
}
