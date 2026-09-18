import type { Projection } from "@/lib/types";

const STYLE: Record<NonNullable<Projection["lean"]>, string> = {
  over: "bg-over/15 text-over",
  under: "bg-under/15 text-under",
  push: "bg-push/15 text-push",
};
const TEXT: Record<NonNullable<Projection["lean"]>, string> = {
  over: "OVER",
  under: "UNDER",
  push: "PUSH",
};

export default function LeanPill({ lean }: { lean?: Projection["lean"] }) {
  if (!lean) return null;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${STYLE[lean]}`}>
      {TEXT[lean]}
    </span>
  );
}
