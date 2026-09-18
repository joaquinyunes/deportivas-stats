"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SPORTS } from "@/lib/sportsMeta";
import type { SportId } from "@/lib/types";

export default function Controls({ sport, date }: { sport: SportId; date: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: { sport?: SportId; date?: string }) {
    const s = next.sport ?? sport;
    const d = next.date ?? date;
    startTransition(() => router.replace(`/?sport=${s}&date=${d}`, { scroll: false }));
  }

  function shift(days: number) {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    go({ date: d.toISOString().slice(0, 10) });
  }

  return (
    <div
      className={`flex flex-col gap-3 transition-opacity sm:flex-row sm:items-center sm:justify-between ${
        pending ? "opacity-60" : ""
      }`}
      aria-busy={pending}
    >
      <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
        {SPORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => go({ sport: s.id })}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              s.id === sport
                ? "bg-surface-2 text-ink shadow-sm"
                : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            <span aria-hidden>{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => shift(-1)}
          className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink-dim transition-colors hover:text-ink"
          aria-label="Día anterior"
        >
          ‹
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go({ date: e.target.value })}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink [color-scheme:dark]"
        />
        <button
          onClick={() => shift(1)}
          className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink-dim transition-colors hover:text-ink"
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>
    </div>
  );
}
