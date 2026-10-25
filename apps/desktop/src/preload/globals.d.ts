import type { WhisperflowApi } from "@whisperflow/shared";

declare global {
  interface Window {
    whisperflow: WhisperflowApi;
    whisperflowExtras: {
      dictation: { cancel(): Promise<{ ok: boolean }> };
      app: {
        setLaunchAtLogin(enabled: boolean): Promise<void>;
        rebindHotkey(accelerator: string): Promise<{ ok: boolean }>;
        onNavigate(cb: (route: string) => void): () => void;
      };
    };
  }
}

export {};
