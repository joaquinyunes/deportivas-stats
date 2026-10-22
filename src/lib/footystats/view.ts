// Filtros y agrupacion del tablero. Puro: el estado vive en la URL (ver parseFiltros / filtrosAQuery).
import { franjaHoraria } from "./dates";
import { MUESTRA_DESCONOCIDA, evaluarPartido } from "./engine";
import { esLigaGrande } from "./leagues";
import { GRUPOS, type Config, type CsvMatch, type Grupo, type Mercado } from "./types";

export type Agrupar = "hora" | "mercado" | "liga" | "partido";

export interface Filtros {
  muestra: number;
  /** 50-95 */
  prob: number;
  /** 0 = sin filtro, hasta 30 */
  ventaja: number;
  agrupar: Agrupar;
  grandes: boolean;
  ocultarVirtuales: boolean;
  liga: string;
  mercado: Grupo | "";
}

export const FILTROS_DEFAULT: Filtros = {
  muestra: 1,
  prob: 65,
  ventaja: 0,
  agrupar: "hora",
  grandes: false,
  ocultarVirtuales: true,
  liga: "",
  mercado: "",
};

export const MUESTRAS = [1, 4, 7, 10, 15] as const;

export interface Fila {
  match: CsvMatch;
  mercado: Mercado;
}

