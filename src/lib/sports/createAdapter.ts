import {
  completed,
  daysBetween,
  espnGet,
  mapLimit,
  num,
  scoreOf,
  teamLogo,
  TTL,
  yyyymmdd,
} from "../espn";
import type {
  EspnCompetitor,
  EspnEvent,
  EspnScheduleResp,
  EspnScoreboard,
  EspnSummary,
  EspnTeam,
} from "../espn";
import { SPORT_META } from "../sportsMeta";
import { refereeFromDataset } from "../stats";
import type {
  Fixture,
  HistMatch,
  League,
  MetricKey,
  Pitcher,
  RefereeAnalysis,
  SportAdapter,
  SportId,
  Team,
} from "../types";

export const DEEP = process.env.ESPN_DEEP !== "false";

/** metricas "deep" de un partido, por equipo: { teamId: { metricKey: valor } } */
export type DeepStats = Record<number, Record<string, number>>;

export interface EspnAdapterConfig {
  id: SportId;
  metricKeys: MetricKey[];
  /** "soccer" (multi-liga por slug) | "basketball/nba" | "baseball/mlb" */
  basePath: string;
  /** slugs de liga a barrer para "partidos del dia". Ausente = liga unica. */
  leagueSlugs?: string[];
  /** metadata de liga para el Fixture */
  leagueMeta(slug: string | undefined, sbLeagueName: string | undefined): League;
  /** temporada ESPN para el schedule segun la fecha de referencia */
  seasonYear(refDate: string): number;
  /**
   * Path para schedule/summary del historial. Default: la misma liga del fixture.
   * Futbol usa "soccer/all" para traer el form de TODAS las competiciones (liga +
   * copas), asi un partido de Champions no queda "sin datos".
   */
  historyBasePath?: string;
  /** parsea el summary de un partido a metricas deep por equipo */
  parseSummary(summary: EspnSummary): DeepStats;
  /** extrae pitchers probables u otros extras del competitor (scoreboard) */
  fixtureExtras?(home: EspnCompetitor, away: EspnCompetitor): Partial<Fixture>;
  dataNote?: string;
  referee?: boolean;
}

function toTeam(c: EspnTeam): Team {
  return {
    id: Number(c.id),
    name: c.shortDisplayName || c.displayName || c.name || "?",
    logo: teamLogo(c),
  };
}

function pickSides(cs: EspnCompetitor[]): { home: EspnCompetitor; away: EspnCompetitor } {
  const home = cs.find((c) => c.homeAway === "home") ?? cs[0];
  const away = cs.find((c) => c.homeAway === "away") ?? cs[1];
  return { home, away };
}

export function pitcherFrom(c: EspnCompetitor): Pitcher | undefined {
  const p = c.probables?.[0];
  const name = p?.athlete?.fullName || p?.athlete?.displayName || p?.name;
  if (!name) return undefined;
  const eraStat = p?.statistics?.find((s) => s.name === "ERA");
  return {
    name,
    era: eraStat ? num(eraStat.displayValue ?? eraStat.value) : undefined,
    record: p?.record,
  };
}

