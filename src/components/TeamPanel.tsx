import type { MetricKey, TeamAnalysis } from "@/lib/types";
import FormBadges from "./FormBadges";
import TeamLogo from "./TeamLogo";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default function TeamPanel({
  analysis,
  metricKeys,
}: {
  analysis: TeamAnalysis;
  metricKeys: MetricKey[];
}) {
  const { team, matches, form, record, winPct, sampleSize } = analysis;
  const cols = metricKeys.slice(0, 4);

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <TeamLogo src={team.logo} alt={team.name} size={22} />
        <span className="flex-1 truncate text-sm font-semibold">{team.name}</span>
        <FormBadges form={form} />
      </div>
      <div className="flex gap-4 text-[11px] text-ink-faint">
        <span>
          <span className="font-mono text-ink-dim">
            {record.w}-{record.d}-{record.l}
          </span>{" "}
          en {sampleSize}
        </span>
        <span>
          win <span className="font-mono text-ink-dim">{winPct}%</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-xs">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="py-1 text-left font-medium">Rival</th>
              <th className="py-1 text-center font-medium">Res</th>
              {cols.map((c) => (
                <th key={c.key} className="py-1 text-right font-medium">
                  {c.short ?? c.label.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {matches.map((m) => (
              <tr key={m.id} className="border-t border-line/50">
                <td className="max-w-[110px] truncate py-1.5 font-sans text-ink-dim">
                  <span className="text-ink-faint">{m.isHome ? "vs" : "@"}</span> {m.opponent.name}
                </td>
                <td className="py-1.5 text-center">
                  <span
                    className={
                      m.result === "W"
                        ? "text-over"
                        : m.result === "L"
                          ? "text-under"
                          : "text-push"
                    }
                  >
                    {m.scoreFor}-{m.scoreAgainst}
                  </span>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="py-1.5 text-right">
                    {m.metrics[c.key]
                      ? `${m.metrics[c.key].for}-${m.metrics[c.key].against}`
                      : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-faint">
        Valores como <span className="font-mono">favor-contra</span>
        {matches.length > 1
          ? ` · del ${shortDate(matches[matches.length - 1].date)} al ${shortDate(matches[0].date)}`
          : ""}
      </p>
    </div>
  );
}
