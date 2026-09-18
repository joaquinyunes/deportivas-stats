import type { SportAdapter, SportId } from "../types";
import { baseball } from "./baseball";
import { basketball } from "./basketball";
import { demoAdapter } from "./demo";
import { football } from "./football";

export { SPORTS, isSportId } from "../sportsMeta";

const REAL: Record<SportId, SportAdapter> = { football, basketball, baseball };

/** true => datos sinteticos (DEMO_MODE=true). Si no, se usa la API de ESPN. */
export function isDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function getAdapter(sport: SportId): SportAdapter {
  const base = REAL[sport];
  if (!base) throw new Error(`Deporte no soportado: ${sport}`);
  return isDemo() ? demoAdapter(base) : base;
}
