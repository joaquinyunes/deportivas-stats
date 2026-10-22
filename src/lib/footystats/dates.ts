// Fechas de FootyStats: vienen como timestamp, ISO, "Oct 22 2026 - 6:45pm" o dd/mm/yyyy.

const MESES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function utc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): string | null {
  const t = Date.UTC(y, mo, d, h, mi, s);
  const date = new Date(t);
  if (Number.isNaN(t) || date.getUTCMonth() !== mo) return null;
  return date.toISOString();
}

/** Devuelve ISO UTC o null. Los textos sin zona horaria se asumen UTC (el CSV es "Date (UTC)"). */
export function parseFechaHora(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  if (/^\d{9,13}$/.test(s)) {
    const n = Number(s);
    const ms = s.length >= 12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const iso = utc(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    if (!iso) return null;
    const off = m[7];
    if (off && off.toUpperCase() !== "Z") {
      const sign = off[0] === "-" ? -1 : 1;
      const digits = off.slice(1).replace(":", "");
      const mins = +digits.slice(0, 2) * 60 + +digits.slice(2);
      return new Date(new Date(iso).getTime() - sign * mins * 60_000).toISOString();
    }
    return iso;
  }

  m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\s+(\d{4})(?:\s*[-,]?\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?$/i);
  if (m) {
    const mo = MESES[m[1].toLowerCase()];
    if (mo === undefined) return null;
    let h = +(m[4] ?? 0);
    const ap = m[6]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return utc(+m[3], mo, +m[2], h, +(m[5] ?? 0));
  }

  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ T]+(\d{1,2}):(\d{2}))?$/);
  if (m) return utc(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));

  return null;
}

/** "HH:00" local de un ISO, para agrupar por franja horaria. */
export function franjaHoraria(iso: string | null): string {
  if (!iso) return "Sin hora";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function horaLocal(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}
