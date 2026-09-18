import Link from "next/link";
import type { Fixture } from "@/lib/types";
import Time from "./Time";
import TeamLogo from "./TeamLogo";

export default function MatchCard({ fixture, date }: { fixture: Fixture; date: string }) {
  const { home, away, score, finished } = fixture;
  const lg = fixture.league.slug ? `&lg=${fixture.league.slug}` : "";
  return (
    <Link
      href={`/match/${fixture.sport}/${fixture.id}?date=${date}${lg}`}
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <div className="w-14 shrink-0 text-center">
        <div className="font-mono text-xs text-ink-dim">
          {finished ? "FIN" : <Time iso={fixture.date} />}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Row team={home.name} logo={home.logo} score={score.home} />
        <Row team={away.name} logo={away.logo} score={score.away} />
      </div>

      <div className="hidden max-w-[30%] shrink-0 truncate text-right text-xs text-ink-faint sm:block">
        {fixture.league.name}
      </div>
      <span className="text-ink-faint transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

function Row({
  team,
  logo,
  score,
}: {
  team: string;
  logo: string;
  score: number | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <TeamLogo src={logo} alt={team} size={18} />
      <span className="min-w-0 flex-1 truncate text-sm">{team}</span>
      {score !== null && (
        <span className="font-mono text-sm tabular-nums text-ink-dim">{score}</span>
      )}
    </div>
  );
}
