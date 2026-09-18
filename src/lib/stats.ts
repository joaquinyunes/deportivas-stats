import type {
  HistMatch,
  MatchOutcome,
  MetricAverage,
  MetricKey,
  Projection,
  SportId,
  Team,
  TeamAnalysis,
} from "./types";

// Un partido de hace 8 fechas no vale lo mismo que el ultimo: peso = DECAY^indice
// (indice 0 = mas reciente). Con 0.82 el 10mo partido pesa ~0.17 vs 1.0 del ultimo.
const DECAY = 0.82;

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

interface Sample {
  v: number;
  w: number;
}

function wMean(s: Sample[]): number {
  let sw = 0;
  let swv = 0;
  for (const { v, w } of s) {
    sw += w;
    swv += w * v;
  }
  return sw ? swv / sw : 0;
}

function wStd(s: Sample[], m: number): number {
  if (s.length < 2) return 0;
  let sw = 0;
  let swv = 0;
  for (const { v, w } of s) {
    sw += w;
    swv += w * (v - m) ** 2;
  }
  return sw ? Math.sqrt(swv / sw) : 0;
}

type Side = "for" | "against";
type Venue = "home" | "away" | "all";

function pass(m: HistMatch, venue: Venue): boolean {
  return venue === "all" || (venue === "home") === m.isHome;
}

function sideSamples(matches: HistMatch[], key: string, side: Side, venue: Venue): Sample[] {
  const out: Sample[] = [];
  matches.forEach((m, i) => {
    if (!pass(m, venue)) return;
    const cell = m.metrics[key];
    if (!cell) return;
    out.push({ v: cell[side], w: DECAY ** i });
  });
  return out;
}

function totalSamples(matches: HistMatch[], key: string, venue: Venue): Sample[] {
  const out: Sample[] = [];
  matches.forEach((m, i) => {
    if (!pass(m, venue)) return;
    const cell = m.metrics[key];
    if (!cell) return;
    out.push({ v: cell.for + cell.against, w: DECAY ** i });
  });
  return out;
}

/**
 * Estimacion de una metrica con shrinkage: cuando la muestra del venue (local o
 * visita) es chica, se mezcla con el promedio global del equipo.
 */
function estimate(matches: HistMatch[], key: string, side: Side, venue: Venue): number {
  const overall = wMean(sideSamples(matches, key, side, "all"));
  if (venue === "all") return overall;
  const v = sideSamples(matches, key, side, venue);
  const k = v.length / (v.length + 4);
  return k * wMean(v) + (1 - k) * overall;
}

// ---- distribuciones ----

/** P(X <= k) para X ~ Poisson(lambda). */
function poissonCdf(k: number, lambda: number): number {
  if (k < 0 || lambda <= 0) return k < 0 ? 0 : 1;
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(1, sum);
}

/** [P(X=0), ..., P(X=n)] para X ~ Poisson(lambda). */
function poissonPmf(lambda: number, n: number): number[] {
  const out = new Array(n + 1);
  out[0] = Math.exp(-Math.max(0, lambda));
  for (let i = 1; i <= n; i++) out[i] = (out[i - 1] * lambda) / i;
  return out;
}

/** P(Z <= z) para la normal estandar (aprox. Abramowitz-Stegun). */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    1 -
    d *
      t *
      (0.319381530 +
        t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}

export function analyzeTeam(
  team: Team,
  matches: HistMatch[],
  metricKeys: MetricKey[],
): TeamAnalysis {
  const sample = matches.slice(0, 10);
  const n = sample.length;

  const record = { w: 0, d: 0, l: 0 };
  const form: ("W" | "D" | "L")[] = [];
  for (const m of sample) {
    if (m.result === "W") record.w++;
    else if (m.result === "D") record.d++;
    else if (m.result === "L") record.l++;
    if (m.result) form.push(m.result);
  }

  const metrics: MetricAverage[] = metricKeys.map((mk) => {
    const totS = totalSamples(sample, mk.key, "all");
    const line = mk.defaultLine;
    const overPct =
      line !== undefined && totS.length
        ? round((totS.filter((s) => s.v > line).length / totS.length) * 100, 0)
        : undefined;
    const forAvg = round(wMean(sideSamples(sample, mk.key, "for", "all")));
    // tendencia: total de los ultimos 5 vs el promedio de los 10
    const totAll = wMean(totS);
    const tot5 = wMean(totalSamples(sample.slice(0, 5), mk.key, "all"));
    let trend: MetricAverage["trend"];
    if (totS.length >= 5 && totAll > 0) {
      const delta = (tot5 - totAll) / totAll;
      trend = delta > 0.08 ? "up" : delta < -0.08 ? "down" : "flat";
    }
    return {
      key: mk.key,
      label: mk.label,
      unit: mk.unit,
      forAvg,
      againstAvg: round(wMean(sideSamples(sample, mk.key, "against", "all"))),
      totalAvg: round(totAll),
      last5Avg: totS.length >= 5 ? round(tot5) : undefined,
      trend,
      line,
      overPct,
      samples: totS.length,
      homeForAvg: round(estimate(sample, mk.key, "for", "home")),
      awayForAvg: round(estimate(sample, mk.key, "for", "away")),
    };
  });

  return {
    team,
    sampleSize: n,
    form: form.slice(0, 5).reverse(),
    record,
    winPct: n ? round((record.w / n) * 100, 0) : 0,
    metrics,
    matches: sample,
  };
}

/**
 * Proyeccion estilo footystats, pero: (1) ponderada por recencia, (2) el equipo
 * local usa sus splits de local y el visitante los de visita, (3) P(over) sale de
 * una Poisson/Normal segun la metrica, no del promedio de hit rates.
 */
