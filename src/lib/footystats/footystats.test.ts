import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { claveCuota, clavePct, resolverColumnas } from "./columns";
import { parseFechaHora } from "./dates";
import {
  ajustarPorMuestra,
  calcularVentaja,
  devig,
  devig3,
  evaluarPartido,
  evaluarPick,
  inferirMuestra,
  poisson1x2,
  poissonOver,
} from "./engine";
import { esLigaGrande } from "./leagues";
import { normalizarNombre } from "./normalize";
import { parseCsv } from "./parse";
import { resolverPicks, porBanda } from "./performance";
import { guardarSubida, snapshotPicks, unirConPrevia } from "./storage";
import { CONFIG_DEFAULT, type CsvMatch, type Subida } from "./types";
import { FILTROS_DEFAULT, evaluar, filasDe, filtrosAQuery, ordenarSecciones, parseFiltros, seccionar, tarjetasDe } from "./view";

function partido(extra: Partial<CsvMatch> = {}): CsvMatch {
  return {
    key: "2026-10-22T18:45|aaa|bbb",
    dayKey: "2026-10-22|aaa|bbb",
    kickoff: "2026-10-22T18:45:00.000Z",
    liga: "Europa League",
    pais: "Europe",
    local: "AAA",
    visitante: "BBB",
    estado: "incomplete",
    virtual: false,
    xgLocal: 1.6,
    xgVisitante: 1.1,
    muestra: 7,
    pct: { over05: 100, over15: 86, over25: 57, over35: 29, over45: 14, btts: 57 },
    odds: {
      "ft:over:2.5": 1.9,
      "ft:under:2.5": 1.9,
      "btts:yes": 1.8,
      "btts:no": 2.0,
      "1x2:1": 2.2,
      "1x2:X": 3.4,
      "1x2:2": 3.3,
    },
    promGoles: 2.7,
    promCorners: 9.8,
    promTarjetas: 4.2,
    url: null,
    resultado: null,
    ...extra,
  };
}

describe("devig", () => {
  it("reparte el margen: las dos probabilidades suman 1", () => {
    const { a, b } = devig(1.8, 2.0);
    expect(a + b).toBeCloseTo(1, 10);
    expect(a).toBeCloseTo(0.5263, 3); // (1/1.8)/(1/1.8+1/2)
  });
  it("una cuota pareja sin margen queda 50/50", () => {
    expect(devig(2, 2).a).toBeCloseTo(0.5, 10);
  });
  it("devig3 suma 1", () => {
    const [x, y, z] = devig3(2.2, 3.4, 3.3);
    expect(x + y + z).toBeCloseTo(1, 10);
  });
});

describe("inferirMuestra", () => {
  it("43 y 86 salen de 7 partidos", () => {
    expect(inferirMuestra([43, 86])).toBe(7);
  });
  it("50, 33 y 67 juntos piden 6", () => {
    expect(inferirMuestra([50, 33, 67])).toBe(6);
  });
  it("todo en 0 o 100 es muestra 1", () => {
    expect(inferirMuestra([0, 100, 0])).toBe(1);
  });
  it("sin denominador chico que explique la fila devuelve null", () => {
    expect(inferirMuestra([43, 52, 61, 17], 20)).toBeNull();
  });
  it("tolera una columna de otra base (fila real: 93, 80, 73, 60 son /15, 19 no)", () => {
    expect(inferirMuestra([93, 80, 73, 60, 19])).toBe(15);
    expect(inferirMuestra([93, 80, 73, 60, 19], 40, 1)).not.toBe(15);
  });
});

describe("ajustarPorMuestra", () => {
  it("con muestra 1 queda pegada al mercado", () => {
    const aj = ajustarPorMuestra(1, 0.5, 1, 5);
    expect(aj).toBeCloseTo(0.5833, 3);
    expect(Math.abs(aj - 0.5)).toBeLessThan(Math.abs(aj - 1));
  });
  it("con muestra grande queda casi en el historico", () => {
    expect(ajustarPorMuestra(0.9, 0.5, 200, 5)).toBeGreaterThan(0.89);
  });
  it("K configurable: K=0 devuelve el historico", () => {
    expect(ajustarPorMuestra(0.8, 0.5, 4, 0)).toBeCloseTo(0.8, 10);
  });
  it("ventaja en puntos porcentuales", () => {
    expect(calcularVentaja(0.62, 0.55)).toBeCloseTo(7, 10);
  });
});

