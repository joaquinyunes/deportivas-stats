"use client";

import type { Config } from "@/lib/footystats/types";
import { GRUPOS } from "@/lib/footystats/types";
import { MUESTRAS, type Agrupar, type Filtros } from "@/lib/footystats/view";

const AGRUPAR: { id: Agrupar; label: string }[] = [
  { id: "hora", label: "Hora" },
  { id: "mercado", label: "Mercado" },
  { id: "liga", label: "Liga" },
  { id: "partido", label: "Partido" },
];

const campo = "rounded-md border border-ink-faint bg-surface-2 px-2 py-1.5 text-sm text-ink";
const etiqueta = "text-xs font-medium text-ink-dim";

export default function FiltrosBar({
  filtros,
  onCambio,
  ligas,
  config,
  onConfig,
  total,
}: {
  filtros: Filtros;
  onCambio: (patch: Partial<Filtros>) => void;
  ligas: string[];
  config: Config;
  onConfig: (c: Config) => void;
  total: number;
}) {
  return (
    <section aria-label="Filtros" className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5">
          <span className={etiqueta}>Muestra mínima por equipo</span>
          <select
            className={`${campo} w-full`}
            value={MUESTRAS.includes(filtros.muestra as (typeof MUESTRAS)[number]) ? filtros.muestra : 1}
            onChange={(e) => onCambio({ muestra: Number(e.target.value) })}
          >
            {MUESTRAS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Todas (1 o más)" : `${n} partidos o más`}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className={etiqueta}>
            Probabilidad mínima: <b className="font-mono text-ink">{filtros.prob}%</b>
          </span>
          <input
            type="range"
            min={50}
            max={95}
            step={1}
            value={filtros.prob}
            onChange={(e) => onCambio({ prob: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </label>

        <label className="space-y-1.5">
          <span className={etiqueta}>
            Ventaja mínima:{" "}
            <b className="font-mono text-ink">{filtros.ventaja === 0 ? "sin filtro" : `${filtros.ventaja} pp`}</b>
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={filtros.ventaja}
            onChange={(e) => onCambio({ ventaja: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </label>

        <label className="space-y-1.5">
          <span className={etiqueta}>Agrupar por</span>
          <select
            className={`${campo} w-full`}
            value={filtros.agrupar}
            onChange={(e) => onCambio({ agrupar: e.target.value as Agrupar })}
          >
            {AGRUPAR.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="space-y-1.5">
          <span className={`${etiqueta} block`}>Liga</span>
          <select className={`${campo} max-w-64`} value={filtros.liga} onChange={(e) => onCambio({ liga: e.target.value })}>
            <option value="">Todas</option>
            {ligas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className={`${etiqueta} block`}>Mercado</span>
          <select
            className={campo}
            value={filtros.mercado}
            onChange={(e) => onCambio({ mercado: e.target.value as Filtros["mercado"] })}
          >
            <option value="">Todos</option>
            {GRUPOS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <Interruptor
          checked={filtros.grandes}
          onChange={(v) => onCambio({ grandes: v })}
          label="Solo ligas grandes"
          ayuda="Champions, Europa, Conference y las cinco grandes"
        />
        <Interruptor
          checked={filtros.ocultarVirtuales}
          onChange={(v) => onCambio({ ocultarVirtuales: v })}
          label="Ocultar fútbol virtual"
        />
        <p className="ml-auto text-xs text-ink-dim" aria-live="polite">
          {total} {total === 1 ? "mercado" : "mercados"} con estos filtros
        </p>
      </div>

      <details className="text-xs text-ink-dim">
        <summary className="cursor-pointer select-none py-1 hover:text-ink">Ajustes del motor</summary>
        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="space-y-1.5">
            <span className={`${etiqueta} block`}>Constante de confianza (K)</span>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={config.k}
              onChange={(e) => onConfig({ ...config, k: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })}
              className={`${campo} w-20 font-mono`}
            />
          </label>
          <Interruptor
            checked={config.golesPoisson}
            onChange={(v) => onConfig({ ...config, golesPoisson: v })}
            label="Goles y ambos marcan con Poisson (xG)"
            ayuda="En vez de promediar los % de los dos equipos"
          />
          <p className="max-w-sm">
            Con K = 5, un partido de muestra 5 pesa mitad histórico y mitad mercado. K más alto confía menos en el
            histórico. Las predicciones ya guardadas conservan el K con el que se subieron.
          </p>
        </div>
      </details>
    </section>
  );
}

function Interruptor({
  checked,
  onChange,
  label,
  ayuda,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  ayuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm" title={ayuda}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      <span>
        {label}
        {ayuda && <span className="sr-only">. {ayuda}</span>}
      </span>
    </label>
  );
}
