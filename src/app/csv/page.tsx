import type { Metadata } from "next";
import { Suspense } from "react";
import CsvApp from "@/components/csv/CsvApp";

export const metadata: Metadata = {
  title: "Analizador de CSV — Deportivas",
  description: "Subí el CSV diario de FootyStats y mirá qué es lo más probable que pase hoy, con el tamaño de muestra a la vista.",
};

export default function CsvPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Analizador de CSV de FootyStats</h1>
        <p className="text-sm text-ink-dim">
          Lo más probable que pase hoy, ordenado por hora y probabilidad. Cada número lleva al lado cuántos partidos hay
          detrás.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-line bg-surface" />}>
        <CsvApp />
      </Suspense>
    </div>
  );
}