describe("poisson", () => {
  it("1X2 suma 1 y favorece al de mas xG", () => {
    const r = poisson1x2(2, 0.8);
    expect(r.local + r.empate + r.visitante).toBeCloseTo(1, 10);
    expect(r.local).toBeGreaterThan(r.visitante);
  });
  it("over 2.5 con lambda 2.7 ronda 50%", () => {
    expect(poissonOver(2.7, 2.5)).toBeCloseTo(0.505, 2);
  });
});

describe("evaluarPartido", () => {
  const mercados = evaluarPartido(partido());
  const get = (id: string) => mercados.find((m) => m.id === id)!;

  it("evalua goles, ambos marcan y resultado; sin cuotas de corners no hay corners", () => {
    expect(mercados.map((m) => m.grupo)).toContain("goles");
    expect(mercados.map((m) => m.grupo)).toContain("btts");
    expect(mercados.map((m) => m.grupo)).toContain("resultado");
    expect(mercados.some((m) => m.grupo === "corners")).toBe(false);
  });
  it("over y under del mismo mercado suman 1", () => {
    const o = get("goles|over|2.5");
    const u = get("goles|under|2.5");
    expect(o.pAjustada + u.pAjustada).toBeCloseTo(1, 10);
    expect(o.pMercado + u.pMercado).toBeCloseTo(1, 10);
  });
  it("la linea 0.5 usa la columna Over05 (regresion: la clave salia como over5)", () => {
    const m = evaluarPartido(
      partido({ pct: { over05: 93 }, odds: { "ft:over:0.5": 1.1, "ft:under:0.5": 7 } }),
    );
    expect(m.map((x) => x.id)).toEqual(["goles|over|0.5", "goles|under|0.5"]);
  });
  it("una linea sin las dos cuotas se omite (no se estima)", () => {
    expect(mercados.some((m) => m.id === "goles|over|1.5")).toBe(false);
    const m = evaluarPartido(partido({ odds: { "ft:over:2.5": 1.9 } }));
    expect(m.some((x) => x.grupo === "goles")).toBe(false);
  });
  it("muestra = 1: la ajustada queda mas cerca del mercado que del 100% historico", () => {
    const m = evaluarPartido(
      partido({ muestra: 1, pct: { over25: 100, btts: 100 }, odds: { "ft:over:2.5": 1.9, "ft:under:2.5": 1.9 } }),
    );
    const o = m.find((x) => x.id === "goles|over|2.5")!;
    expect(o.pHist).toBe(1);
    expect(o.pAjustada - o.pMercado).toBeLessThan(o.pHist - o.pAjustada);
  });
  it("la ventaja es ajustada menos mercado, en puntos", () => {
    const o = get("goles|over|2.5");
    expect(o.ventaja).toBeCloseTo((o.pAjustada - o.pMercado) * 100, 10);
  });
  it("doble oportunidad = suma de dos resultados", () => {
    expect(get("resultado|1X").pMercado).toBeCloseTo(get("resultado|1").pMercado + get("resultado|X").pMercado, 10);
  });
  it("sin xG no hay mercado de resultado", () => {
    expect(evaluarPartido(partido({ xgLocal: null })).some((m) => m.grupo === "resultado")).toBe(false);
  });
  it("con golesPoisson el historico de goles sale del xG", () => {
    const base = evaluarPartido(partido({ muestra: 30 })).find((m) => m.id === "goles|over|2.5")!;
    const poi = evaluarPartido(partido({ muestra: 30 }), { ...CONFIG_DEFAULT, golesPoisson: true }).find((m) => m.id === "goles|over|2.5")!;
    expect(poi.pHist).toBeCloseTo(poissonOver(2.7, 2.5), 10);
    expect(poi.pHist).not.toBeCloseTo(base.pHist, 2);
  });
  it("corners usa las columnas c85/c95/c105 con su par de cuotas", () => {
    const m = evaluarPartido(
      partido({ pct: { c95: 70 }, odds: { "corners:over:9.5": 1.85, "corners:under:9.5": 1.95 } }),
    );
    expect(m.map((x) => x.id)).toEqual(["corners|over|9.5", "corners|under|9.5"]);
  });
});

