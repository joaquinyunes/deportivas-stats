"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Partidos del día", corto: "Partidos" },
  { href: "/csv", label: "Analizador CSV", corto: "CSV" },
  { href: "/csv/rendimiento", label: "Rendimiento", corto: "Rendimiento" },
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const activo = l.href === "/" ? path === "/" || path.startsWith("/match") : path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.label}
            aria-current={activo ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-2 py-1.5 sm:px-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              activo ? "bg-surface-2 text-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            <span className="sm:hidden" aria-hidden>{l.corto}</span>
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
