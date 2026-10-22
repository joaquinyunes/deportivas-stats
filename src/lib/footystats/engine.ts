// Motor de calculo: funciones puras, sin interfaz ni almacenamiento.
// Entra un partido, sale la lista de mercados con probabilidad historica, de la casa y ajustada.
import type { Config, CsvMatch, Mercado, Pcts } from "./types";
import { CONFIG_DEFAULT } from "./types";

/** Muestra efectiva cuando no se pudo inferir: ni confiar a ciegas ni tirar el dato. */
export const MUESTRA_DESCONOCIDA = 10;

/** Probabilidad real de un par de cuotas opuestas, repartiendo el margen de la casa. */
export function devig(cuotaA: number, cuotaB: number): { a: number; b: number } {
  const ia = 1 / cuotaA;
  const ib = 1 / cuotaB;
  const s = ia + ib;
  return { a: ia / s, b: ib / s };
}

/** Igual que devig() para 1X2 (tres resultados). */
export function devig3(c1: number, cx: number, c2: number): [number, number, number] {
  const i = [1 / c1, 1 / cx, 1 / c2];
  const s = i[0] + i[1] + i[2];
  return [i[0] / s, i[1] / s, i[2] / s];
}

function poissonPmf(lambda: number, n: number): number[] {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= n; k++) out.push((out[k - 1] * lambda) / k);
  return out;
}

/** P(X > linea) para X ~ Poisson(lambda), linea con .5. */
export function poissonOver(lambda: number, linea: number): number {
  const pmf = poissonPmf(lambda, Math.floor(linea));
  return Math.max(0, 1 - pmf.reduce((a, b) => a + b, 0));
}

/** 1X2 por Poisson independiente con el xG de cada lado. */
export function poisson1x2(xgLocal: number, xgVisitante: number, maxGoles = 10): { local: number; empate: number; visitante: number } {
  const h = poissonPmf(xgLocal, maxGoles);
  const a = poissonPmf(xgVisitante, maxGoles);
  let local = 0;
  let empate = 0;
  let visitante = 0;
  for (let i = 0; i <= maxGoles; i++) {
    for (let j = 0; j <= maxGoles; j++) {
      const p = h[i] * a[j];
      if (i > j) local += p;
      else if (i === j) empate += p;
      else visitante += p;
    }
  }
  const s = local + empate + visitante;
  return { local: local / s, empate: empate / s, visitante: visitante / s };
}

/**
 * Los % del CSV salen de la temporada, asi que son fracciones k/n con n chico. Busca el
 * denominador mas chico que explica TODAS las columnas a la vez (ej. 43 y 86 -> 7).
 * null = ninguno hasta maxN explica la fila (muestra grande o equipos con muestras distintas).
 * maxN = 20 porque con topes mas altos un denominador grande "explica" cualquier fila por azar.
 */
export function inferirMuestra(pcts: number[], maxN = 20): number | null {
  const vals = pcts.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  const hayDecimales = vals.some((v) => Math.abs(v - Math.round(v)) > 1e-6);
  const tol = hayDecimales ? 0.06 : 0.51;
  for (let n = 1; n <= maxN; n++) {
    const ok = vals.every((v) => {
      const k = Math.round((v * n) / 100);
      return Math.abs((100 * k) / n - v) <= tol;
    });
    if (ok) return n;
  }
  return null;
}

/** Acerca la probabilidad historica a la del mercado cuanto mas chica es la muestra. */
export function ajustarPorMuestra(pHist: number, pMercado: number, n: number, k: number): number {
  if (n <= 0) return pMercado;
  return (n / (n + k)) * pHist + (k / (n + k)) * pMercado;
}

/** Puntos porcentuales de diferencia entre la probabilidad ajustada y la de la casa. */
export function calcularVentaja(pAjustada: number, pMercado: number): number {
  return (pAjustada - pMercado) * 100;
}

const LINEAS_GOLES = [0.5, 1.5, 2.5, 3.5, 4.5];
const LINEAS_CORNERS = [7.5, 8.5, 9.5, 10.5, 11.5];

/** Valor del CSV (0-100) -> 0-1, o undefined. */
function frac(pcts: Pcts, key: string): number | undefined {
  const v = pcts[key];
  return v === undefined ? undefined : v / 100;
}

interface Par {
  a: number;
  b: number;
}

