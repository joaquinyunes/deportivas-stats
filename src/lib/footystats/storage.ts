// Persistencia liviana en localStorage (sin backend). Todo envuelto en try/catch: puede estar
// bloqueado, vacio o lleno. El motor no depende de esto, asi que migrar a Postgres no lo toca.
import { evaluarPartido } from "./engine";
import type { Config, PickSnap, Subida } from "./types";
import { CONFIG_DEFAULT } from "./types";
import type { Parseado } from "./parse";

const KEY = "footystats:subidas:v1";
const KEY_CONFIG = "footystats:config:v1";
/** ~200 KB por dia: con 10 queda bien debajo de los 5 MB de localStorage. */
export const MAX_SUBIDAS = 10;

function leer<T>(key: string, def: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}

function escribir(key: string, valor: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function cargarSubidas(): Subida[] {
  const todas = leer<Subida[]>(KEY, []);
  return Array.isArray(todas) ? todas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.subidoEn.localeCompare(a.subidoEn)) : [];
}

export function cargarConfig(): Config {
  return { ...CONFIG_DEFAULT, ...leer<Partial<Config>>(KEY_CONFIG, {}) };
}

export function guardarConfig(c: Config): void {
  escribir(KEY_CONFIG, c);
}

/** Predicciones del motor para los partidos sin jugar: solo el lado con p >= 50%. */
export function snapshotPicks(matches: Parseado["matches"], config: Config): PickSnap[] {
  const out: PickSnap[] = [];
  for (const m of matches) {
    if (m.estado !== "incomplete" || m.virtual) continue;
    for (const mk of evaluarPartido(m, config)) {
      // El CSV no trae el marcador del descanso: primer/segundo tiempo no se pueden medir despues.
      if (mk.pAjustada < 0.5 || mk.grupo === "primer" || mk.grupo === "segundo") continue;
      out.push({ k: m.key, d: m.dayKey, m: mk.id, p: round(mk.pAjustada), pm: round(mk.pMercado), n: mk.muestra, l: m.liga });
    }
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function nuevaSubida(nombreArchivo: string, parseado: Parseado, config: Config): Subida {
  return {
    id: `${parseado.fecha}-${Date.now().toString(36)}`,
    fecha: parseado.fecha,
    nombreArchivo,
    subidoEn: new Date().toISOString(),
    resumen: parseado.resumen,
    matches: parseado.matches,
    picks: snapshotPicks(parseado.matches, config),
    config,
  };
}

/** Los virtuales ocupan la mitad del archivo: solo se conservan en la subida recien cargada. */
function compactar(subidas: Subida[], recienCargada: string): Subida[] {
  return subidas.map((s) => (s.id === recienCargada ? s : { ...s, matches: s.matches.filter((m) => !m.virtual) }));
}

const clavePick = (p: PickSnap) => `${p.k}#${p.m}`;

/**
 * Si ya hay una subida del mismo dia (otro archivo, o el mismo actualizado), se unen en vez de
 * pisarse: un CSV de solo resultados no trae partidos por jugar y no puede borrar las
 * predicciones que justamente tiene que medir.
 */
export function unirConPrevia(nueva: Subida, previa: Subida): Subida {
  const picksNuevos = new Set(nueva.picks.map(clavePick));
  const keysNuevas = new Set(nueva.matches.map((m) => m.key));
  const matches = [...nueva.matches, ...previa.matches.filter((m) => !keysNuevas.has(m.key))];
  const reales = matches.filter((m) => !m.virtual);
  return {
    ...nueva,
    matches,
    picks: [...nueva.picks, ...previa.picks.filter((p) => !picksNuevos.has(clavePick(p)))],
    resumen: {
      ...nueva.resumen,
      incompletos: reales.filter((m) => m.estado === "incomplete").length,
      jugados: reales.filter((m) => m.estado === "complete").length,
    },
  };
}

/** Guarda una subida (une con la del mismo dia) y devuelve la lista resultante. La nueva siempre queda. */
export function guardarSubida(entrante: Subida): { subida: Subida; subidas: Subida[]; guardado: boolean } {
  const previas = cargarSubidas();
  const previa = previas.find((s) => s.fecha === entrante.fecha);
  const nueva = previa ? unirConPrevia(entrante, previa) : entrante;
  // Las demas, de la mas nueva a la mas vieja; se recorta por el lado viejo, nunca la recien subida.
  let otras = previas.filter((s) => s.fecha !== nueva.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAX_SUBIDAS - 1);
  const armar = () => compactar([nueva, ...otras], nueva.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  let guardado = escribir(KEY, armar());
  while (!guardado && otras.length) {
    otras = otras.slice(0, -1);
    guardado = escribir(KEY, armar());
  }
  return { subida: nueva, subidas: armar(), guardado };
}

export function borrarSubida(id: string): Subida[] {
  const lista = cargarSubidas().filter((s) => s.id !== id);
  escribir(KEY, lista);
  return lista;
}
