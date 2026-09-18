"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-under/30 bg-under/10 px-4 py-4 text-sm text-under">
      <div className="font-medium">Algo falló al cargar esta vista</div>
      <div className="font-mono text-xs opacity-80">{error.message}</div>
      <button
        onClick={reset}
        className="rounded-md border border-under/40 px-3 py-1.5 text-xs transition-colors hover:bg-under/15"
      >
        Reintentar
      </button>
    </div>
  );
}
