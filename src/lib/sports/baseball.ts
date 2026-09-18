import { num } from "../espn";
import type { EspnStat, EspnSummary } from "../espn";
import type { MetricKey } from "../types";
import { createAdapter, DEEP, pitcherFrom, type DeepStats } from "./createAdapter";

const METRIC_KEYS: MetricKey[] = [
  { key: "runs", label: "Carreras totales", short: "Carreras", defaultLine: 8.5, dist: "poisson" },
  { key: "f5_runs", label: "Carreras primeras 5 entradas", short: "F5", defaultLine: 4.5, dist: "poisson" },
  { key: "hits", label: "Hits totales", short: "Hits", defaultLine: 17.5, dist: "normal" },
];

function findStat(stats: EspnStat[] | undefined, name: string): number | undefined {
  for (const s of stats ?? []) {
    if (s.name === name && (s.displayValue !== undefined || s.value !== undefined)) {
      return num(s.displayValue ?? s.value);
    }
    const nested = findStat(s.stats, name);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

/** innings -> f5_runs + hits del boxscore, por equipo. */
function parseSummary(s: EspnSummary): DeepStats {
  const out: DeepStats = {};
  for (const c of s.header?.competitions?.[0]?.competitors ?? []) {
    const id = Number(c.team?.id);
    if (!id) continue;
    const innings = (c.linescores ?? []).map((l) => num(l.displayValue ?? l.value));
    if (innings.length) {
      out[id] = { f5_runs: innings.slice(0, 5).reduce((a, b) => a + b, 0) };
    }
  }
  for (const t of s.boxscore?.teams ?? []) {
    const id = Number(t.team?.id);
    const hits = findStat(t.statistics, "hits");
    if (id && hits !== undefined) {
      out[id] = { ...(out[id] ?? {}), hits };
    }
  }
  return out;
}

export const baseball = createAdapter({
  id: "baseball",
  metricKeys: METRIC_KEYS,
  basePath: "baseball/mlb",
  leagueMeta: () => ({ id: 1, name: "MLB", country: "USA" }),
  seasonYear: (refDate) => new Date(refDate).getUTCFullYear(),
  parseSummary,
  fixtureExtras: (home, away) => ({
    pitchers: { home: pitcherFrom(home), away: pitcherFrom(away) },
  }),
  dataNote: DEEP ? undefined : "ESPN_DEEP=false: solo carreras totales (sin F5 ni hits).",
});
