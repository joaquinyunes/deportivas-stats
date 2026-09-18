import type { MatchAnalysis } from "@/lib/types";

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export default function OutcomePanel({ analysis }: { analysis: MatchAnalysis }) {
  const { outcome, home, away, fixture } = analysis;
  const isFootball = fixture.sport === "football";
  const bars: { label: string; p: number; tone: string }[] = [
    { label: home.team.name, p: outcome.homeWin, tone: "bg-over/70" },
    ...(isFootball ? [{ label: "Empate", p: outcome.draw, tone: "bg-push/70" }] : []),
    { label: away.team.name, p: outcome.awayWin, tone: "bg-accent/70" },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Resultado</h2>
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between text-xs text-ink-faint">
          <span>
            {isFootball ? "Goles esperados" : "Esperado"}:{" "}
            <span className="font-mono text-ink-dim">
              {outcome.homeExp} – {outcome.awayExp}
            </span>
          </span>
          {outcome.margin !== undefined && (
            <span>
              margen{" "}
              <span className="font-mono text-ink-dim">
                {outcome.margin > 0 ? "+" : ""}
                {outcome.margin}
              </span>
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate text-ink-dim">{b.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${b.tone}`}
                  style={{ width: `${Math.max(2, b.p * 100)}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right font-mono tabular-nums text-ink">
                {pct(b.p)}
              </span>
            </div>
          ))}
        </div>

        {isFootball && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
            {outcome.btts !== undefined && (
              <span>
                Ambos marcan <span className="font-mono text-ink-dim">{pct(outcome.btts)}</span>
              </span>
            )}
            {outcome.topScores?.length ? (
              <span>
                Marcadores:{" "}
                {outcome.topScores.map((s, i) => (
                  <span key={s.score}>
                    {i > 0 ? " · " : ""}
                    <span className="font-mono text-ink-dim">{s.score}</span> ({pct(s.p)})
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
