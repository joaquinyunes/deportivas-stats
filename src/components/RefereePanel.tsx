import type { RefereeAnalysis } from "@/lib/types";

export default function RefereePanel({ referee }: { referee: RefereeAnalysis }) {
  if (referee.sampleSize === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Arbitro</h2>
        <div className="rounded-lg border border-line bg-surface p-4">
          <span className="text-sm font-medium">{referee.name}</span>
          <p className="mt-1 text-[11px] text-ink-faint">
            {referee.note ?? "Sin datos de tarjetas para este arbitro en la muestra."}
          </p>
        </div>
      </section>
    );
  }

  const stats = [
    { label: "Amarillas / partido", value: referee.yellowAvg },
    { label: "Rojas / partido", value: referee.redAvg },
    { label: "Tarjetas totales", value: referee.cardsAvg },
    ...(referee.foulsAvg !== undefined
      ? [{ label: "Faltas / partido", value: referee.foulsAvg }]
      : []),
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Arbitro</h2>
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{referee.name}</span>
          <span className="text-[11px] text-ink-faint">
            muestra: {referee.sampleSize} · fuente: {referee.source}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md bg-surface-2 p-2.5">
              <div className="font-mono text-lg tabular-nums">{s.value}</div>
              <div className="text-[11px] text-ink-faint">{s.label}</div>
            </div>
          ))}
        </div>
        {referee.note && <p className="mt-3 text-[11px] text-ink-faint">{referee.note}</p>}
      </div>
    </section>
  );
}
