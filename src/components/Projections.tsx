import type { MatchAnalysis, Projection } from "@/lib/types";
import LeanPill from "./LeanPill";

const PREFIX = /^(fc|ac|as|sc|cf|cd|us|ss|sv|vfb|vfl|afc|1\.?|club|real|cs)$/i;

/** nombre corto util: descarta prefijos genericos ("FC Twente" -> "Twente"). */
function shortLabel(name: string): string {
  const words = name.split(" ");
  return words.find((w) => !PREFIX.test(w)) ?? words[0];
}

export default function Projections({ analysis }: { analysis: MatchAnalysis }) {
  const { projections, home, away } = analysis;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight">Proyección del partido</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {projections.map((p) => (
          <Card
            key={p.key}
            p={p}
            homeName={shortLabel(home.team.name)}
            awayName={shortLabel(away.team.name)}
          />
        ))}
      </div>
    </section>
  );
}

function Card({ p, homeName, awayName }: { p: Projection; homeName: string; awayName: string }) {
  // Barra: rango linea ±35%, marca de la linea al centro, relleno hasta el valor esperado.
  const span = p.line ? p.line * 0.7 : Math.max(1, p.totalExpected);
  const lo = p.line ? p.line - span / 2 : 0;
  const pct = (v: number) => Math.max(2, Math.min(98, ((v - lo) / span) * 100));
  const pOverTxt = p.pOver !== undefined ? `${Math.round(p.pOver * 100)}%` : null;

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">{p.label}</span>
        <LeanPill lean={p.lean} />
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl tabular-nums">{p.totalExpected}</span>
        {p.line !== undefined && <span className="text-xs text-ink-faint">línea {p.line}</span>}
        {pOverTxt && (
          <span className="ml-auto font-mono text-xs text-ink-dim">P(over) {pOverTxt}</span>
        )}
      </div>

      {p.line !== undefined && p.pOver !== undefined && (
        <div className="relative mt-2 h-1.5 rounded-full bg-surface-2">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              p.lean === "over" ? "bg-over/70" : p.lean === "under" ? "bg-under/70" : "bg-push/70"
            }`}
            style={{ width: `${pct(p.totalExpected)}%` }}
          />
          <div
            className="absolute inset-y-[-2px] w-px bg-ink-dim"
            style={{ left: `${pct(p.line)}%` }}
            title={`línea ${p.line}`}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
        <span className="truncate">
          {homeName} <span className="font-mono text-ink-dim">{p.homeExpected}</span>
        </span>
        <span className="truncate text-right">
          {awayName} <span className="font-mono text-ink-dim">{p.awayExpected}</span>
        </span>
      </div>

      {p.overPct !== undefined && (
        <div className="mt-1 text-[11px] text-ink-faint">
          hist: {p.overPct}% de sus partidos pasaron la línea
          {p.samples < 5 ? ` · muestra ${p.samples}` : ""}
        </div>
      )}
    </div>
  );
}
