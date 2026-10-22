"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pct } from "@/lib/footystats/format";
import { agruparPor, celda, porBanda, resolverPicks, type Celda } from "@/lib/footystats/performance";
import { cargarSubidas } from "@/lib/footystats/storage";
import { GRUPOS, type Subida } from "@/lib/footystats/types";

const MIN_CONFIABLE = 30;

export default function RendimientoView() {
  const [subidas, setSubidas] = useState<Subida[] | null>(null);
  const [muestraMin, setMuestraMin] = useState(1);

  useEffect(() => setSubidas(cargarSubidas()), []);

  const { registros, pendientes, sinDato } = useMemo(
    () => (subidas ? resolverPicks(subidas) : { registros: [], pendientes: 0, sinDato: 0 }),
    [subidas],
  );
  const filtrados = useMemo(() => registros.filter((r) => r.pick.n >= muestraMin), [registros, muestraMin]);
  const alto = useMemo(() => celda("80%+", filtrados.filter((r) => r.pick.p >= 0.8)), [filtrados]);
  const bandas = useMemo(() => porBanda(filtrados), [filtrados]);
  const mercados = useMemo(
    () => agruparPor(filtrados, (r) => r.grupo, (k) => GRUPOS.find((g) => g.id === k)?.label ?? k),
    [filtrados],
  );
  const ligas = useMemo(() => agruparPor(filtrados, (r) => r.pick.l || "Sin liga").slice(0, 12), [filtrados]);

  if (!subidas) return <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" role="status" aria-label="Cargando" />;

  if (!registros.length) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-surface px-5 py-8 text-sm">
        <p className="font-medium">Todavía no hay picks con resultado.</p>
        <p className="text-ink-dim">
          {subidas.length === 0
            ? "Primero subí el CSV de un día en el analizador."
            : `Hay ${pendientes} predicciones guardadas esperando resultado. Mañana subí el CSV nuevo (trae los partidos de ayer ya jugados) y acá aparece cuántas acertó el motor.`}
        </p>
        <Link href="/csv" className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
          Ir al analizador
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5" aria-label="Resultado principal">
        {alto.picks > 0 ? (
          <>
            <p className="text-sm text-ink-dim">De los picks que el motor puso arriba del 80%, acertaron</p>
            <p className="mt-1 font-mono text-4xl font-semibold tracking-tight">{pct(alto.tasa)}</p>
            <p className="mt-1 text-sm text-ink-dim">
              {alto.aciertos} de {alto.picks} · el motor esperaba {pct(alto.predicho)}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-dim">Todavía no hay picks arriba del 80% con resultado.</p>
        )}
        {filtrados.length < MIN_CONFIABLE && (
          <p className="mt-3 rounded-lg border border-push/30 bg-push/10 px-3 py-2 text-xs text-push">
            Son solo {filtrados.length} picks resueltos. Con menos de {MIN_CONFIABLE} este porcentaje todavía no dice
            nada; seguí subiendo CSVs.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-dim">Muestra mínima</span>
          <select
            className="rounded-md border border-ink-faint bg-surface-2 px-2 py-1.5 text-sm"
            value={muestraMin}
            onChange={(e) => setMuestraMin(Number(e.target.value))}
          >
            {[1, 4, 7, 10].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Todas" : `${n} o más`}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-ink-dim">
          Un pick es un mercado que el motor puso arriba del 50%. {filtrados.length} picks resueltos · {pendientes} esperando resultado{sinDato > 0 && ` · ${sinDato} sin dato para medirlos`}
        </p>
      </div>

      <Tabla titulo="Por rango de probabilidad" celdas={bandas} nota="Si el motor está bien calibrado, “Acertó” se parece a “Esperaba”." />
      <Tabla titulo="Por mercado" celdas={mercados} />
      <Tabla titulo="Por liga" celdas={ligas} nota="Las 12 ligas con más picks." />

      <p className="text-xs leading-relaxed text-ink-dim">
        Los picks de un mismo partido están correlacionados (si el partido sale con muchos goles, aciertan juntos
        “más de 1.5” y “más de 2.5”), así que la muestra efectiva es menor que la cantidad de filas. Los córners solo
        se miden si el CSV de resultados trae la columna de córners.
      </p>
    </div>
  );
}

function Tabla({ titulo, celdas, nota }: { titulo: string; celdas: Celda[]; nota?: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {nota && <p className="text-xs text-ink-dim">{nota}</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="text-left text-xs text-ink-dim">
              <th scope="col" className="px-3 py-2 font-medium">Grupo</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Picks</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Acertó</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Esperaba</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Casa</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {celdas.map((c) => {
              const dif = Math.round((c.tasa - c.predicho) * 100);
              return (
                <tr key={c.etiqueta} className="border-t border-line/60">
                  <th scope="row" className="px-3 py-2 text-left font-normal">{c.etiqueta}</th>
                  <td className="px-3 py-2 text-right font-mono">{c.picks}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{c.picks ? pct(c.tasa) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-dim">{c.picks ? pct(c.predicho) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-dim">{c.picks ? pct(c.mercado) : "—"}</td>
                  <td className={`px-3 py-2 text-right font-mono ${!c.picks ? "text-ink-dim" : dif >= 0 ? "text-over" : "text-under"}`}>
                    {c.picks ? `${dif > 0 ? "+" : ""}${dif} pp` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