describe("evaluarPick", () => {
  const r = (gl: number, gv: number, corners: number | null = null) => ({ golesLocal: gl, golesVisitante: gv, corners });
  it("goles", () => {
    expect(evaluarPick("goles|over|2.5", r(2, 1))).toBe("acierto");
    expect(evaluarPick("goles|under|2.5", r(2, 1))).toBe("fallo");
  });
  it("btts y 1X2", () => {
    expect(evaluarPick("btts|si", r(1, 1))).toBe("acierto");
    expect(evaluarPick("btts|no", r(1, 0))).toBe("acierto");
    expect(evaluarPick("resultado|X", r(0, 0))).toBe("acierto");
    expect(evaluarPick("resultado|1X", r(0, 1))).toBe("fallo");
    expect(evaluarPick("resultado|12", r(2, 2))).toBe("fallo");
  });
  it("empate anula devuelve nulo si hay empate", () => {
    expect(evaluarPick("resultado|dnb1", r(1, 1))).toBe("nulo");
    expect(evaluarPick("resultado|dnb1", r(2, 1))).toBe("acierto");
  });
  it("corners sin dato es nulo", () => {
    expect(evaluarPick("corners|over|9.5", r(1, 1))).toBe("nulo");
    expect(evaluarPick("corners|over|9.5", r(1, 1, 11))).toBe("acierto");
  });
});

describe("columnas", () => {
  it("reconoce cuotas con distintas grafias", () => {
    expect(claveCuota("oddsover25")).toBe("ft:over:2.5");
    expect(claveCuota("oddsunder25")).toBe("ft:under:2.5");
    expect(claveCuota("oddscornersover105")).toBe("corners:over:10.5");
    expect(claveCuota("oddsbttsyes")).toBe("btts:yes");
    expect(claveCuota("oddshomewin")).toBe("1x2:1");
    expect(claveCuota("odds1sthalfover05")).toBe("h1:over:0.5");
    expect(claveCuota("oddsfoo")).toBeNull();
  });
  it("reconoce % historicos", () => {
    expect(clavePct("over25average")).toBe("over25");
    expect(clavePct("bttsaverage")).toBe("btts");
    expect(clavePct("averageover85corners")).toBe("c85");
    expect(clavePct("averagegoals")).toBeNull();
  });
  it("mapea encabezados reales con espacios y guiones", () => {
    const m = resolverColumnas(["League", "Home Team", "Away Team", "Home Team Pre-Match xG", "Over25 Average", "Odds_Over25", "Average Over 9.5 Corners"]);
    expect(m.liga).toBe("League");
    expect(m.xgLocal).toBe("Home Team Pre-Match xG");
    expect(m.pct.over25).toBe("Over25 Average");
    expect(m.pct.c95).toBe("Average Over 9.5 Corners");
    expect(m.odds["ft:over:2.5"]).toBe("Odds_Over25");
  });
});

