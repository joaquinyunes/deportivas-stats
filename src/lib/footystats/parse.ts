// CSV de FootyStats -> CsvMatch[] + resumen. Corre en el navegador.
import Papa from "papaparse";
import { columnasFaltantes, resolverColumnas, type ColumnMap } from "./columns";
import { parseFechaHora } from "./dates";
import { inferirMuestra } from "./engine";
import { matchKey } from "./normalize";
import type { CsvMatch, Estado, Odds, Pcts, ResumenSubida } from "./types";

const VIRTUAL = /e-?soccer|virtual|cyber|volta|gg league|battle\s*-\s*\d+\s*min/i;

/** Claves de cuota que usa el motor; el resto (primer/segundo tiempo...) no se guarda. */
const CUOTA_USADA = /^(ft|corners|btts|1x2):/;

type Fila = Record<string, string | undefined>;

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  let s = v.trim().replace(/%$/, "");
  if (!s || /^(nan|null|n\/a|-)$/i.test(s)) return null;
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function texto(f: Fila, col: string | undefined): string {
  return col ? (f[col] ?? "").trim() : "";
}

function estadoDe(raw: string, haySinColumna: boolean): Estado {
  if (!raw) return haySinColumna ? "incomplete" : "otro";
  const s = raw.toLowerCase();
  if (s === "complete" || s === "finished" || s === "ft") return "complete";
  if (s === "incomplete" || s === "scheduled" || s === "notstarted" || s === "not started") return "incomplete";
  return "otro";
}

function kickoffDe(f: Fila, map: ColumnMap): string | null {
  const ts = texto(f, map.timestamp);
  if (ts) {
    const iso = parseFechaHora(ts);
    if (iso) return iso;
  }
  const fh = texto(f, map.fechaHora);
  if (fh) {
    const iso = parseFechaHora(fh);
    if (iso) return iso;
  }
  const fecha = texto(f, map.fecha);
  if (!fecha) return null;
  const hora = texto(f, map.hora);
  return parseFechaHora(hora ? `${fecha} ${hora}` : fecha) ?? parseFechaHora(fecha);
}

/** Dia calendario en la zona del navegador: es el que ve el usuario en las horas del tablero. */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function modaFecha(matches: CsvMatch[]): string {
  const conteo = new Map<string, number>();
  const pool = matches.filter((m) => m.estado === "incomplete" && !m.virtual && m.kickoff);
  for (const m of pool.length ? pool : matches.filter((m) => m.kickoff)) {
    const d = diaLocal(m.kickoff as string);
    conteo.set(d, (conteo.get(d) ?? 0) + 1);
  }
  let mejor = new Date().toISOString().slice(0, 10);
  let max = 0;
  for (const [d, c] of conteo) if (c > max) { mejor = d; max = c; }
  return mejor;
}

export interface Parseado {
  matches: CsvMatch[];
  resumen: ResumenSubida;
  fecha: string;
}

export function parseCsv(contenido: string): Parseado {
  const limpio = contenido.replace(/^﻿/, "");
  const res = Papa.parse<Fila>(limpio, { header: true, skipEmptyLines: "greedy" });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  const map = resolverColumnas(headers);
  const filas = res.data;

  // Si todos los % vienen en 0-1 en vez de 0-100, se reescalan.
  let maxPct = 0;
  for (const f of filas) for (const col of Object.values(map.pct)) maxPct = Math.max(maxPct, num(f[col]) ?? 0);
  const escala = maxPct > 0 && maxPct <= 1 ? 100 : 1;

  const descartadas = new Map<string, number>();
  const descartar = (motivo: string) => descartadas.set(motivo, (descartadas.get(motivo) ?? 0) + 1);
  const matches: CsvMatch[] = [];
  let virtuales = 0;

  for (const f of filas) {
    const local = texto(f, map.local);
    const visitante = texto(f, map.visitante);
    if (!local || !visitante) {
      descartar("Sin nombre de local o visitante");
      continue;
    }
    const liga = texto(f, map.liga);
    const pais = texto(f, map.pais);
    const esVirtual = VIRTUAL.test(`${liga} ${pais}`);
    if (esVirtual) virtuales++;
    const rawEstado = texto(f, map.estado);
    const estado = estadoDe(rawEstado, !map.estado);
    if (estado === "otro") {
      descartar(`Estado no jugable${rawEstado ? ` (${rawEstado.toLowerCase()})` : ""}`);
      continue;
    }

    const pct: Pcts = {};
    for (const [k, col] of Object.entries(map.pct)) {
      const v = num(f[col]);
      if (v !== null && v >= 0) pct[k] = Math.min(100, v * escala);
    }
    const odds: Odds = {};
    for (const [k, col] of Object.entries(map.odds)) {
      if (!CUOTA_USADA.test(k)) continue;
      const v = num(f[col]);
      if (v !== null && v > 1) odds[k] = v;
    }
    const xgL = num(f[map.xgLocal ?? ""]);
    const xgV = num(f[map.xgVisitante ?? ""]);
    const kickoff = kickoffDe(f, map);
    const { key, dayKey } = matchKey(kickoff, local, visitante);

    let resultado: CsvMatch["resultado"] = null;
    if (estado === "complete") {
      const gl = num(f[map.golesLocal ?? ""]);
      const gv = num(f[map.golesVisitante ?? ""]);
      if (gl !== null && gv !== null && gl >= 0 && gv >= 0) {
        const cl = num(f[map.cornersLocal ?? ""]);
        const cv = num(f[map.cornersVisitante ?? ""]);
        const ct = num(f[map.cornersTotal ?? ""]);
        const corners = ct !== null && ct >= 0 ? ct : cl !== null && cv !== null && cl >= 0 && cv >= 0 ? cl + cv : null;
        resultado = { golesLocal: gl, golesVisitante: gv, corners };
      }
    }

    const positivo = (v: number | null) => (v !== null && v > 0 ? v : null);
    matches.push({
      key,
      dayKey,
      kickoff,
      liga,
      pais,
      local,
      visitante,
      estado,
      virtual: esVirtual,
      xgLocal: positivo(xgL),
      xgVisitante: positivo(xgV),
      muestra: inferirMuestra(Object.values(pct).filter((v): v is number => v !== undefined)),
      pct,
      odds,
      promGoles: positivo(num(f[map.promGoles ?? ""])),
      promCorners: positivo(num(f[map.promCorners ?? ""])),
      promTarjetas: positivo(num(f[map.promTarjetas ?? ""])),
      url: texto(f, map.url) || null,
      resultado,
    });
  }

  const resumen: ResumenSubida = {
    filasTotales: filas.length,
    filasValidas: matches.length,
    incompletos: matches.filter((m) => m.estado === "incomplete" && !m.virtual).length,
    jugados: matches.filter((m) => m.estado === "complete" && !m.virtual).length,
    virtuales,
    descartadas: [...descartadas].map(([motivo, cantidad]) => ({ motivo, cantidad })),
    columnasFaltantes: columnasFaltantes(map),
    columnasCuotas: Object.keys(map.odds).length,
    columnasPct: Object.keys(map.pct).length,
  };

  return { matches, resumen, fecha: modaFecha(matches) };
}
