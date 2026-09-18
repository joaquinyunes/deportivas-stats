import Link from "next/link";
import { notFound } from "next/navigation";
import MetricBreakdown from "@/components/MetricBreakdown";
import { ErrorNotice, InfoNotice } from "@/components/Notice";
import OutcomePanel from "@/components/OutcomePanel";
import Projections from "@/components/Projections";
import RefereePanel from "@/components/RefereePanel";
import TeamLogo from "@/components/TeamLogo";
import TeamPanel from "@/components/TeamPanel";
import Time from "@/components/Time";
import { buildMatchAnalysis } from "@/lib/analysis";
import { getAdapter, isSportId } from "@/lib/sports";
import type { Pitcher } from "@/lib/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string; id: string }>;
  searchParams: Promise<{ date?: string; lg?: string }>;
}) {
  const { sport, id } = await params;
  const { date: dateParam, lg } = await searchParams;
  if (!isSportId(sport)) notFound();
  const date = dateParam ?? todayISO();
  const fixtureId = Number(id);
  const backHref = `/?sport=${sport}&date=${date}`;

  let analysis;
  try {
    analysis = await buildMatchAnalysis(sport, fixtureId, date, lg);
  } catch (e) {
    return (
      <div className="space-y-4">
        <Back href={backHref} />
        <ErrorNotice message={e instanceof Error ? e.message : String(e)} />
      </div>
    );
  }

  const { fixture, home, away, referee } = analysis;
  const adapter = getAdapter(sport);
  const metricKeys = adapter.metricKeys;
  const thin = Math.min(home.sampleSize, away.sampleSize) < 5;
  const b2b = (n: number | null | undefined) => n !== null && n !== undefined && n <= 1;

  return (
    <div className="space-y-6 fade-up">
      <Back href={backHref} />

      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between text-xs text-ink-faint">
          <span>
            {fixture.league.country ? `${fixture.league.country} · ` : ""}
            {fixture.league.name}
          </span>
          <Time iso={fixture.date} mode="datetime" />
        </div>
        <div className="mx-auto mt-3 flex max-w-md items-start justify-center gap-6">
          <TeamCol
            name={fixture.home.name}
            logo={fixture.home.logo}
            pitcher={fixture.pitchers?.home}
            rest={sport === "basketball" ? home.restDays : undefined}
          />
          <span className="mt-3 font-mono text-sm text-ink-faint">vs</span>
          <TeamCol
            name={fixture.away.name}
            logo={fixture.away.logo}
            pitcher={fixture.pitchers?.away}
            rest={sport === "basketball" ? away.restDays : undefined}
          />
        </div>
        {analysis.demo && (
          <div className="mt-3 text-center text-[11px] uppercase tracking-wide text-push">
            datos demo
          </div>
        )}
      </div>

      {adapter.dataNote && <InfoNotice message={adapter.dataNote} />}

      {sport === "basketball" && (b2b(home.restDays) || b2b(away.restDays)) && (
        <div className="rounded-lg border border-push/25 bg-push/10 px-4 py-2 text-xs text-push">
          Back-to-back:{" "}
          {[
            b2b(home.restDays) ? fixture.home.name : null,
            b2b(away.restDays) ? fixture.away.name : null,
          ]
            .filter(Boolean)
            .join(" y ")}{" "}
          jugó ayer. Suele bajar el ritmo y el total.
        </div>
      )}

      {thin && (
        <div className="rounded-lg border border-push/25 bg-push/10 px-4 py-2 text-xs text-push">
          Muestra chica ({home.sampleSize}/{away.sampleSize} partidos). Las proyecciones de abajo son
          poco confiables.
        </div>
      )}

      <OutcomePanel analysis={analysis} />

      <div className={thin ? "opacity-70" : ""}>
        <Projections analysis={analysis} />
      </div>
      <MetricBreakdown home={home} away={away} />
      {referee && <RefereePanel referee={referee} />}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Últimos 10 partidos</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <TeamPanel analysis={home} metricKeys={metricKeys} />
          <TeamPanel analysis={away} metricKeys={metricKeys} />
        </div>
      </section>

      <p className="text-[11px] text-ink-faint">
        Proyección = promedio entre lo que cada equipo genera y lo que el rival concede, con splits
        local/visita y más peso a los partidos recientes. P(over) por Poisson/Normal según la
        métrica. Generado {new Date(analysis.generatedAt).toLocaleTimeString("es-AR")}.
      </p>
    </div>
  );
}

function Back({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink-dim"
    >
      ← Partidos del día
    </Link>
  );
}

function TeamCol({
  name,
  logo,
  pitcher,
  rest,
}: {
  name: string;
  logo: string;
  pitcher?: Pitcher;
  rest?: number | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
      <TeamLogo src={logo} alt={name} size={40} />
      <span className="text-sm font-semibold leading-tight">{name}</span>
      {pitcher && (
        <span className="text-[11px] leading-tight text-ink-faint">
          {pitcher.name}
          {pitcher.era !== undefined ? ` · ERA ${pitcher.era}` : ""}
        </span>
      )}
      {rest !== null && rest !== undefined && (
        <span className="text-[11px] text-ink-faint">
          {rest === 0 ? "jugó hoy" : rest === 1 ? "1 día de descanso" : `${rest} días de descanso`}
        </span>
      )}
    </div>
  );
}
