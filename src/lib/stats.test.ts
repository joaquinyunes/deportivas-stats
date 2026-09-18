import { test } from "vitest";
import assert from "node:assert/strict";
import { analyzeTeam, outcome, project } from "./stats";
import type { HistMatch, MetricKey, Team } from "./types";

const TEAM: Team = { id: 1, name: "Test", logo: "" };
const GOALS: MetricKey[] = [{ key: "goals", label: "Goles", defaultLine: 2.5, dist: "poisson" }];
const PTS: MetricKey[] = [{ key: "points", label: "Puntos", defaultLine: 220.5, dist: "normal" }];

function hist(forVals: number[], againstVals: number[], key = "goals"): HistMatch[] {
  return forVals.map((f, i) => ({
    id: i,
    date: new Date(2026, 0, 30 - i).toISOString(),
    opponent: { id: 99, name: "Opp", logo: "" },
    isHome: i % 2 === 0,
    scoreFor: f,
    scoreAgainst: againstVals[i],
    result: f > againstVals[i] ? "W" : f < againstVals[i] ? "L" : "D",
    metrics: { [key]: { for: f, against: againstVals[i] } },
  }));
}

test("analyzeTeam pondera por recencia: los partidos recientes pesan mas", () => {
  // indice 0 = mas reciente. Recientes = 3 goles, viejos = 1 gol. Media simple = 2.
  const m = hist([3, 3, 3, 3, 3, 1, 1, 1, 1, 1], Array(10).fill(1));
  const a = analyzeTeam(TEAM, m, GOALS);
  const goals = a.metrics[0];
  assert.ok(goals.forAvg > 2.3, `forAvg ${goals.forAvg} deberia inclinarse a lo reciente`);
  assert.equal(goals.samples, 10);
});

test("analyzeTeam marca tendencia al alza", () => {
  const m = hist([4, 4, 4, 4, 4, 1, 1, 1, 1, 1], Array(10).fill(0));
  const a = analyzeTeam(TEAM, m, GOALS);
  assert.equal(a.metrics[0].trend, "up");
});

test("project: totalExpected alto sobre la linea => lean over y pOver alto", () => {
  const home = analyzeTeam(TEAM, hist(Array(10).fill(3), Array(10).fill(2)), GOALS);
  const away = analyzeTeam(
    { ...TEAM, id: 2 },
    hist(Array(10).fill(3), Array(10).fill(2)),
    GOALS,
  );
  const p = project(home, away, GOALS)[0];
  assert.ok(p.totalExpected > 4);
  assert.ok(p.pOver !== undefined && p.pOver > 0.7, `pOver ${p.pOver}`);
  assert.equal(p.lean, "over");
});

test("outcome futbol: las probabilidades suman ~1 y btts esta en rango", () => {
  const home = analyzeTeam(TEAM, hist([2, 1, 3, 2, 1, 2, 2, 1, 3, 2], [1, 1, 0, 2, 1, 1, 0, 1, 2, 1]), GOALS);
  const away = analyzeTeam(
    { ...TEAM, id: 2 },
    hist([1, 1, 0, 2, 1, 1, 2, 0, 1, 1], [2, 1, 3, 1, 2, 2, 1, 2, 1, 2]),
    GOALS,
  );
  const o = outcome(home, away, GOALS, "football");
  const sum = o.homeWin + o.draw + o.awayWin;
  assert.ok(Math.abs(sum - 1) < 0.02, `suma ${sum}`);
  assert.ok(o.btts !== undefined && o.btts >= 0 && o.btts <= 1);
  assert.equal(o.topScores?.length, 3);
});

test("outcome NBA: sin empate, homeWin + awayWin ~ 1, favorito el de mayor esperado", () => {
  const home = analyzeTeam(TEAM, hist(Array(10).fill(120), Array(10).fill(110), "points"), PTS);
  const away = analyzeTeam(
    { ...TEAM, id: 2 },
    hist(Array(10).fill(105), Array(10).fill(112), "points"),
    PTS,
  );
  const o = outcome(home, away, PTS, "basketball");
  assert.equal(o.draw, 0);
  assert.ok(Math.abs(o.homeWin + o.awayWin - 1) < 0.001);
  assert.ok(o.homeWin > 0.5);
  assert.ok(o.margin !== undefined && o.margin > 0);
});
