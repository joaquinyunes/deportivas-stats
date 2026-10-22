export const pct = (p: number): string => `${Math.round(p * 100)}%`;

export function pp(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toFixed(1)}`;
}

export function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function urlSegura(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
