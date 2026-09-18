import { num } from "../espn";
import type { EspnSummary } from "../espn";
import type { MetricKey } from "../types";
import { createAdapter, DEEP, type DeepStats } from "./createAdapter";

// Ligas de futbol a consultar para "partidos del dia". Override: SOCCER_LEAGUES="eng.1,esp.1,...".
const DEFAULT_LEAGUES =
  "eng.1,esp.1,ita.1,ger.1,fra.1,por.1,ned.1,eng.2,usa.1,mex.1,arg.1,bra.1,uefa.champions,uefa.europa,conmebol.libertadores";
const LEAGUES = (process.env.SOCCER_LEAGUES || DEFAULT_LEAGUES)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const LEAGUE_NAMES: Record<string, string> = {
  "eng.1": "Premier League",
  "esp.1": "LaLiga",
  "ita.1": "Serie A",
  "ger.1": "Bundesliga",
  "fra.1": "Ligue 1",
  "por.1": "Primeira Liga",
  "ned.1": "Eredivisie",
  "eng.2": "Championship",
  "usa.1": "MLS",
  "mex.1": "Liga MX",
  "arg.1": "Liga Profesional",
  "bra.1": "Brasileirão",
  "uefa.champions": "Champions League",
  "uefa.europa": "Europa League",
  "conmebol.libertadores": "Libertadores",
};

const METRIC_KEYS: MetricKey[] = [
  { key: "goals", label: "Goles", short: "Goles", defaultLine: 2.5, dist: "poisson" },
  { key: "corners", label: "Corners", short: "Corners", defaultLine: 9.5, dist: "poisson" },
  { key: "yellow", label: "Tarjetas amarillas", short: "Amar.", defaultLine: 4.5, dist: "poisson" },
  { key: "red", label: "Tarjetas rojas", short: "Rojas", defaultLine: 0.5, dist: "poisson" },
  { key: "shots", label: "Remates totales", short: "Remates", defaultLine: 25.5, dist: "normal" },
  { key: "shots_on", label: "Remates al arco", short: "Rem. arco", defaultLine: 8.5, dist: "poisson" },
  { key: "fouls", label: "Faltas", short: "Faltas", defaultLine: 22.5, dist: "normal" },
  { key: "offsides", label: "Offsides", short: "Offside", defaultLine: 3.5, dist: "poisson" },
];

const STAT_MAP: Record<string, string> = {
  wonCorners: "corners",
  yellowCards: "yellow",
  redCards: "red",
  totalShots: "shots",
  shotsOnTarget: "shots_on",
  foulsCommitted: "fouls",
  offsides: "offsides",
};

function parseSummary(s: EspnSummary): DeepStats {
  const out: DeepStats = {};
  for (const t of s.boxscore?.teams ?? []) {
    const id = Number(t.team?.id);
    if (!id) continue;
    const rec: Record<string, number> = {};
    for (const st of t.statistics ?? []) {
      const key = st.name && STAT_MAP[st.name];
      if (key) rec[key] = num(st.displayValue ?? st.value);
    }
    out[id] = rec;
  }
  return out;
}

export const football = createAdapter({
  id: "football",
  metricKeys: METRIC_KEYS,
  basePath: "soccer",
  leagueSlugs: LEAGUES,
  historyBasePath: "soccer/all",
  leagueMeta: (slug, sbName) => ({
    id: 0,
    name: sbName || (slug ? LEAGUE_NAMES[slug] ?? slug : "Futbol"),
    slug: slug ?? undefined,
  }),
  seasonYear: (refDate) => {
    const d = new Date(refDate);
    return d.getUTCMonth() + 1 >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  },
  parseSummary,
  referee: true,
  dataNote: DEEP
    ? undefined
    : "ESPN_DEEP=false: solo goles. Activalo para corners, tarjetas y remates.",
});
