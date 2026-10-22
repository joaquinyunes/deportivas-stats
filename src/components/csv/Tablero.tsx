"use client";

import { horaLocal } from "@/lib/footystats/dates";
import { pct, pp } from "@/lib/footystats/format";
import type { CsvMatch } from "@/lib/footystats/types";
import { ligaLabel, type Columna, type Orden, type Seccion } from "@/lib/footystats/view";
import SampleBadge from "./SampleBadge";

const COLUMNAS: { col: Columna; label: string; align?: "right"; ayuda?: string }[] = [
  { col: "hora", label: "Hora" },
  { col: "partido", label: "Partido" },
  { col: "prob", label: "Prob.", align: "right", ayuda: "Probabilidad ajustada por tamaño de muestra" },
  { col: "casa", label: "Casa", align: "right", ayuda: "Probabilidad implícita de la casa, sin margen" },
  { col: "ventaja", label: "Ventaja", align: "right", ayuda: "Ajustada menos casa, en puntos porcentuales" },
  { col: "cuota", label: "Cuota", align: "right" },
  { col: "muestra", label: "Muestra", align: "right", ayuda: "Partidos por equipo detrás del porcentaje" },
];

export default function Tablero({
  secciones,
  orden,
  onOrden,
  onAbrir,
  agrupar,
}: {
  secciones: Seccion[];
  orden: Orden;
  onOrden: (col: Columna) => void;
  onAbrir: (m: CsvMatch) => void;
  agrupar: string;
}) {
  return (
    <div className="space-y-3">
      {secciones.map((s) => {
        const vacia = s.filas.length === 0;
        return (
          <details key={s.id} open={!vacia} className="group rounded-xl border border-line bg-surface">
            <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <span className="text-ink-dim transition-transform group-open:rotate-90" aria-hidden>
                ▸
              </span>
              <span className="font-semibold">{s.titulo}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-dim">
                {s.filas.length} {s.filas.length === 1 ? "mercado" : "mercados"}
              </span>
              {!vacia && (
                <span className="ml-auto text-xs text-ink-dim">
                  mejor: <b className="font-mono text-ink">{pct(Math.max(...s.filas.map((f) => f.mercado.pAjustada)))}</b>
                </span>
              )}
            </summary>
            {vacia ? (
              <p className="border-t border-line px-4 py-4 text-sm text-ink-dim">
                Ningún mercado de esta sección pasa los filtros.
              </p>
            ) : (
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[760px] text-sm">
                  <caption className="sr-only">{s.titulo}</caption>
                  <thead>
                    <tr className="text-left text-xs text-ink-dim">
                      {COLUMNAS.map((c) => (
                        <th
                          key={c.col}
                          scope="col"
                          aria-sort={orden.col === c.col ? (orden.dir === 1 ? "ascending" : "descending") : "none"}
                          className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => onOrden(c.col)}
                            title={c.ayuda}
                            className="inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            {c.label}
                            <span aria-hidden className={orden.col === c.col ? "text-accent" : "opacity-30"}>
                              {orden.col === c.col ? (orden.dir === 1 ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.filas.map(({ match: m, mercado: mk }) => (
                      <tr
                        key={`${m.key}#${mk.id}`}
                        className="border-t border-line/60 hover:bg-surface-2/60"
                      >
                        <td
                          className={`whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-dim ${
                            mk.muestra < 4 ? "shadow-[inset_3px_0_0_0_#f87171]" : ""
                          }`}
                        >
                          {horaLocal(m.kickoff)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => onAbrir(m)}
                            className="block max-w-72 truncate rounded text-left font-medium hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                            aria-label={`Ver detalle de ${m.local} contra ${m.visitante}`}
                          >
                            {agrupar === "partido" ? mk.etiqueta : `${m.local} vs ${m.visitante}`}
                          </button>
                          <div className="max-w-72 truncate text-xs text-ink-dim">
                            {agrupar === "partido" ? ligaLabel(m) : `${mk.etiqueta} · ${ligaLabel(m)}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{pct(mk.pAjustada)}</td>
                        <td className="px-3 py-2 text-right font-mono text-ink-dim">{pct(mk.pMercado)}</td>
                        <td
                          className={`px-3 py-2 text-right font-mono ${mk.ventaja > 0.05 ? "text-over" : mk.ventaja < -0.05 ? "text-under" : "text-ink-dim"}`}
                        >
                          {pp(mk.ventaja)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-ink-dim">{mk.cuota ? mk.cuota.toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <SampleBadge n={m.muestra} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

/** Tarjetas: solo promedio, sin cuotas, sin ventaja. Va aparte para no confundirse con el resto. */
export function TarjetasInfo({ partidos, onAbrir }: { partidos: CsvMatch[]; onAbrir: (m: CsvMatch) => void }) {
  if (!partidos.length) return null;
  return (
    <details className="group rounded-xl border border-dashed border-line-strong bg-surface">
      <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span className="text-ink-dim transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
        <span className="font-semibold">Tarjetas</span>
        <span className="rounded-full bg-push/15 px-2 py-0.5 text-xs text-push">Solo informativa</span>
        <span className="ml-auto text-xs text-ink-dim">{partidos.length} partidos</span>
      </summary>
      <div className="border-t border-line px-4 py-3">
        <p className="mb-3 text-xs text-ink-dim">
          El CSV trae el promedio de tarjetas pero ninguna cuota, así que no hay ventaja que calcular. Sirve para leer
          qué tan áspero viene el cruce.
        </p>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {partidos.slice(0, 40).map((m) => (
            <li key={m.key} className="flex items-center gap-3 border-b border-line/50 py-1.5 text-sm">
              <span className="w-12 shrink-0 font-mono text-xs text-ink-dim">{horaLocal(m.kickoff)}</span>
              <button
                type="button"
                onClick={() => onAbrir(m)}
                className="min-w-0 flex-1 truncate rounded text-left hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {m.local} vs {m.visitante}
              </button>
              <span className="font-mono font-semibold">{m.promTarjetas?.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