export interface Seccion {
  id: string;
  titulo: string;
  filas: Fila[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const entero = (s: string | null | undefined, def: number) => {
  const n = s === null || s === undefined || s === "" ? NaN : Number(s);
  return Number.isFinite(n) ? n : def;
};

export function parseFiltros(sp: { get(k: string): string | null }): Filtros {
  const d = FILTROS_DEFAULT;
  const agrupar = sp.get("agrupar");
  const mercado = sp.get("mercado");
  return {
    // Se ajusta al escalon de MUESTRAS mas cercano por debajo, para que el selector muestre lo que se aplica.
    muestra: [...MUESTRAS].reverse().find((n) => n <= entero(sp.get("muestra"), d.muestra)) ?? 1,
    prob: clamp(entero(sp.get("prob"), d.prob), 50, 95),
    ventaja: clamp(entero(sp.get("ventaja"), d.ventaja), 0, 30),
    agrupar: agrupar === "hora" || agrupar === "mercado" || agrupar === "liga" || agrupar === "partido" ? agrupar : d.agrupar,
    grandes: sp.get("grandes") === "1",
    ocultarVirtuales: sp.get("virtual") !== "1",
    liga: sp.get("liga") ?? "",
    mercado: GRUPOS.some((g) => g.id === mercado) ? (mercado as Grupo) : "",
  };
}

/** Solo los valores que difieren del default, para que las URLs favoritas queden cortas. */
export function filtrosAQuery(f: Filtros): URLSearchParams {
  const d = FILTROS_DEFAULT;
  const q = new URLSearchParams();
  if (f.muestra !== d.muestra) q.set("muestra", String(f.muestra));
  if (f.prob !== d.prob) q.set("prob", String(f.prob));
  if (f.ventaja !== d.ventaja) q.set("ventaja", String(f.ventaja));
  if (f.agrupar !== d.agrupar) q.set("agrupar", f.agrupar);
  if (f.grandes) q.set("grandes", "1");
  if (!f.ocultarVirtuales) q.set("virtual", "1");
  if (f.liga) q.set("liga", f.liga);
  if (f.mercado) q.set("mercado", f.mercado);
  return q;
}

export function ligaLabel(m: CsvMatch): string {
  return m.pais && !m.liga.toLowerCase().startsWith(m.pais.toLowerCase()) ? `${m.pais} · ${m.liga}` : m.liga || "Sin liga";
}

function pasaPartido(m: CsvMatch, f: Filtros): boolean {
  return (
    !(f.ocultarVirtuales && m.virtual) &&
    (!f.grandes || esLigaGrande(m.pais, m.liga)) &&
    (!f.liga || ligaLabel(m) === f.liga) &&
    (m.muestra ?? MUESTRA_DESCONOCIDA) >= f.muestra
  );
}

/** Los partidos que se pueden mostrar: sin jugar y que pasen los filtros que no dependen del mercado. */
export function partidosVisibles(matches: CsvMatch[], f: Filtros): CsvMatch[] {
  return matches.filter((m) => m.estado === "incomplete" && pasaPartido(m, f));
}

export interface Evaluado {
  match: CsvMatch;
  mercados: Mercado[];
}

/** Evalua el motor una sola vez por partido sin jugar: no depende de los filtros, solo de la config. */
export function evaluar(matches: CsvMatch[], config: Config): Evaluado[] {
  return matches.filter((m) => m.estado === "incomplete").map((match) => ({ match, mercados: evaluarPartido(match, config) }));
}

export function filasDe(evaluados: Evaluado[], f: Filtros): Fila[] {
  const out: Fila[] = [];
  for (const { match, mercados } of evaluados) {
    if (!pasaPartido(match, f)) continue;
    for (const mercado of mercados) {
      if (f.mercado && mercado.grupo !== f.mercado) continue;
      if (mercado.pAjustada * 100 < f.prob) continue;
      if (f.ventaja > 0 && mercado.ventaja < f.ventaja) continue;
      out.push({ match, mercado });
    }
  }
  return out;
}

const porProb = (a: Fila, b: Fila) => b.mercado.pAjustada - a.mercado.pAjustada;
const porHora = (a: Fila, b: Fila) => (a.match.kickoff ?? "￿").localeCompare(b.match.kickoff ?? "￿");

export function seccionar(filas: Fila[], agrupar: Agrupar): Seccion[] {
  const mapa = new Map<string, Seccion>();
  const meter = (id: string, titulo: string, fila: Fila) => {
    const s = mapa.get(id);
    if (s) s.filas.push(fila);
    else mapa.set(id, { id, titulo, filas: [fila] });
  };

  if (agrupar === "mercado") {
    for (const g of GRUPOS) mapa.set(g.id, { id: g.id, titulo: g.label, filas: [] });
  }
  for (const fila of filas) {
    const { match: m, mercado } = fila;
    if (agrupar === "hora") {
      const franja = franjaHoraria(m.kickoff);
      meter(franja, franja, fila);
    } else if (agrupar === "mercado") meter(mercado.grupo, GRUPOS.find((g) => g.id === mercado.grupo)?.label ?? mercado.grupo, fila);
    else if (agrupar === "liga") meter(ligaLabel(m), ligaLabel(m), fila);
    else meter(m.key, `${m.local} vs ${m.visitante}`, fila);
  }

  const secciones = [...mapa.values()];
  for (const s of secciones) s.filas.sort(porProb);
  if (agrupar === "hora") secciones.sort((a, b) => (a.id === "Sin hora" ? 1 : b.id === "Sin hora" ? -1 : a.id.localeCompare(b.id)));
  else if (agrupar === "liga") secciones.sort((a, b) => (b.filas[0]?.mercado.pAjustada ?? 0) - (a.filas[0]?.mercado.pAjustada ?? 0));
  else if (agrupar === "partido") secciones.sort((a, b) => porHora(a.filas[0], b.filas[0]));
  return secciones;
}

/** Tarjetas: sin cuotas no hay ventaja que calcular, asi que es una lista informativa aparte. */
export function tarjetasDe(matches: CsvMatch[], f: Filtros): CsvMatch[] {
  return partidosVisibles(matches, f)
    .filter((m) => m.promTarjetas !== null)
    .sort((a, b) => (b.promTarjetas ?? 0) - (a.promTarjetas ?? 0));
}

export function ligasDe(matches: CsvMatch[]): string[] {
  return [...new Set(matches.filter((m) => m.estado === "incomplete").map(ligaLabel))].sort((a, b) => a.localeCompare(b));
}

export type Columna = "hora" | "partido" | "prob" | "casa" | "ventaja" | "cuota" | "muestra";
export interface Orden {
  col: Columna;
  /** 1 ascendente, -1 descendente */
  dir: 1 | -1;
}

export const ORDEN_DEFAULT: Orden = { col: "prob", dir: -1 };

const valor: Record<Columna, (f: Fila) => number | string> = {
  hora: (f) => f.match.kickoff ?? "￿",
  partido: (f) => f.match.local.toLowerCase(),
  prob: (f) => f.mercado.pAjustada,
  casa: (f) => f.mercado.pMercado,
  ventaja: (f) => f.mercado.ventaja,
  cuota: (f) => f.mercado.cuota ?? -1,
  muestra: (f) => f.mercado.muestra,
};

/** Ordena las filas de cada seccion; ante empate desempata por probabilidad. */
export function ordenarSecciones(secciones: Seccion[], orden: Orden): Seccion[] {
  const get = valor[orden.col];
  return secciones.map((s) => ({
    ...s,
    filas: [...s.filas].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const c = typeof x === "string" || typeof y === "string" ? String(x).localeCompare(String(y)) : x - (y as number);
      return c !== 0 ? c * orden.dir : porProb(a, b);
    }),
  }));
}
