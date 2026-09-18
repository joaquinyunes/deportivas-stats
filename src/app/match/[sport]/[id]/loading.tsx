export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-3 w-32 animate-pulse rounded bg-surface" />
      <div className="h-28 animate-pulse rounded-lg border border-line bg-surface" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-line bg-surface" />
      <p className="text-xs text-ink-faint">Calculando promedios y proyección…</p>
    </div>
  );
}
