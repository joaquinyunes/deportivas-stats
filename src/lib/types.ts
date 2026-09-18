export type SportId = "football" | "basketball" | "baseball";

export interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface League {
  id: number;
  name: string;
  country?: string;
  logo?: string;
  /** slug de ESPN (ej "eng.1"), necesario para el historial de futbol */
  slug?: string;
}

/** Pitcher probable (MLB). El abridor es el factor dominante de la linea de carreras. */
export interface Pitcher {
  name: string;
  era?: number;
  record?: string;
}

export interface Fixture {
  id: number;
  sport: SportId;
  league: League;
  date: string; // ISO
  status: string;
  finished: boolean;
  home: Team;
  away: Team;
  score: { home: number | null; away: number | null };
  referee?: string | null;
  /** MLB: pitchers probables por lado */
  pitchers?: { home?: Pitcher; away?: Pitcher };
}

/** Un partido historico de un equipo, ya normalizado. Orden: indice 0 = mas reciente. */
export interface HistMatch {
  id: number;
  date: string;
  opponent: Team;
  isHome: boolean;
  scoreFor: number | null;
  scoreAgainst: number | null;
  result: "W" | "D" | "L" | null;
  referee?: string | null;
  /** metricas crudas por partido: key -> { for, against } */
  metrics: Record<string, { for: number; against: number }>;
}

export interface MetricKey {
  key: string;
  label: string;
  /** etiqueta corta para tablas densas */
  short?: string;
  unit?: string;
  /** linea sugerida para over/under */
  defaultLine?: number;
  /** distribucion para estimar P(over). "poisson" para conteos chicos, "normal" para totales grandes. */
  dist?: "poisson" | "normal";
}

export interface MetricAverage {
  key: string;
  label: string;
  unit?: string;
  /** promedios ponderados por recencia (el ultimo partido pesa mas) */
  forAvg: number;
  againstAvg: number;
  totalAvg: number;
  line?: number;
  overPct?: number; // % de partidos del equipo por encima de la linea (total del partido)
  samples: number;
  /** promedio del total en los ultimos 5 (para comparar con la muestra de 10) */
  last5Avg?: number;
  /** tendencia del total: L5 vs L10 */
  trend?: "up" | "down" | "flat";
  /** promedio de "favor" solo de local */
  homeForAvg?: number;
  /** promedio de "favor" solo de visitante */
  awayForAvg?: number;
}

export interface MatchOutcome {
  /** goles/puntos/carreras esperados por lado */
  homeExp: number;
  awayExp: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  /** futbol: ambos equipos marcan */
  btts?: number;
  /** futbol: 3 marcadores mas probables */
  topScores?: { score: string; p: number }[];
  /** NBA/MLB: margen esperado (local - visitante) */
  margin?: number;
}

export interface TeamAnalysis {
  team: Team;
  sampleSize: number;
  form: ("W" | "D" | "L")[];
  record: { w: number; d: number; l: number };
  winPct: number;
  metrics: MetricAverage[];
  matches: HistMatch[];
  /** dias de descanso desde el ultimo partido (relevante en NBA: back-to-back) */
  restDays?: number | null;
}

export interface Projection {
  key: string;
  label: string;
  unit?: string;
  homeExpected: number;
  awayExpected: number;
  totalExpected: number;
  line?: number;
  /** hit rate historico combinado de ambos equipos (referencia secundaria) */
  overPct?: number;
  /** P(total > linea) segun el modelo (0..1) */
  pOver?: number;
  lean?: "over" | "under" | "push";
  /** min de la muestra usable de ambos equipos para esta metrica */
  samples: number;
}

export interface RefereeAnalysis {
  name: string;
  sampleSize: number;
  yellowAvg: number;
  redAvg: number;
  foulsAvg?: number;
  cardsAvg: number;
  source: "dataset" | "api";
  note?: string;
}

export interface MatchAnalysis {
  fixture: Fixture;
  home: TeamAnalysis;
  away: TeamAnalysis;
  outcome: MatchOutcome;
  projections: Projection[];
  referee?: RefereeAnalysis | null;
  generatedAt: string;
  demo: boolean;
}

export interface SportAdapter {
  id: SportId;
  label: string;
  emoji: string;
  metricKeys: MetricKey[];
  /** aviso a mostrar en la UI (ej: restriccion de temporada del plan free) */
  dataNote?: string;
  /** true si el adapter devuelve datos sinteticos */
  demo?: boolean;
  getFixturesByDate(date: string): Promise<Fixture[]>;
  getFixtureById(
    id: number,
    opts: { refDate: string; leagueSlug?: string },
  ): Promise<Fixture>;
  getTeamHistory(
    teamId: number,
    opts: { refDate: string; leagueSlug?: string },
  ): Promise<HistMatch[]>;
  getReferee?(
    fixture: Fixture,
    history: { home: HistMatch[]; away: HistMatch[] },
  ): Promise<RefereeAnalysis | null>;
}