describe("fechas y nombres", () => {
  it("parsea los formatos de FootyStats", () => {
    expect(parseFechaHora("1761158700")).toBe("2025-10-22T18:45:00.000Z");
    expect(parseFechaHora("2026-10-22 18:45")).toBe("2026-10-22T18:45:00.000Z");
    expect(parseFechaHora("Oct 22 2026 - 6:45pm")).toBe("2026-10-22T18:45:00.000Z");
    expect(parseFechaHora("22/10/2026 18:45")).toBe("2026-10-22T18:45:00.000Z");
    expect(parseFechaHora("2026-10-22T18:45:00+02:00")).toBe("2026-10-22T16:45:00.000Z");
    expect(parseFechaHora("basura")).toBeNull();
  });
  it("normaliza nombres", () => {
    expect(normalizarNombre("  Mjällby   AIF ")).toBe("mjallby aif");
    expect(normalizarNombre("Red Star-Belgrade")).toBe("red star belgrade");
  });
  it("ligas grandes", () => {
    expect(esLigaGrande("England", "Premier League")).toBe(true);
    expect(esLigaGrande("", "England Premier League")).toBe(true);
    expect(esLigaGrande("Europe", "UEFA Europa League")).toBe(true);
    expect(esLigaGrande("Brazil", "Serie A")).toBe(false);
    expect(esLigaGrande("Bulgaria", "Second League")).toBe(false);
    expect(esLigaGrande("Europe", "Champions League Women")).toBe(false);
    expect(esLigaGrande("Asia", "AFC Champions League")).toBe(false);
    expect(esLigaGrande("Africa", "CAF Champions League")).toBe(false);
    expect(esLigaGrande("Europe", "UEFA Champions League")).toBe(true);
  });
});

const HEAD = [
  "League", "Country", "Home Team", "Away Team", "Match Status", "Date (UTC)",
  "Home Team Pre-Match xG", "Away Team Pre-Match xG",
  "Over05 Average", "Over15 Average", "Over25 Average", "Over35 Average", "Over45 Average", "BTTS Average",
  "Average Goals", "Average Cards", "Match FootyStats URL",
  "Odds_Home_Win", "Odds_Draw", "Odds_Away_Win", "Odds_Over25", "Odds_Under25", "Odds_BTTS_Yes", "Odds_BTTS_No",
  "Home Team Goals", "Away Team Goals",
];
const fila = (v: Record<string, string | number>) => HEAD.map((h) => v[h] ?? "").join(",");
const BASE = {
  League: "Europa League", Country: "Europe", "Date (UTC)": "2026-10-22 18:45", "Match Status": "incomplete",
  "Home Team Pre-Match xG": 1.6, "Away Team Pre-Match xG": 1.1,
  "Over05 Average": 100, "Over15 Average": 86, "Over25 Average": 57, "Over35 Average": 29, "Over45 Average": 14, "BTTS Average": 57,
  "Average Goals": 2.7, "Average Cards": 4.2, "Match FootyStats URL": "https://footystats.org/x",
  Odds_Home_Win: 2.2, Odds_Draw: 3.4, Odds_Away_Win: 3.3, Odds_Over25: 1.9, Odds_Under25: 1.9, Odds_BTTS_Yes: 1.8, Odds_BTTS_No: 2,
};

describe("parseCsv", () => {
  const csv = [
    HEAD.join(","),
    fila({ ...BASE, "Home Team": "Alfa", "Away Team": "Beta" }),
    fila({ ...BASE, "Home Team": "Gamma", "Away Team": "Delta", "Match Status": "complete", "Home Team Goals": 3, "Away Team Goals": 1 }),
    fila({ ...BASE, League: "Esoccer Battle - 8 mins play", "Home Team": "Arsenal (X)", "Away Team": "Roma (Y)" }),
    fila({ ...BASE, "Home Team": "Pausado", "Away Team": "Otro", "Match Status": "suspended" }),
    fila({ ...BASE, "Home Team": "", "Away Team": "Sin local" }),
    fila({ ...BASE, "Home Team": '"Club, con coma"', "Away Team": "Epsilon", "Odds_Over25": "" }),
  ].join("\n");
  const r = parseCsv("﻿" + csv);

  it("cuenta lo que entra y lo que se descarta, con motivo", () => {
    expect(r.resumen.filasTotales).toBe(6);
    expect(r.resumen.filasValidas).toBe(4);
    expect(r.resumen.virtuales).toBe(1);
    expect(r.resumen.incompletos).toBe(2);
    expect(r.resumen.jugados).toBe(1);
    expect(r.resumen.descartadas.map((d) => d.motivo)).toEqual(
      expect.arrayContaining(["Estado no jugable (suspended)", "Sin nombre de local o visitante"]),
    );
    expect(r.resumen.columnasFaltantes).toEqual([]);
  });
  it("marca el virtual y lo deja afuera de la vista por defecto", () => {
    expect(r.matches.find((m) => m.local.startsWith("Arsenal"))?.virtual).toBe(true);
    const visibles = filasDe(evaluar(r.matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50 });
    expect(visibles.some((f) => f.match.virtual)).toBe(false);
  });
  it("infiere la muestra (57, 86, 29, 14 -> 7) y guarda el resultado de los jugados", () => {
    const alfa = r.matches.find((m) => m.local === "Alfa")!;
    expect(alfa.muestra).toBe(7);
    expect(alfa.resultado).toBeNull();
    expect(r.matches.find((m) => m.local === "Gamma")?.resultado).toEqual({ golesLocal: 3, golesVisitante: 1, corners: null });
    expect(r.fecha).toBe("2026-10-22");
  });
  it("una cuota vacia deja el mercado afuera, no lo estima", () => {
    const coma = r.matches.find((m) => m.local === "Club, con coma")!;
    expect(evaluarPartido(coma).some((m) => m.grupo === "goles")).toBe(false);
  });
  it("avisa cuando faltan columnas", () => {
    const r2 = parseCsv("Home Team,Away Team\nA,B");
    expect(r2.resumen.columnasFaltantes.length).toBeGreaterThan(0);
  });
  it("reescala porcentajes en 0-1", () => {
    const r2 = parseCsv("Home Team,Away Team,Over25 Average,Odds_Over25,Odds_Under25\nA,B,0.5,1.9,1.9");
    expect(r2.matches[0].pct.over25).toBe(50);
  });
});

