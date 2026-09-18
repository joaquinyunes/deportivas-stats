import type { MetricAverage, TeamAnalysis } from "@/lib/types";

/** flecha de tendencia (L5 vs L10) cuando ambos equipos van en la misma direccion. */
function Trend({ a, b }: { a?: MetricAverage["trend"]; b?: MetricAverage["trend"] }) {
  const dir = a && a === b && a !== "flat" ? a : undefined;
  if (!dir) return null;
  return (
    <span
      className={`ml-1 text-[11px] ${dir === "up" ? "text-over" : "text-under"}`}
      title="tendencia de los últimos 5 partidos"
    >
      {dir === "up" ? "▲" : "▼"}
    </span>
  );
}

export default function MetricBreakdown({
  home,
  away,
}: {
  home: TeamAnalysis;
  away: TeamAnalysis;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Promedios por equipo (últimos 10)</h2>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2 text-left font-medium">Metrica</th>
              <th className="px-3 py-2 text-right font-medium">{home.team.name} favor</th>
              <th className="px-3 py-2 text-right font-medium">{home.team.name} contra</th>
              <th className="px-3 py-2 text-right font-medium">{away.team.name} favor</th>
              <th className="px-3 py-2 text-right font-medium">{away.team.name} contra</th>
              <th className="px-3 py-2 text-right font-medium">% over</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {home.metrics.map((hm) => {
              const am = away.metrics.find((m) => m.key === hm.key);
              return (
                <tr key={hm.key} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 font-sans text-ink-dim">
                    {hm.label}
                    {hm.line !== undefined && (
                      <span className="ml-1 text-[11px] text-ink-faint">L{hm.line}</span>
                    )}
                    <Trend a={hm.trend} b={am?.trend} />
                  </td>
                  <td className="px-3 py-2 text-right">{hm.forAvg}</td>
                  <td className="px-3 py-2 text-right text-ink-faint">{hm.againstAvg}</td>
                  <td className="px-3 py-2 text-right">{am?.forAvg ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-ink-faint">{am?.againstAvg ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {hm.overPct !== undefined && am?.overPct !== undefined
                      ? `${Math.round((hm.overPct + am.overPct) / 2)}%`
                      : "—"}
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
