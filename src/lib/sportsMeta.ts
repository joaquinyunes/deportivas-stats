import type { SportId } from "./types";

/** Fuente unica de nombre/emoji por deporte. Client-safe (sin imports de red). */
export const SPORT_META: Record<SportId, { label: string; emoji: string }> = {
  football: { label: "Futbol", emoji: "⚽" },
  basketball: { label: "NBA", emoji: "🏀" },
  baseball: { label: "MLB", emoji: "⚾" },
};

export const SPORTS = (Object.keys(SPORT_META) as SportId[]).map((id) => ({
  id,
  ...SPORT_META[id],
}));

export function isSportId(v: string): v is SportId {
  return v === "football" || v === "basketball" || v === "baseball";
}