export function project(
  home: TeamAnalysis,
  away: TeamAnalysis,
  metricKeys: MetricKey[],
): Projection[] {
  return metricKeys.map((mk) => {
    const hFor = estimate(home.matches, mk.key, "for", "home");
    const hAgainst = estimate(home.matches, mk.key, "against", "home");
    const aFor = estimate(away.matches, mk.key, "for", "away");
    const aAgainst = estimate(away.matches, mk.key, "against", "away");

    const homeExpected = round(mean([hFor, aAgainst]));
    const awayExpected = round(mean([aFor, hAgainst]));
    const totalExpected = round(homeExpected + awayExpected);
    const line = mk.defaultLine;

    const hm = home.metrics.find((m) => m.key === mk.key);
    const am = away.metrics.find((m) => m.key === mk.key);
    const overPct =
      hm?.overPct !== undefined && am?.overPct !== undefined
        ? round(mean([hm.overPct, am.overPct]), 0)
        : undefined;
    const samples = Math.min(hm?.samples ?? 0, am?.samples ?? 0);

    let pOver: number | undefined;
    let lean: Projection["lean"];
    if (line !== undefined && samples > 0) {
      if ((mk.dist ?? "poisson") === "normal") {
        const pooled = [
          ...totalSamples(home.matches, mk.key, "all"),
          ...totalSamples(away.matches, mk.key, "all"),
        ];
        const m = wMean(pooled);
        const sd = wStd(pooled, m) || Math.max(1, totalExpected * 0.09);
        pOver = 1 - normCdf((line - totalExpected) / sd);
      } else {
        pOver = 1 - poissonCdf(Math.floor(line), totalExpected);
      }
      pOver = round(pOver, 3);
      lean = pOver >= 0.57 ? "over" : pOver <= 0.43 ? "under" : "push";
    }

    return {
      key: mk.key,
      label: mk.label,
      unit: mk.unit,
      homeExpected,
      awayExpected,
      totalExpected,
      line,
      overPct,
      pOver,
      lean,
      samples,
    };
  });
}

/**
 * Resultado del partido. Futbol: 1X2 + ambos marcan + marcadores mas probables
 * (Poisson independiente sobre los goles esperados de cada equipo). NBA/MLB: prob
 * de ganar el local y margen esperado (Normal sobre la diferencia).
 */
export function outcome(
  home: TeamAnalysis,
  away: TeamAnalysis,
  metricKeys: MetricKey[],
  sportId: SportId,
): MatchOutcome {
  const primary = metricKeys[0].key;
  const hExp =
    (estimate(home.matches, primary, "for", "home") +
      estimate(away.matches, primary, "against", "away")) /
    2;
  const aExp =
    (estimate(away.matches, primary, "for", "away") +
      estimate(home.matches, primary, "against", "home")) /
    2;

  if (sportId === "football") {
    const N = 8;
    const hp = poissonPmf(hExp, N);
    const ap = poissonPmf(aExp, N);
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    const grid: { s: string; p: number }[] = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const p = hp[i] * ap[j];
        grid.push({ s: `${i}-${j}`, p });
        if (i > j) homeWin += p;
        else if (i === j) draw += p;
        else awayWin += p;
      }
    }
    grid.sort((a, b) => b.p - a.p);
    return {
      homeExp: round(hExp),
      awayExp: round(aExp),
      homeWin: round(homeWin, 3),
      draw: round(draw, 3),
      awayWin: round(awayWin, 3),
      btts: round((1 - Math.exp(-hExp)) * (1 - Math.exp(-aExp)), 3),
      topScores: grid.slice(0, 3).map((g) => ({ score: g.s, p: round(g.p, 3) })),
    };
  }

  const hStd = wStd(
    sideSamples(home.matches, primary, "for", "all"),
    estimate(home.matches, primary, "for", "all"),
  );
  const aStd = wStd(
    sideSamples(away.matches, primary, "for", "all"),
    estimate(away.matches, primary, "for", "all"),
  );
  const sigma = Math.sqrt(hStd ** 2 + aStd ** 2) || Math.max(1, (hExp + aExp) * 0.06);
  const margin = hExp - aExp;
  const homeWin = round(normCdf(margin / sigma), 3);
  return {
    homeExp: round(hExp),
    awayExp: round(aExp),
    homeWin,
    draw: 0,
    awayWin: round(1 - homeWin, 3),
    margin: round(margin, 1),
  };
}

/** Agrega tarjetas de un arbitro a partir de los partidos ya cargados que dirigio. */
export function refereeFromDataset(
  name: string,
  pools: HistMatch[][],
): { sampleSize: number; yellowAvg: number; redAvg: number; foulsAvg?: number } {
  const seen = new Set<number>();
  const yellow: number[] = [];
  const red: number[] = [];
  const fouls: number[] = [];
  for (const pool of pools) {
    for (const m of pool) {
      if (seen.has(m.id)) continue;
      if (!m.referee || m.referee.toLowerCase() !== name.toLowerCase()) continue;
      seen.add(m.id);
      const y = m.metrics["yellow"];
      const r = m.metrics["red"];
      const f = m.metrics["fouls"];
      if (y) yellow.push(y.for + y.against);
      if (r) red.push(r.for + r.against);
      if (f) fouls.push(f.for + f.against);
    }
  }
  return {
    sampleSize: yellow.length,
    yellowAvg: round(mean(yellow)),
    redAvg: round(mean(red)),
    foulsAvg: fouls.length ? round(mean(fouls)) : undefined,
  };
}

export { round, mean };
