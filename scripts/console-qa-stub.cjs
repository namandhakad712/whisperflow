/** Shared QA bridge stub — extracted from console-qa.cjs (v0.1.42 harness).
 *  Injected into settings.html before the bundle; enough API surface for
 *  the whole shell + tabs to render. */
/** The preload bridge, stubbed: enough for the shell + tabs to render. */
function bridgeStubFactory() {
  const listeners = new Map();
  const on = (ch) => (cb) => {
    if (!listeners.has(ch)) listeners.set(ch, new Set());
    listeners.get(ch).add(cb);
    return () => listeners.get(ch).delete(cb);
  };
  const config = {
    general: { meetingMode: false, overlayBackdrop: "blur", overlayTint: "", overlayFollowSystemTheme: false },
    hotkey: { pushToTalk: "Control+Shift+Space" },
    audio: { deviceId: "default", vad: { sensitivity: 0.5 } },
    stt: { provider: "whispercpp-local", modelId: "whisper-small", language: "auto", languages: [], autoDetect: true, cloud: { apiKey: "", provider: "groq" } },
    polish: { provider: "llama-local" },
    dictionary: [],
    commands: [{ id: "c1", phrase: "scratch that", mode: "undo", text: "" }],
  };
  const api = {
    settings: { get: async () => JSON.parse(JSON.stringify(config)), set: async () => {}, onChanged: (cb) => on("settings")(cb) },
    dictation: { onState: on("state"), start: async () => {} },
    audio: { devices: async () => [{ deviceId: "default", label: "Default Microphone" }] },
    models: {
      list: async () => [],
      catalog: async () => [
        { id: "whisper-base.en", role: "stt", format: "ggml", name: "Whisper base.en", notes: "fast, 74M params — good on any CPU", sizeBytes: 148000000, repo: "ggml-org/whisper.cpp", file: "base.en.bin", url: "#", tiers: ["light", "balanced", "heavy"] },
        { id: "whisper-small", role: "stt", format: "ggml", name: "Whisper small", notes: "balanced — the default pick", sizeBytes: 488000000, repo: "ggml-org/whisper.cpp", file: "small.bin", url: "#", tiers: ["balanced", "heavy"] },
      ],
      status: async () => [
        { entryId: "whisper-bin-x64", state: "downloaded" },
        { entryId: "whisper-small", state: "downloaded" },
      ],
      recommend: async () => null,
      onProgress: on("progress"),
      download: async () => {},
      remove: async () => {},
    },
    updates: { onStatus: on("updates") },
    app: { version: async () => "0.1.42", hardware: async () => ({ cpu: "QA CPU", ramGb: 16, gpu: "QA GPU", tier: "balanced" }), quitAndInstall: () => {}, onboardingComplete: async () => {} },
    history: { list: async () => [
      { id: "h1", at: Date.now() - 3600e3, text: "ship the demo tomorrow, the launch is monday", mode: "push-to-talk", durationMs: 4200 },
      { id: "h2", at: Date.now() - 86400e3, text: "tell the team we're live", mode: "toggle", durationMs: 2600 },
    ], clear: async () => {} },
    capture: { sendPcm: () => {} },
    dictionary: { add: async () => {}, delete: async () => {} },
    commands: { add: async () => {}, delete: async () => {} },
  };
  const extras = {
    system: { theme: async () => ({ dark: true }), onTheme: on("theme") },
    overlay: { onRest: on("rest"), onAlign: on("align"), onSound: on("sound"), setInteractive: () => {} },
    settings: { onChanged: (cb) => on("settings")(cb) },
    app: { onNavigate: on("navigate"), onboardingComplete: async () => {} },
  };
  return { whisperflow: api, whisperflowExtras: extras };
}


module.exports = { bridgeStubFactory };
