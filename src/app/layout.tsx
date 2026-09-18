import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Deportivas — análisis de promedios",
  description:
    "Análisis de los últimos 10 partidos por equipo: corners, tarjetas, goles, puntos, carreras y proyecciones por deporte.",
};

export const viewport = { themeColor: "#0a0b0d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="grid h-6 w-6 place-items-center rounded bg-accent/15 text-accent">
                ▚
              </span>
              Deportivas
            </Link>
            <a
              href="https://www.espn.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-faint transition-colors hover:text-ink-dim"
            >
              Datos: ESPN
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-ink-faint">
          Promedios ponderados por recencia sobre los últimos 10 partidos. Datos: API pública de ESPN.
          No es consejo de apuestas.
        </footer>
      </body>
    </html>
  );
}