function createAdapter(cfg: EspnAdapterConfig): SportAdapter {
  const path = (slug: string | undefined) => (slug ? `${cfg.basePath}/${slug}` : cfg.basePath);
  const histPath = (slug: string | undefined) => cfg.historyBasePath ?? path(slug);
  const slugs = cfg.leagueSlugs ?? [undefined];

  function eventToFixture(e: EspnEvent, league: League): Fixture | null {
    const comp = e.competitions?.[0];
    const cs = comp?.competitors;
    if (!cs || cs.length < 2) return null;
    const { home, away } = pickSides(cs);
    return {
      id: Number(e.id),
      sport: cfg.id,
      league,
      date: e.date,
      status: e.status?.type?.name ?? "",
      finished: completed(e),
      home: toTeam(home.team),
      away: toTeam(away.team),
      score: { home: scoreOf(home.score), away: scoreOf(away.score) },
      ...(cfg.fixtureExtras?.(home, away) ?? {}),
    };
  }

  async function scheduleEvents(teamId: number, slug: string | undefined, refDate: string) {
    const seasons = [cfg.seasonYear(refDate), cfg.seasonYear(refDate) - 1];
    let events: EspnEvent[] = [];
    const seen = new Set<string>();
    for (const season of seasons) {
      try {
        const r = await espnGet<EspnScheduleResp>(
          `${histPath(slug)}/teams/${teamId}/schedule?season=${season}`,
          TTL.schedule,
        );
        for (const e of r.events ?? []) {
          if (!completed(e) || seen.has(e.id)) continue;
          if (new Date(e.date) > new Date(refDate)) continue;
          seen.add(e.id);
          events.push(e);
        }
      } catch {
        /* ignora la temporada que falle */
      }
      if (events.length >= 10) break;
    }
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events.slice(0, 10);
  }

  function toHistMatch(e: EspnEvent, teamId: number, deep: DeepStats | null): HistMatch {
    const cs = e.competitions?.[0]?.competitors ?? [];
    const mine = cs.find((c) => Number(c.team.id) === teamId) ?? cs[0];
    const opp = cs.find((c) => Number(c.team.id) !== teamId) ?? cs[1];
    const gf = scoreOf(mine?.score) ?? 0;
    const ga = scoreOf(opp?.score) ?? 0;
    const oppId = opp ? Number(opp.team.id) : 0;
    const mineD = deep?.[teamId] ?? {};
    const oppD = deep?.[oppId] ?? {};

    const primary = cfg.metricKeys[0].key;
    const metrics: HistMatch["metrics"] = { [primary]: { for: gf, against: ga } };
    for (const mk of cfg.metricKeys) {
      if (mk.key === primary) continue;
      if (mineD[mk.key] !== undefined || oppD[mk.key] !== undefined) {
        metrics[mk.key] = { for: mineD[mk.key] ?? 0, against: oppD[mk.key] ?? 0 };
      }
    }

    return {
      id: Number(e.id),
      date: e.date,
      opponent: opp ? toTeam(opp.team) : { id: 0, name: "?", logo: "" },
      isHome: mine?.homeAway === "home",
      scoreFor: gf,
      scoreAgainst: ga,
      result: gf > ga ? "W" : gf < ga ? "L" : "D",
      referee: cfg.referee ? refereeName(deep) : null,
      metrics,
    };
  }

  function refereeName(deep: DeepStats | null): string | null {
    // el nombre viene fuera de DeepStats; se adjunta en el fetch de summary (abajo)
    return (deep as unknown as { __ref?: string })?.__ref ?? null;
  }

  async function summaryFor(slug: string | undefined, eventId: number): Promise<DeepStats | null> {
    if (!DEEP) return null;
    try {
      const s = await espnGet<EspnSummary>(
        `${histPath(slug)}/summary?event=${eventId}`,
        TTL.summary,
      );
      const deep = cfg.parseSummary(s) as DeepStats & { __ref?: string };
      if (cfg.referee) {
        const off =
          s.gameInfo?.officials?.find((o) => o.position?.name === "Referee") ??
          s.gameInfo?.officials?.[0];
        deep.__ref = off?.fullName || off?.displayName || undefined;
      }
      return deep;
    } catch {
      return null;
    }
  }

  const adapter: SportAdapter = {
    id: cfg.id,
    label: SPORT_META[cfg.id].label,
    emoji: SPORT_META[cfg.id].emoji,
    metricKeys: cfg.metricKeys,
    dataNote: cfg.dataNote,

    async getFixturesByDate(date) {
      const day = yyyymmdd(date);
      const perLeague = await mapLimit(slugs, 6, async (slug) => {
        try {
          const sb = await espnGet<EspnScoreboard>(
            `${path(slug)}/scoreboard?dates=${day}`,
            TTL.scoreboard,
          );
          const league = cfg.leagueMeta(slug, sb.leagues?.[0]?.name);
          return (sb.events ?? [])
            .map((e) => eventToFixture(e, league))
            .filter((f): f is Fixture => f !== null);
        } catch {
          return [];
        }
      });
      return perLeague.flat().sort((a, b) => a.date.localeCompare(b.date));
    },

    async getFixtureById(id, { refDate, leagueSlug }) {
      // Partido terminado: 1 request al summary en vez de barrer todas las ligas.
      try {
        const s = await espnGet<EspnSummary>(
          `${histPath(leagueSlug)}/summary?event=${id}`,
          TTL.summary,
        );
        const comp = s.header?.competitions?.[0];
        const cs = comp?.competitors;
        const teams = s.boxscore?.teams;
        if (comp && cs && cs.length >= 2 && teams && teams.length >= 2) {
          const byId = new Map(teams.map((t) => [Number(t.team?.id), t.team!]));
          const { home, away } = pickSides(cs);
          const ht = byId.get(Number(home.team?.id)) ?? home.team;
          const at = byId.get(Number(away.team?.id)) ?? away.team;
          const t = comp.status?.type;
          return {
            id,
            sport: cfg.id,
            league: cfg.leagueMeta(leagueSlug, undefined),
            date: comp.date ?? refDate,
            status: t?.name ?? "",
            finished: t?.completed === true || t?.state === "post",
            home: toTeam(ht),
            away: toTeam(at),
            score: { home: scoreOf(home.score), away: scoreOf(away.score) },
            ...(cfg.fixtureExtras?.(home, away) ?? {}),
          };
        }
      } catch {
        /* cae al fan-out */
      }
      const list = await adapter.getFixturesByDate(refDate);
      const f = list.find((x) => x.id === id);
      if (!f) {
        throw new Error(
          `No se encontro el partido ${id} para ${refDate}. Puede haber cambiado de fecha.`,
        );
      }
      return f;
    },

    async getTeamHistory(teamId, { refDate, leagueSlug }) {
      if (cfg.leagueSlugs && !cfg.historyBasePath && !leagueSlug) return [];
      const last = await scheduleEvents(teamId, leagueSlug, refDate);
      const deep = await mapLimit(last, 4, (e) => summaryFor(leagueSlug, Number(e.id)));
      return last.map((e, i) => toHistMatch(e, teamId, deep[i]));
    },
  };

  if (cfg.referee) {
    adapter.getReferee = async (fixture, history): Promise<RefereeAnalysis | null> => {
      let name = fixture.referee ?? null;
      if (!name) {
        const d = await summaryFor(fixture.league.slug, fixture.id);
        name = (d as unknown as { __ref?: string })?.__ref ?? null;
      }
      if (!name) return null;
      const agg = refereeFromDataset(name, [history.home, history.away]);
      return {
        name,
        sampleSize: agg.sampleSize,
        yellowAvg: agg.yellowAvg,
        redAvg: agg.redAvg,
        foulsAvg: agg.foulsAvg,
        cardsAvg: Math.round((agg.yellowAvg + agg.redAvg) * 100) / 100,
        source: "dataset",
        note:
          agg.sampleSize === 0
            ? "ESPN no expone el historial del arbitro; sin partidos suyos en la muestra."
            : `Promedio sobre ${agg.sampleSize} partido(s) de la muestra que dirigio.`,
      };
    };
  }

  return adapter;
}

export { createAdapter, toTeam, daysBetween };
