import type { WhisperflowApi } from "@whisperflow/shared";

declare global {
  interface Window {
    whisperflow: WhisperflowApi;
    whisperflowExtras: {
      dictation: { cancel(): Promise<{ ok: boolean }> };
      app: {
        setLaunchAtLogin(enabled: boolean): Promise<void>;
        rebindHotkey(accelerator: string): Promise<{ ok: boolean }>;
        checkForUpdates(): Promise<{ message: string }>;
        exportBackup(): Promise<{ exported: boolean; path?: string }>;
        onNavigate(cb: (route: string) => void): () => void;
      };
    };
  }
}

export {};