describe("tablero", () => {
  const matches = [
    partido(),
    partido({ key: "k2", dayKey: "d2", local: "CCC", visitante: "DDD", kickoff: "2026-10-22T21:00:00.000Z", muestra: 2, liga: "Primera B", pais: "Bulgaria" }),
    partido({ key: "k3", dayKey: "d3", local: "EEE", visitante: "FFF", estado: "complete" }),
  ];
  it("descarta jugados y respeta la muestra minima", () => {
    const todos = filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50 });
    expect(todos.some((f) => f.match.local === "EEE")).toBe(false);
    expect(todos.some((f) => f.match.local === "CCC")).toBe(true);
    const m7 = filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50, muestra: 7 });
    expect(m7.some((f) => f.match.local === "CCC")).toBe(false);
  });
  it("probabilidad minima y ventaja minima recortan", () => {
    const base = filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50 });
    const alto = filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 90 });
    expect(alto.length).toBeLessThan(base.length);
    const adv = filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50, ventaja: 30 });
    expect(adv.every((f) => f.mercado.ventaja >= 30)).toBe(true);
  });
  it("agrupar por mercado crea todas las secciones, incluso vacias", () => {
    const s = seccionar(filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50 }), "mercado");
    expect(s.map((x) => x.id)).toEqual(["goles", "btts", "corners", "resultado", "primer", "segundo"]);
    expect(s.find((x) => x.id === "corners")?.filas).toEqual([]);
  });
  it("dentro de cada seccion, mejores primero", () => {
    for (const s of seccionar(filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50 }), "hora")) {
      const ps = s.filas.map((f) => f.mercado.pAjustada);
      expect(ps).toEqual([...ps].sort((a, b) => b - a));
    }
  });
  it("se puede ordenar por otra columna", () => {
    const secs = ordenarSecciones(seccionar(filasDe(evaluar(matches, CONFIG_DEFAULT), { ...FILTROS_DEFAULT, prob: 50 }), "mercado"), { col: "ventaja", dir: 1 });
    for (const s of secs) {
      const v = s.filas.map((f) => f.mercado.ventaja);
      expect(v).toEqual([...v].sort((a, b) => a - b));
    }
  });
  it("tarjetas se ordenan por promedio, sin ventaja", () => {
    const t = tarjetasDe([partido({ promTarjetas: 3 }), partido({ key: "x", promTarjetas: 6 })], FILTROS_DEFAULT);
    expect(t.map((m) => m.promTarjetas)).toEqual([6, 3]);
  });
  it("los filtros viajan por URL y los defaults no ensucian", () => {
    expect(filtrosAQuery(FILTROS_DEFAULT).toString()).toBe("");
    const f = parseFiltros(new URLSearchParams("muestra=7&prob=80&agrupar=mercado&grandes=1"));
    expect(f).toMatchObject({ muestra: 7, prob: 80, agrupar: "mercado", grandes: true });
    expect(parseFiltros(new URLSearchParams(filtrosAQuery(f).toString()))).toEqual(f);
    expect(parseFiltros(new URLSearchParams("prob=999&muestra=abc")).prob).toBe(95);
    // la muestra se ajusta al escalon del selector, asi lo que se ve es lo que se aplica
    expect(parseFiltros(new URLSearchParams("muestra=3")).muestra).toBe(1);
    expect(parseFiltros(new URLSearchParams("muestra=9")).muestra).toBe(7);
    expect(parseFiltros(new URLSearchParams("muestra=20")).muestra).toBe(15);
  });
});

