const MAP = {
  W: { bg: "bg-over/15", fg: "text-over", label: "G" },
  D: { bg: "bg-push/15", fg: "text-push", label: "E" },
  L: { bg: "bg-under/15", fg: "text-under", label: "P" },
} as const;

export default function FormBadges({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form.length) return <span className="text-xs text-ink-faint">sin datos</span>;
  return (
    <div className="flex gap-1">
      {form.map((r, i) => {
        const m = MAP[r];
        return (
          <span
            key={i}
            className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold ${m.bg} ${m.fg}`}
          >
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
