"use client";

import { useEffect, useMemo, useRef } from "react";
import { horaLocal } from "@/lib/footystats/dates";
import { evaluarPartido } from "@/lib/footystats/engine";
import { pct, pp, urlSegura } from "@/lib/footystats/format";
import { GRUPOS, type Config, type CsvMatch } from "@/lib/footystats/types";
import { ligaLabel } from "@/lib/footystats/view";
import SampleBadge from "./SampleBadge";

export default function DetallePartido({
  match,
  config,
  onCerrar,
}: {
  match: CsvMatch | null;
  config: Config;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const mercados = useMemo(() => (match ? evaluarPartido(match, config) : []), [match, config]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (match && !d.open) d.showModal();
    if (!match && d.open) d.close();
  }, [match]);

  const url = urlSegura(match?.url ?? null);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      aria-labelledby="detalle-titulo"
      className="m-auto w-[min(720px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-xl border border-line-strong bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      {match && (
        <div className="space-y-5 p-5">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="detalle-titulo" className="text-lg font-semibold tracking-tight">
                {match.local} <span className="text-ink-dim">vs</span> {match.visitante}
              </h2>
              <p className="mt-1 text-sm text-ink-dim">
                {ligaLabel(match)} · {horaLocal(match.kickoff)}
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar detalle"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-ink-dim hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              ✕
            </button>
          </header>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Dato k="Muestra" v={<SampleBadge n={match.muestra} />} />
            <Dato k="xG local" v={match.xgLocal?.toFixed(2) ?? "—"} />
            <Dato k="xG visitante" v={match.xgVisitante?.toFixed(2) ?? "—"} />
            <Dato k="Goles (prom.)" v={match.promGoles?.toFixed(2) ?? "—"} />
            <Dato k="Córners (prom.)" v={match.promCorners?.toFixed(1) ?? "—"} />
            <Dato k="Tarjetas (prom.)" v={match.promTarjetas?.toFixed(1) ?? "—"} />
          </dl>

          {(match.muestra ?? 10) < 4 && (
            <p className="rounded-lg border border-under/30 bg-under/10 px-3 py-2 text-xs text-under">
              Muestra baja: los porcentajes y el xG salen de muy pocos partidos de la temporada. Tomalos como ruido, no
              como tendencia.
            </p>
          )}

          {mercados.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-3 text-sm text-ink-dim">
              Este partido no tiene ningún mercado con las dos cuotas cargadas, así que no hay nada que comparar.
            </p>
          ) : (
            GRUPOS.map((g) => {
              const lista = mercados.filter((m) => m.grupo === g.id).sort((a, b) => b.pAjustada - a.pAjustada);
              if (!lista.length) return null;
              return (
                <section key={g.id}>
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-dim">{g.label}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <caption className="sr-only">{g.label}</caption>
                      <thead>
                        <tr className="text-left text-xs text-ink-dim">
                          <th scope="col" className="py-1 pr-3 font-medium">Mercado</th>
                          <th scope="col" className="px-2 py-1 text-right font-medium">Histórica</th>
                          <th scope="col" className="px-2 py-1 text-right font-medium">Ajustada</th>
                          <th scope="col" className="px-2 py-1 text-right font-medium">Casa</th>
                          <th scope="col" className="px-2 py-1 text-right font-medium">Ventaja</th>
                          <th scope="col" className="py-1 pl-2 text-right font-medium">Cuota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((m) => (
                          <tr key={m.id} className="border-t border-line/60">
                            <td className="py-1.5 pr-3">{m.etiqueta}</td>
                            <td className="px-2 text-right font-mono text-ink-dim">{pct(m.pHist)}</td>
                            <td className="px-2 text-right font-mono font-semibold">{pct(m.pAjustada)}</td>
                            <td className="px-2 text-right font-mono text-ink-dim">{pct(m.pMercado)}</td>
                            <td className={`px-2 text-right font-mono ${m.ventaja > 0.05 ? "text-over" : m.ventaja < -0.05 ? "text-under" : "text-ink-dim"}`}>
                              {pp(m.ventaja)}
                            </td>
                            <td className="pl-2 text-right font-mono text-ink-dim">{m.cuota ? m.cuota.toFixed(2) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-dim">
            <span>Histórica = promedio de temporada del CSV (1X2: Poisson con el xG).</span>
            {url && (
              <a href={url} target="_blank" rel="noreferrer noopener" className="text-accent underline-offset-2 hover:underline">
                Ver en FootyStats ↗
              </a>
            )}
          </footer>
        </div>
      )}
    </dialog>
  );
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <dt className="text-xs text-ink-dim">{k}</dt>
      <dd className="mt-0.5 font-mono font-semibold">{v}</dd>
    </div>
  );
}