describe("rendimiento (el lazo)", () => {
  it("cruza las predicciones de un dia con los resultados del CSV siguiente", () => {
    const hoy = [partido()];
    const picks = snapshotPicks(hoy, CONFIG_DEFAULT);
    expect(picks.length).toBeGreaterThan(0);
    const subHoy = { id: "a", fecha: "2026-10-22", subidoEn: "2026-10-22T10:00:00Z", matches: hoy, picks } as unknown as Subida;
    const manana = partido({ estado: "complete", resultado: { golesLocal: 2, golesVisitante: 1, corners: null } });
    const subManana = { id: "b", fecha: "2026-10-23", subidoEn: "2026-10-23T10:00:00Z", matches: [manana], picks: [] } as unknown as Subida;

    const sinResultados = resolverPicks([subHoy]);
    expect(sinResultados.registros).toHaveLength(0);
    expect(sinResultados.pendientes).toBe(picks.length);

    const { registros, pendientes } = resolverPicks([subHoy, subManana]);
    expect(pendientes).toBe(0);
    expect(registros).toHaveLength(picks.length);
    const over = registros.find((r) => r.pick.m === "goles|over|2.5");
    if (over) expect(over.resultado).toBe("acierto"); // 3 goles > 2.5
    const bandas = porBanda(registros);
    expect(bandas.reduce((a, b) => a + b.picks, 0)).toBe(registros.filter((r) => r.resultado !== "nulo").length);
  });
  it("si el horario cambia entre archivos, cruza por dia + equipos", () => {
    const hoy = [partido()];
    const picks = snapshotPicks(hoy, CONFIG_DEFAULT);
    const subHoy = { id: "a", fecha: "2026-10-22", subidoEn: "1", matches: hoy, picks } as unknown as Subida;
    const res = partido({ key: "otra-hora|aaa|bbb", estado: "complete", resultado: { golesLocal: 0, golesVisitante: 0, corners: null } });
    const { pendientes } = resolverPicks([subHoy, { id: "b", fecha: "x", subidoEn: "2", matches: [res], picks: [] } as unknown as Subida]);
    expect(pendientes).toBe(0);
  });
});

