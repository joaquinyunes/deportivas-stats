import type { Metadata } from "next";
import RendimientoView from "@/components/csv/RendimientoView";

export const metadata: Metadata = { title: "Rendimiento del motor — Deportivas" };

export default function RendimientoPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Rendimiento del motor</h1>
        <p className="text-sm text-ink-dim">
          Cruza las predicciones de cada día con los resultados que traen los CSV siguientes. Es el único número que
          importa a mediano plazo: dice si el motor sirve o no.
        </p>
      </div>
      <RendimientoView />
    </div>
  );
}
