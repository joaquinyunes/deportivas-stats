// El lazo: cruza las predicciones guardadas con los resultados de CSVs posteriores.
import { evaluarPick, type EvalPick } from "./engine";
import type { Grupo, PickSnap, Resultado, Subida } from "./types";

export interface Registro {
  pick: PickSnap;
  grupo: Grupo;
  resultado: EvalPick;
  fecha: string;
}

export interface Celda {
  etiqueta: string;
  picks: number;
  aciertos: number;
  /** aciertos / picks (0-1) */
  tasa: number;
  /** probabilidad promedio que el motor les asignaba (0-1) */
  predicho: number;
  /** probabilidad promedio de la casa */
  mercado: number;
}

export const BANDAS = [
  { desde: 0.5, hasta: 0.6, etiqueta: "50–60%" },
  { desde: 0.6, hasta: 0.7, etiqueta: "60–70%" },
  { desde: 0.7, hasta: 0.8, etiqueta: "70–80%" },
  { desde: 0.8, hasta: 0.9, etiqueta: "80–90%" },
  { desde: 0.9, hasta: 1.0001, etiqueta: "90%+" },
] as const;

/** Resuelve cada pick guardado contra los resultados que haya en cualquier subida. */
/** registros = picks medibles; pendientes = sin resultado todavia; sinDato = hay resultado pero no alcanza para medirlo. */
export function resolverPicks(subidas: Subida[]): { registros: Registro[]; pendientes: number; sinDato: number } {
  const resultados = new Map<string, Resultado>();
  for (const s of subidas) {
    for (const m of s.matches) {
      if (m.estado !== "complete" || !m.resultado) continue;
      resultados.set(m.key, m.resultado);
      if (!resultados.has(m.dayKey)) resultados.set(m.dayKey, m.resultado);
    }
  }

  const vistos = new Set<string>();
  const registros: Registro[] = [];
  let pendientes = 0;
  let sinDato = 0;
  // Las subidas mas viejas primero: si el mismo pick esta en dos archivos vale la primera prediccion.
  for (const s of [...subidas].sort((a, b) => a.subidoEn.localeCompare(b.subidoEn))) {
    for (const pick of s.picks) {
      const id = `${pick.k}#${pick.m}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      const r = resultados.get(pick.k) ?? resultados.get(pick.d);
      if (!r) {
        pendientes++;
        continue;
      }
      const resultado = evaluarPick(pick.m, r);
      if (resultado === "nulo") {
        sinDato++;
        continue;
      }
      registros.push({ pick, grupo: pick.m.split("|")[0] as Grupo, resultado, fecha: s.fecha });
    }
  }
  return { registros, pendientes, sinDato };
}

export function celda(etiqueta: string, regs: Registro[]): Celda {
  const validos = regs.filter((r) => r.resultado !== "nulo");
  const aciertos = validos.filter((r) => r.resultado === "acierto").length;
  const n = validos.length;
  return {
    etiqueta,
    picks: n,
    aciertos,
    tasa: n ? aciertos / n : 0,
    predicho: n ? validos.reduce((a, r) => a + r.pick.p, 0) / n : 0,
    mercado: n ? validos.reduce((a, r) => a + r.pick.pm, 0) / n : 0,
  };
}

export function porBanda(regs: Registro[]): Celda[] {
  return BANDAS.map((b) => celda(b.etiqueta, regs.filter((r) => r.pick.p >= b.desde && r.pick.p < b.hasta)));
}

export function agruparPor(regs: Registro[], clave: (r: Registro) => string, etiqueta: (k: string) => string = (k) => k): Celda[] {
  const mapa = new Map<string, Registro[]>();
  for (const r of regs) {
    const k = clave(r);
    const l = mapa.get(k);
    if (l) l.push(r);
    else mapa.set(k, [r]);
  }
  return [...mapa].map(([k, l]) => celda(etiqueta(k), l)).sort((a, b) => b.picks - a.picks);
}
