import type { Fixture, HistMatch, SportAdapter, SportId, Team } from "../types";

/** RNG determinista para que la demo sea estable entre recargas. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface DemoTeam {
  id: number;
  name: string;
}

const TEAMS: Record<SportId, DemoTeam[]> = {
  football: [
    { id: 101, name: "River Plate" },
    { id: 102, name: "Boca Juniors" },
    { id: 103, name: "Racing Club" },
    { id: 104, name: "Independiente" },
    { id: 105, name: "San Lorenzo" },
    { id: 106, name: "Velez Sarsfield" },
    { id: 107, name: "Estudiantes" },
    { id: 108, name: "Talleres" },
  ],
  basketball: [
    { id: 201, name: "Boston Celtics" },
    { id: 202, name: "Denver Nuggets" },
    { id: 203, name: "Milwaukee Bucks" },
    { id: 204, name: "LA Lakers" },
    { id: 205, name: "Golden State Warriors" },
    { id: 206, name: "Phoenix Suns" },
    { id: 207, name: "Miami Heat" },
    { id: 208, name: "Dallas Mavericks" },
  ],
  baseball: [
    { id: 301, name: "New York Yankees" },
    { id: 302, name: "Los Angeles Dodgers" },
    { id: 303, name: "Houston Astros" },
    { id: 304, name: "Atlanta Braves" },
    { id: 305, name: "Boston Red Sox" },
    { id: 306, name: "Chicago Cubs" },
    { id: 307, name: "San Diego Padres" },
    { id: 308, name: "Philadelphia Phillies" },
  ],
};

const LEAGUES: Record<SportId, { id: number; name: string; country: string }> = {
  football: { id: 128, name: "Liga Profesional (demo)", country: "Argentina" },
  basketball: { id: 12, name: "NBA (demo)", country: "USA" },
  baseball: { id: 1, name: "MLB (demo)", country: "USA" },
};

const REFEREES = ["Dario Herrera", "Fernando Rapallini", "Nicolas Ramirez", "Facundo Tello"];

const BASE: Record<string, number> = {
  goals: 1.35,
  corners: 5.1,
  yellow: 2.0,
  red: 0.14,
  shots: 12.5,
  shots_on: 4.4,
  fouls: 12.5,
  offsides: 1.9,
  points: 112,
  first_half: 55,
  first_quarter: 28,
  runs: 4.3,
  f5_runs: 2.4,
  hits: 8.5,
};

function team(_sport: SportId, t: DemoTeam): Team {
  return { id: t.id, name: t.name, logo: "" };
}

function draw(rng: () => number, base: number, variance: number): number {
  const v = base * (1 + (rng() - 0.5) * variance);
  return base < 3 ? Math.max(0, Math.round(v)) : Math.round(v);
}

function buildHistory(adapter: SportAdapter, teamId: number): HistMatch[] {
  const sport = adapter.id;
  const pool = TEAMS[sport];
  const self = pool.find((t) => t.id === teamId) ?? pool[0];
  const rng = mulberry32(hash(`${sport}:${teamId}`));
  const strength = 0.85 + rng() * 0.35;

  const selfIdx = pool.indexOf(self);
  return Array.from({ length: 10 }, (_, i) => {
    const opp = pool[(selfIdx + 1 + (i % (pool.length - 1))) % pool.length];
    const isHome = i % 2 === 0;
    const metrics: HistMatch["metrics"] = {};
    for (const mk of adapter.metricKeys) {
      const base = BASE[mk.key] ?? mk.defaultLine ?? 5;
      metrics[mk.key] = {
        for: draw(rng, base * strength, 0.7),
        against: draw(rng, base / strength, 0.7),
      };
    }
    const sf = metrics[adapter.metricKeys[0].key].for;
    const sa = metrics[adapter.metricKeys[0].key].against;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (i + 1) * 4);

    return {
      id: hash(`${sport}:${teamId}:${i}`),
      date: d.toISOString(),
      opponent: team(sport, opp),
      isHome,
      scoreFor: sf,
      scoreAgainst: sa,
      result: sf > sa ? "W" : sf < sa ? "L" : "D",
      referee: sport === "football" ? REFEREES[hash(`ref:${teamId}:${i}`) % REFEREES.length] : null,
      metrics,
    };
  });
}

function buildFixtures(adapter: SportAdapter, date: string): Fixture[] {
  const sport = adapter.id;
  const rng = mulberry32(hash(`${sport}:${date}`));
  const league = LEAGUES[sport];
  const pool = [...TEAMS[sport]];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const fixtures: Fixture[] = [];
  for (let i = 0; i + 1 < pool.length && i < 8; i += 2) {
    const home = pool[i];
    const away = pool[i + 1];
    const kickoff = new Date(`${date.slice(0, 10)}T${(16 + i).toString().padStart(2, "0")}:00:00Z`);
    fixtures.push({
      id: hash(`${sport}:${date}:${i}`),
      sport,
      league: { id: league.id, name: league.name, country: league.country },
      date: kickoff.toISOString(),
      status: "NS",
      finished: false,
      home: team(sport, home),
      away: team(sport, away),
      score: { home: null, away: null },
      referee:
        sport === "football" ? REFEREES[hash(`${sport}:${date}:${i}:ref`) % REFEREES.length] : null,
    });
  }
  return fixtures;
}

function demoReferee(name: string, teamA: number, teamB: number) {
  const rng = mulberry32(hash(`ref:${name}:${teamA}:${teamB}`));
  const yellow = Math.round((3.4 + rng() * 3) * 100) / 100;
  const red = Math.round(rng() * 45) / 100;
  const fouls = Math.round((19 + rng() * 8) * 10) / 10;
  return {
    name,
    sampleSize: 8 + Math.floor(rng() * 12),
    yellowAvg: yellow,
    redAvg: red,
    foulsAvg: fouls,
    cardsAvg: Math.round((yellow + red) * 100) / 100,
    source: "dataset" as const,
    note: "Demo: promedio sintetico estable para este arbitro.",
  };
}

/** Envuelve un adapter real reemplazando las llamadas de red por datos sinteticos. */
export function demoAdapter(base: SportAdapter, note?: string): SportAdapter {
  return {
    ...base,
    demo: true,
    dataNote: note,
    async getFixturesByDate(date) {
      return buildFixtures(base, date);
    },
    async getFixtureById(id, { refDate }) {
      const f = buildFixtures(base, refDate).find((x) => x.id === id);
      if (!f) throw new Error(`Demo: no existe el partido ${id} para ${refDate}.`);
      return f;
    },
    async getTeamHistory(teamId) {
      return buildHistory(base, teamId);
    },
    getReferee: base.getReferee
      ? async (fixture) =>
          fixture.referee
            ? demoReferee(fixture.referee, fixture.home.id, fixture.away.id)
            : null
      : undefined,
  };
}
