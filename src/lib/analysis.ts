import { daysBetween } from "./espn";
import { getAdapter } from "./sports";
import { analyzeTeam, outcome, project } from "./stats";
import type { Fixture, MatchAnalysis, SportId } from "./types";

export async function getFixtures(sport: SportId, date: string): Promise<Fixture[]> {
  return getAdapter(sport).getFixturesByDate(date);
}

export async function buildMatchAnalysis(
  sport: SportId,
  fixtureId: number,
  date: string,
  leagueSlug?: string,
): Promise<MatchAnalysis> {
  const adapter = getAdapter(sport);
  const fixture = await adapter.getFixtureById(fixtureId, { refDate: date, leagueSlug });

  const opts = { refDate: date, leagueSlug: fixture.league.slug ?? leagueSlug };
  const [homeHist, awayHist] = await Promise.all([
    adapter.getTeamHistory(fixture.home.id, opts),
    adapter.getTeamHistory(fixture.away.id, opts),
  ]);

  const home = analyzeTeam(fixture.home, homeHist, adapter.metricKeys);
  const away = analyzeTeam(fixture.away, awayHist, adapter.metricKeys);
  home.restDays = homeHist[0] ? daysBetween(fixture.date, homeHist[0].date) : null;
  away.restDays = awayHist[0] ? daysBetween(fixture.date, awayHist[0].date) : null;

  const projections = project(home, away, adapter.metricKeys);
  const matchOutcome = outcome(home, away, adapter.metricKeys, sport);
  const referee = adapter.getReferee
    ? await adapter.getReferee(fixture, { home: homeHist, away: awayHist })
    : null;

  return {
    fixture,
    home,
    away,
    outcome: matchOutcome,
    projections,
    referee,
    generatedAt: new Date().toISOString(),
    demo: adapter.demo === true,
  };
}
