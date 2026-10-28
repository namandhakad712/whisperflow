import type { WhisperflowApi } from "@whisperflow/shared";

declare global {
  interface Window {
    whisperflow: WhisperflowApi;
    whisperflowExtras: {
      dictation: { cancel(): Promise<{ ok: boolean }> };
      app: {
        setLaunchAtLogin(enabled: boolean): Promise<void>;
        rebindHotkey(accelerator: string): Promise<{ ok: boolean }>;
        rebindShortcut(action: "pasteLast" | "copyLast", accelerator: string): Promise<{ ok: boolean }>;
        checkForUpdates(): Promise<{ message: string }>;
        exportBackup(): Promise<{ exported: boolean; path?: string }>;
        onNavigate(cb: (route: string) => void): () => void;
        keyboardHookStatus(): Promise<{ available: boolean; reason?: string }>;
        testCloudPolish(): Promise<{ ok: boolean; message: string }>;
        pickFile(request?: {
          title?: string;
          filters?: Array<{ name: string; extensions: string[] }>;
          readText?: boolean;
        }): Promise<{ canceled: boolean; path?: string; content?: string }>;
      };
      settings: { onChanged(cb: () => void): () => void };
      overlay: { setInteractive(interactive: boolean): void };
    };
  }
}

export {};
