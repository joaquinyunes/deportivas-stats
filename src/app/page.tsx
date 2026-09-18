import { Suspense } from "react";
import Controls from "@/components/Controls";
import MatchCard from "@/components/MatchCard";
import { DemoNotice, EmptyNotice, ErrorNotice, InfoNotice } from "@/components/Notice";
import { getFixtures } from "@/lib/analysis";
import { getAdapter, isSportId } from "@/lib/sports";
import type { Fixture, SportId } from "@/lib/types";

// Sin force-dynamic: la pagina es dinamica por los searchParams, pero asi el
// Data Cache de Next cachea los fetch a ESPN (revalidate por endpoint).
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const sport: SportId = sp.sport && isSportId(sp.sport) ? sp.sport : "football";
  const date = sp.date ?? todayISO();
  const adapter = getAdapter(sport);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Partidos del día</h1>
        <p className="text-sm text-ink-faint">
          Elegí un partido para ver promedios de los últimos 10 (el último pesa más) y la proyección.
        </p>
      </div>

      <Controls sport={sport} date={date} />
      {adapter.demo && !adapter.dataNote ? (
        <DemoNotice />
      ) : (
        adapter.dataNote && <InfoNotice message={adapter.dataNote} />
      )}

      <Suspense key={`${sport}-${date}`} fallback={<FixtureSkeleton />}>
        <FixtureList sport={sport} date={date} />
      </Suspense>
    </div>
  );
}

async function FixtureList({ sport, date }: { sport: SportId; date: string }) {
  let fixtures: Fixture[];
  try {
    fixtures = await getFixtures(sport, date);
  } catch (e) {
    return <ErrorNotice message={e instanceof Error ? e.message : String(e)} />;
  }

  if (!fixtures.length) {
    return <EmptyNotice message="No hay partidos para esta fecha y deporte." />;
  }

  const byLeague = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const k = f.league.country ? `${f.league.country} · ${f.league.name}` : f.league.name;
    const list = byLeague.get(k);
    if (list) list.push(f);
    else byLeague.set(k, [f]);
  }

  return (
    <div className="space-y-6 fade-up">
      {[...byLeague.entries()].map(([league, list]) => (
        <section key={league} className="space-y-2">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
            {league}
          </h2>
          <div className="space-y-1.5">
            {list.map((f) => (
              <MatchCard key={f.id} fixture={f} date={date} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FixtureSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-lg border border-line bg-surface" />
      ))}
    </div>
  );
}
