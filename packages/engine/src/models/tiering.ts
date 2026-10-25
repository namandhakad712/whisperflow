/**
 * Hardware tiering: read RAM, recommend a model set. Users always override.
 */
import os from "node:os";
import type { HardwareTier, TierRecommendation } from "@whisperflow/shared";

export function detectTier(totalMemBytes: number = os.totalmem()): HardwareTier {
  const gb = totalMemBytes / 1024 ** 3;
  if (gb < 8) return "low";
  if (gb < 17.2) return "mid";
  return "high";
}

export function recommendFor(tier: HardwareTier): TierRecommendation {
  switch (tier) {
    case "low":
      return { tier, stt: "whisper-base-en", polish: "qwen3.5-2b-q4", polishViable: true, vad: "silero-vad" };
    case "mid":
      return { tier, stt: "whisper-small", polish: "qwen3.5-4b-q4", polishViable: true, vad: "silero-vad" };
    case "high":
      return { tier, stt: "whisper-large-v3-turbo", polish: "qwen3.5-4b-q4", polishViable: true, vad: "silero-vad" };
  }
}

export function recommend(): TierRecommendation {
  return recommendFor(detectTier());
}