describe("persistencia", () => {
  function falsoStorage() {
    const datos = new Map<string, string>();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => datos.get(k) ?? null,
        setItem: (k: string, v: string) => void datos.set(k, v),
      },
    };
  }
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  const subida = (fecha: string, matches: CsvMatch[], id = fecha): Subida => {
    const picks = snapshotPicks(matches, CONFIG_DEFAULT);
    return {
      id,
      fecha,
      nombreArchivo: `${id}.csv`,
      subidoEn: `${fecha}T10:00:00Z`,
      resumen: { filasTotales: matches.length, filasValidas: matches.length, incompletos: 0, jugados: 0, virtuales: 0, descartadas: [], columnasFaltantes: [], columnasCuotas: 0, columnasPct: 0 },
      matches,
      picks,
      config: CONFIG_DEFAULT,
    };
  };

  it("un CSV de solo resultados del mismo dia NO borra las predicciones que tiene que medir", () => {
    falsoStorage();
    const dia1 = subida("2026-10-22", [partido()], "a");
    guardarSubida(dia1);
    const soloResultados = subida("2026-10-22", [partido({ estado: "complete", resultado: { golesLocal: 2, golesVisitante: 1, corners: null } })], "b");
    soloResultados.picks = [];
    const { subida: guardada, subidas } = guardarSubida(soloResultados);
    expect(subidas).toHaveLength(1);
    expect(guardada.picks.length).toBe(dia1.picks.length);
    const { registros, pendientes } = resolverPicks(subidas);
    expect(pendientes).toBe(0);
    expect(registros.length).toBeGreaterThan(0);
  });

  it("unirConPrevia: lo nuevo gana, lo que no esta en el archivo nuevo se conserva", () => {
    const previa = subida("2026-10-22", [partido(), partido({ key: "k2", dayKey: "d2" })], "a");
    const nueva = subida("2026-10-22", [partido({ estado: "complete" })], "b");
    const u = unirConPrevia(nueva, previa);
    expect(u.matches.map((m) => m.key).sort()).toEqual(["2026-10-22T18:45|aaa|bbb", "k2"]);
    expect(u.matches.find((m) => m.key === "k2")?.estado).toBe("incomplete");
    expect(u.resumen.jugados).toBe(1);
    expect(u.resumen.incompletos).toBe(1);
  });

  it("subir un dia mas viejo que los 10 guardados igual lo guarda y lo devuelve", () => {
    falsoStorage();
    for (let i = 0; i < 10; i++) guardarSubida(subida(`2026-10-${String(20 + i).padStart(2, "0")}`, [partido()]));
    const vieja = subida("2026-09-01", [partido()]);
    const { subida: g, subidas, guardado } = guardarSubida(vieja);
    expect(guardado).toBe(true);
    expect(subidas.some((s) => s.id === g.id)).toBe(true);
    expect(subidas).toHaveLength(10);
    expect(subidas.some((s) => s.fecha === "2026-10-20")).toBe(false); // se fue la mas vieja de las otras
  });

  it("los virtuales solo se conservan en la recien subida", () => {
    falsoStorage();
    const v = (fecha: string) => subida(fecha, [partido(), partido({ key: "v", dayKey: "v", virtual: true })]);
    guardarSubida(v("2026-10-21"));
    const { subidas } = guardarSubida(v("2026-10-22"));
    expect(subidas.find((s) => s.fecha === "2026-10-22")?.matches).toHaveLength(2);
    expect(subidas.find((s) => s.fecha === "2026-10-21")?.matches).toHaveLength(1);
  });
});

describe("rendimiento: picks sin dato", () => {
  it("los picks de corners sin dato de corners no cuentan como resueltos", () => {
    const hoy = [partido({ pct: { c95: 70 }, odds: { "corners:over:9.5": 1.85, "corners:under:9.5": 1.95 } })];
    const picks = snapshotPicks(hoy, CONFIG_DEFAULT);
    const res = partido({ estado: "complete", resultado: { golesLocal: 1, golesVisitante: 1, corners: null } });
    const { registros, sinDato, pendientes } = resolverPicks([
      { id: "a", fecha: "x", subidoEn: "1", matches: hoy, picks } as unknown as Subida,
      { id: "b", fecha: "y", subidoEn: "2", matches: [res], picks: [] } as unknown as Subida,
    ]);
    expect(registros).toHaveLength(0);
    expect(sinDato).toBe(picks.length);
    expect(pendientes).toBe(0);
  });
});

