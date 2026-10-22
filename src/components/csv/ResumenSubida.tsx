import { fechaLarga } from "@/lib/footystats/format";
import type { Subida } from "@/lib/footystats/types";

export default function ResumenSubida({ subida }: { subida: Subida }) {
  const r = subida.resumen;
  const descartadas = r.descartadas.reduce((a, d) => a + d.cantidad, 0);
  return (
    <section aria-label="Resumen del archivo" className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{fechaLarga(subida.fecha)}</h2>
        <span className="truncate font-mono text-xs text-ink-dim">{subida.nombreArchivo}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <Cifra k="Filas leídas" v={r.filasTotales} />
        <Cifra k="Partidos por jugar" v={r.incompletos} destacado />
        <Cifra k="Ya jugados" v={r.jugados} nota="se guardan para medir el rendimiento" />
        <Cifra k="Fútbol virtual" v={r.virtuales} nota="oculto por defecto" />
        <Cifra k="Descartadas" v={descartadas} />
      </dl>
      {r.descartadas.length > 0 && (
        <ul className="text-xs text-ink-dim">
          {r.descartadas.map((d) => (
            <li key={d.motivo}>
              {d.cantidad} · {d.motivo}
            </li>
          ))}
        </ul>
      )}
      {r.columnasFaltantes.length > 0 && (
        <div role="note" className="rounded-lg border border-push/30 bg-push/10 px-3 py-2 text-xs text-push">
          <b>No encontré estas columnas:</b> {r.columnasFaltantes.join(" · ")}. El motor va a calcular menos mercados.
          Si el archivo las trae con otro nombre, sumalas en <code className="font-mono">src/lib/footystats/columns.ts</code>.
        </div>
      )}
      <p className="text-xs text-ink-dim">
        Reconocí {r.columnasPct} columnas de porcentaje histórico y {r.columnasCuotas} de cuotas.
      </p>
    </section>
  );
}

function Cifra({ k, v, nota, destacado }: { k: string; v: number; nota?: string; destacado?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-dim">{k}</dt>
      <dd className={`font-mono text-lg font-semibold ${destacado ? "text-accent" : ""}`}>{v}</dd>
      {nota && <p className="text-[11px] leading-tight text-ink-dim">{nota}</p>}
    </div>
  );
}
