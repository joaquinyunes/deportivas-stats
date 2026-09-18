import { num } from "../espn";
import type { EspnSummary } from "../espn";
import type { MetricKey } from "../types";
import { createAdapter, DEEP, type DeepStats } from "./createAdapter";

const METRIC_KEYS: MetricKey[] = [
  { key: "points", label: "Puntos totales", short: "Puntos", defaultLine: 225.5, dist: "normal" },
  { key: "first_half", label: "Puntos 1ra mitad", short: "1ra mitad", defaultLine: 112.5, dist: "normal" },
  { key: "first_quarter", label: "Puntos 1er cuarto", short: "1er Q", defaultLine: 56.5, dist: "normal" },
];

/** linescores por cuarto -> first_half / first_quarter por equipo. */
function parseSummary(s: EspnSummary): DeepStats {
  const out: DeepStats = {};
  for (const c of s.header?.competitions?.[0]?.competitors ?? []) {
    const id = Number(c.team?.id);
    if (!id) continue;
    const q = (c.linescores ?? []).map((l) => num(l.displayValue ?? l.value));
    if (q.length >= 2) {
      out[id] = { first_quarter: q[0], first_half: q[0] + q[1] };
    }
  }
  return out;
}

export const basketball = createAdapter({
  id: "basketball",
  metricKeys: METRIC_KEYS,
  basePath: "basketball/nba",
  leagueMeta: () => ({ id: 12, name: "NBA", country: "USA" }),
  seasonYear: (refDate) => {
    // ESPN rotula la temporada por el ano de fin (2026 = 2025-26).
    const d = new Date(refDate);
    return d.getUTCMonth() + 1 >= 10 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  },
  parseSummary,
  dataNote: DEEP ? undefined : "ESPN_DEEP=false: solo puntos totales (sin cuartos/mitades).",
});