export function evaluarPartido(m: CsvMatch, config: Config = CONFIG_DEFAULT): Mercado[] {
  const out: Mercado[] = [];
  const n = m.muestra ?? MUESTRA_DESCONOCIDA;
  const xgOk = m.xgLocal !== null && m.xgVisitante !== null;
  const lambdaTotal = xgOk ? (m.xgLocal as number) + (m.xgVisitante as number) : null;

  const push = (
    id: string,
    grupo: Mercado["grupo"],
    etiqueta: string,
    cuota: number | null,
    pHist: number,
    pMercado: number,
  ) => {
    const pAjustada = ajustarPorMuestra(pHist, pMercado, n, config.k);
    out.push({ id, grupo, etiqueta, cuota, pHist, pMercado, pAjustada, ventaja: calcularVentaja(pAjustada, pMercado), muestra: n });
  };

  // Totales (goles y corners): hace falta el par over/under y la columna historica.
  const totales = (
    scope: "ft" | "corners",
    lineas: number[],
    histOver: (linea: number) => number | undefined,
    grupo: Mercado["grupo"],
    unidad: string,
  ) => {
    for (const linea of lineas) {
      const co = m.odds[`${scope}:over:${linea}`];
      const cu = m.odds[`${scope}:under:${linea}`];
      const ho = histOver(linea);
      if (co === undefined || cu === undefined || ho === undefined) continue;
      const mk: Par = devig(co, cu);
      push(`${grupo}|over|${linea}`, grupo, `Más de ${linea} ${unidad}`, co, ho, mk.a);
      push(`${grupo}|under|${linea}`, grupo, `Menos de ${linea} ${unidad}`, cu, 1 - ho, mk.b);
    }
  };

  totales(
    "ft",
    LINEAS_GOLES,
    (l) => (config.golesPoisson && lambdaTotal ? poissonOver(lambdaTotal, l) : frac(m.pct, `over${String(l * 10).padStart(2, "0")}`)),
    "goles",
    "goles",
  );
  totales("corners", LINEAS_CORNERS, (l) => frac(m.pct, `c${l * 10}`), "corners", "córners");

  // Ambos marcan
  const by = m.odds["btts:yes"];
  const bn = m.odds["btts:no"];
  const hb =
    config.golesPoisson && xgOk
      ? (1 - Math.exp(-(m.xgLocal as number))) * (1 - Math.exp(-(m.xgVisitante as number)))
      : frac(m.pct, "btts");
  if (by !== undefined && bn !== undefined && hb !== undefined) {
    const mk = devig(by, bn);
    push("btts|si", "btts", "Ambos marcan: Sí", by, hb, mk.a);
    push("btts|no", "btts", "Ambos marcan: No", bn, 1 - hb, mk.b);
  }

  // Resultado: historico por Poisson (el CSV no trae % de 1X2), mercado por devig de 3 vias.
  const c1 = m.odds["1x2:1"];
  const cx = m.odds["1x2:X"];
  const c2 = m.odds["1x2:2"];
  if (xgOk && c1 !== undefined && cx !== undefined && c2 !== undefined) {
    const h = poisson1x2(m.xgLocal as number, m.xgVisitante as number);
    const [m1, mx, m2] = devig3(c1, cx, c2);
    const L = m.local;
    const V = m.visitante;
    push("resultado|1", "resultado", `Gana ${L}`, c1, h.local, m1);
    push("resultado|X", "resultado", "Empate", cx, h.empate, mx);
    push("resultado|2", "resultado", `Gana ${V}`, c2, h.visitante, m2);
    push("resultado|1X", "resultado", `${L} o empate`, null, h.local + h.empate, m1 + mx);
    push("resultado|X2", "resultado", `${V} o empate`, null, h.visitante + h.empate, m2 + mx);
    push("resultado|12", "resultado", `${L} o ${V} (sin empate)`, null, h.local + h.visitante, m1 + m2);
    push("resultado|dnb1", "resultado", `Empate anula: ${L}`, null, h.local / (h.local + h.visitante), m1 / (m1 + m2));
    push("resultado|dnb2", "resultado", `Empate anula: ${V}`, null, h.visitante / (h.local + h.visitante), m2 / (m1 + m2));
  }

  return out;
}

export type EvalPick = "acierto" | "fallo" | "nulo";

/**
 * Resuelve un pick (Mercado.id) contra el resultado real. "nulo" = no se puede decir
 * (falta el dato de corners) o la apuesta se devuelve (empate anula).
 */
export function evaluarPick(id: string, r: { golesLocal: number; golesVisitante: number; corners: number | null }): EvalPick {
  const [grupo, lado, linea] = id.split("|");
  const gl = r.golesLocal;
  const gv = r.golesVisitante;
  const hit = (b: boolean): EvalPick => (b ? "acierto" : "fallo");
  if (grupo === "goles") return hit(lado === "over" ? gl + gv > Number(linea) : gl + gv < Number(linea));
  if (grupo === "corners") {
    if (r.corners === null) return "nulo";
    return hit(lado === "over" ? r.corners > Number(linea) : r.corners < Number(linea));
  }
  if (grupo === "btts") return hit((gl > 0 && gv > 0) === (lado === "si"));
  if (grupo === "resultado") {
    switch (lado) {
      case "1": return hit(gl > gv);
      case "X": return hit(gl === gv);
      case "2": return hit(gv > gl);
      case "1X": return hit(gl >= gv);
      case "X2": return hit(gv >= gl);
      case "12": return hit(gl !== gv);
      case "dnb1": return gl === gv ? "nulo" : hit(gl > gv);
      case "dnb2": return gl === gv ? "nulo" : hit(gv > gl);
    }
  }
  return "nulo";
}
