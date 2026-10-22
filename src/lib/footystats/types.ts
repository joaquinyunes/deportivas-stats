// Tipos del analizador de CSV de FootyStats.

export type Estado = "incomplete" | "complete" | "otro";

/** Secciones del tablero. "tarjetas" es informativa: el CSV no trae cuotas de tarjetas. */
export type Grupo = "goles" | "btts" | "corners" | "resultado";

export const GRUPOS: { id: Grupo; label: string }[] = [
  { id: "goles", label: "Goles" },
  { id: "btts", label: "Ambos marcan" },
  { id: "corners", label: "Córners" },
  { id: "resultado", label: "Resultado" },
];

/** Porcentajes historicos (0-100) por clave: over05..over45, btts, c85, c95, c105. */
export type Pcts = Partial<Record<string, number>>;

/** Cuotas decimales por clave (ver columns.ts para el formato de las claves). */
export type Odds = Partial<Record<string, number>>;

export interface Resultado {
  golesLocal: number;
  golesVisitante: number;
  corners: number | null;
}

/** Un partido del CSV, reducido a lo que usa el motor (no guarda las 107 columnas). */
export interface CsvMatch {
  /** fecha_hora_utc|local|visitante normalizados: identifica el partido entre CSVs. */
  key: string;
  /** Clave de respaldo dia|local|visitante, por si la hora cambia entre archivos. */
  dayKey: string;
  kickoff: string | null; // ISO UTC
  liga: string;
  pais: string;
  local: string;
  visitante: string;
  estado: Estado;
  virtual: boolean;
  xgLocal: number | null;
  xgVisitante: number | null;
  /** Muestra inferida por equipo; null = no se pudo inferir. */
  muestra: number | null;
  pct: Pcts;
  odds: Odds;
  promGoles: number | null;
  promCorners: number | null;
  promTarjetas: number | null;
  url: string | null;
  resultado: Resultado | null;
}

export interface Mercado {
  /** Ej: "goles|over|2.5", "btts|si", "resultado|1X". Ver evaluarPick(). */
  id: string;
  grupo: Grupo;
  etiqueta: string;
  /** Cuota decimal de la casa; null en los mercados derivados (doble oportunidad, DNB). */
  cuota: number | null;
  /** Probabilidad historica (0-1). */
  pHist: number;
  /** Probabilidad implicita de la casa sin margen (0-1). */
  pMercado: number;
  /** Historica ajustada por tamaño de muestra (0-1). */
  pAjustada: number;
  /** pAjustada - pMercado en puntos porcentuales. */
  ventaja: number;
  /** Muestra efectiva usada en el ajuste. */
  muestra: number;
}

export interface Config {
  /** Constante de confianza K del ajuste: n/(n+K). */
  k: number;
  /** Mercados de goles/ambos marcan desde Poisson con el xG en vez del promedio del CSV. */
  golesPoisson: boolean;
}

export const CONFIG_DEFAULT: Config = { k: 5, golesPoisson: false };

export interface ResumenSubida {
  filasTotales: number;
  filasValidas: number;
  incompletos: number;
  jugados: number;
  virtuales: number;
  descartadas: { motivo: string; cantidad: number }[];
  /** Columnas clave que no se encontraron en el archivo (para avisar que el motor queda corto). */
  columnasFaltantes: string[];
  /** Cuantas columnas de cuotas y de % historicos se reconocieron. */
  columnasCuotas: number;
  columnasPct: number;
}

export interface Subida {
  id: string;
  /** YYYY-MM-DD de los partidos (el dia mas frecuente del archivo). */
  fecha: string;
  nombreArchivo: string;
  subidoEn: string;
  resumen: ResumenSubida;
  matches: CsvMatch[];
  /** Predicciones al subir, para medir acierto cuando llegue el CSV con los resultados. */
  picks: PickSnap[];
  config: Config;
}

/** Foto compacta de una prediccion (solo el lado con pAjustada >= 0.5). */
export interface PickSnap {
  k: string; // CsvMatch.key
  d: string; // CsvMatch.dayKey
  m: string; // Mercado.id
  p: number; // pAjustada
  pm: number; // pMercado
  n: number; // muestra
  l: string; // liga
}
