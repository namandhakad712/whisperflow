import { startSystemCapture } from "./capture";

startSystemCapture().catch((err) => {
  console.error("system-audio: capture failed —", err);
});
