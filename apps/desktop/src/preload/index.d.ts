import type { PreloadApi } from "./index";

declare global {
  interface Window {
    whisperflow: PreloadApi;
  }
}

export {};
