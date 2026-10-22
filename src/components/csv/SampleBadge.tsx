/** Tamaño de muestra con color Y texto: rojo < 4, ambar 4-6, verde >= 7. */
export function nivelMuestra(n: number | null): "desconocida" | "baja" | "media" | "alta" {
  if (n === null) return "desconocida";
  return n < 4 ? "baja" : n < 7 ? "media" : "alta";
}

const ESTILO = {
  desconocida: "bg-line text-ink-dim",
  baja: "bg-under/15 text-under",
  media: "bg-push/15 text-push",
  alta: "bg-over/15 text-over",
} as const;

const TEXTO = {
  desconocida: "No se pudo inferir la muestra",
  baja: "Muestra baja: menos de 4 partidos por equipo",
  media: "Muestra media: 4 a 6 partidos por equipo",
  alta: "Muestra buena: 7 o más partidos por equipo",
} as const;

export default function SampleBadge({ n }: { n: number | null }) {
  const nivel = nivelMuestra(n);
  return (
    <span
      className={`inline-block min-w-8 rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-bold ${ESTILO[nivel]}`}
      title={TEXTO[nivel]}
    >
      <span aria-hidden>{n ?? "?"}</span>
      <span className="sr-only">
        {n === null ? "Muestra desconocida" : `Muestra de ${n} partidos`}. {TEXTO[nivel]}
      </span>
    </span>
  );
}