describe("formato real de FootyStats (fixtures/formato-real.csv, 4 filas de un CSV real)", () => {
  const real = parseCsv(readFileSync(join(__dirname, "fixtures/formato-real.csv"), "utf8"));
  const porJugar = real.matches.find((m) => m.estado === "incomplete" && !m.virtual)!;

  it("reconoce todas las columnas clave y no avisa faltantes", () => {
    expect(real.resumen.columnasFaltantes).toEqual([]);
    expect(real.resumen.columnasCuotas).toBeGreaterThanOrEqual(35);
    expect(real.resumen.columnasPct).toBe(13);
  });
  it("separa por jugar, jugado, virtual y no jugable", () => {
    expect(real.resumen).toMatchObject({ incompletos: 1, jugados: 1, virtuales: 1 });
    expect(real.resumen.descartadas[0].motivo).toBe("Estado no jugable (suspended)");
  });
  it("lee la fecha de date_unix y completa el link relativo", () => {
    expect(porJugar.kickoff).toMatch(/^2026-10-22T/);
    expect(porJugar.url).toMatch(/^https:\/\/footystats\.org\//);
  });
  it("lee el resultado final (Result - Home Team Goals) y los corners del partido jugado", () => {
    const jugado = real.matches.find((m) => m.estado === "complete" && !m.virtual)!;
    expect(jugado.resultado).not.toBeNull();
    expect(jugado.resultado?.corners).not.toBeNull();
  });
  it("evalua goles, ambos marcan, corners, tiempos y resultado, con cuotas reales de doble oportunidad", () => {
    const grupos = new Set(evaluarPartido(porJugar).map((m) => m.grupo));
    for (const g of ["goles", "btts", "corners", "resultado", "primer", "segundo"]) expect(grupos).toContain(g);
    const dc = evaluarPartido(porJugar).find((m) => m.id === "resultado|1X")!;
    expect(dc.cuota).not.toBeNull();
    const dnb = evaluarPartido(porJugar).filter((m) => m.id.startsWith("resultado|dnb"));
    expect(dnb[0].pMercado + dnb[1].pMercado).toBeCloseTo(1, 10);
  });
  it("las odds N/A no generan mercados", () => {
    const r = parseCsv("Home Team,Away Team,Over25 Average,Odds_Over25,Odds_Under25\nA,B,60,N/A,N/A");
    expect(r.matches[0].odds).toEqual({});
    expect(evaluarPartido(r.matches[0])).toEqual([]);
  });
});

describe("cuotas reales de doble oportunidad y empate anula", () => {
  it("la doble oportunidad con cuotas propias reparte el margen (suma de las tres = 2)", () => {
    const m = evaluarPartido(partido({ odds: { ...partido().odds, "dc:1X": 1.25, "dc:X2": 1.6, "dc:12": 1.3 } }));
    const dc = ["1X", "X2", "12"].map((k) => m.find((x) => x.id === `resultado|${k}`)!);
    expect(dc.map((x) => x.cuota)).toEqual([1.25, 1.6, 1.3]);
    expect(dc.reduce((a, x) => a + x.pMercado, 0)).toBeCloseTo(2, 10);
  });
});

describe("cuotas de doble oportunidad parciales (como en el CSV real)", () => {
  it("con solo 1X y X2: muestra esas cuotas y deriva la probabilidad de la casa del 1X2", () => {
    const base = evaluarPartido(partido());
    const m = evaluarPartido(partido({ odds: { ...partido().odds, "dc:1X": 1.21, "dc:X2": 1.11 } }));
    const get = (arr: typeof m, id: string) => arr.find((x) => x.id === id)!;
    expect(get(m, "resultado|1X").cuota).toBe(1.21);
    expect(get(m, "resultado|12").cuota).toBeNull();
    expect(get(m, "resultado|1X").pMercado).toBeCloseTo(get(base, "resultado|1X").pMercado, 10);
  });
});

describe("primer y segundo tiempo", () => {
  it("usan Over05/15 FHG y 2HG con sus cuotas y no se guardan como picks (no hay marcador del descanso)", () => {
    const m = partido({
      pct: { h1over05: 70, h1over15: 30, h2over05: 80 },
      odds: { "h1:over:0.5": 1.4, "h1:under:0.5": 2.9, "h2:over:0.5": 1.3, "h2:under:0.5": 3.4 },
    });
    expect(evaluarPartido(m).map((x) => x.id)).toEqual([
      "primer|over|0.5", "primer|under|0.5", "segundo|over|0.5", "segundo|under|0.5",
    ]);
    expect(snapshotPicks([m], CONFIG_DEFAULT).some((p) => p.m.startsWith("primer") || p.m.startsWith("segundo"))).toBe(false);
  });
});
