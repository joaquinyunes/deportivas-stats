// Reconoce las columnas del CSV de FootyStats por patron, no por nombre exacto: el archivo tiene
// ~107 columnas y los nombres cambian de a poco ("Over25 Average", "Odds_Over25", "Odds_Over_2.5"...).
// Los encabezados se comprimen (minusculas, sin simbolos) y se matchean con regex.
import { compactarEncabezado } from "./normalize";

export interface ColumnMap {
  liga?: string;
  pais?: string;
  local?: string;
  visitante?: string;
  estado?: string;
  url?: string;
  timestamp?: string;
  fechaHora?: string;
  fecha?: string;
  hora?: string;
  xgLocal?: string;
  xgVisitante?: string;
  promGoles?: string;
  promCorners?: string;
  promTarjetas?: string;
  golesLocal?: string;
  golesVisitante?: string;
  cornersTotal?: string;
  cornersLocal?: string;
  cornersVisitante?: string;
  /** clave de % historico (over25, btts, c95) -> encabezado */
  pct: Record<string, string>;
  /** clave de cuota (ft:over:2.5, btts:yes, 1x2:X, corners:under:9.5) -> encabezado */
  odds: Record<string, string>;
}

const SIMPLES: [keyof Omit<ColumnMap, "pct" | "odds">, RegExp][] = [
  ["liga", /^(league|leaguename|competition|competitionname)$/],
  ["pais", /^(country|nation|leaguecountry)$/],
  ["local", /^(hometeam|hometeamname|home)$/],
  ["visitante", /^(awayteam|awayteamname|away)$/],
  ["estado", /^(matchstatus|status)$/],
  ["url", /^(matchfootystatsurl|footystatsurl|matchurl|url|link)$/],
  ["timestamp", /^(timestamp|unixtimestamp|datetimestamp|matchtimestamp|kickofftimestamp)$/],
  ["fechaHora", /^(dateutc|datetimeutc|dategmt|datetimegmt|kickoffutc|kickoffdatetime|datetime|utcdate)$/],
  ["fecha", /^(date|matchdate|kickoffdate)$/],
  ["hora", /^(time|kickofftime|matchtime|timeutc|timegmt|ko)$/],
  ["xgLocal", /^(hometeamprematchxg|homeprematchxg|prematchxghome)$/],
  ["xgVisitante", /^(awayteamprematchxg|awayprematchxg|prematchxgaway)$/],
  ["promGoles", /^averagegoals$/],
  ["promCorners", /^averagecorners$/],
  ["promTarjetas", /^averagecards$/],
  ["golesLocal", /^home(?:team)?(?:goals?|goalcount|score)$/],
  ["golesVisitante", /^away(?:team)?(?:goals?|goalcount|score)$/],
  ["cornersTotal", /^(?:total)?corners(?:total|count)?$/],
  ["cornersLocal", /^home(?:team)?corner(?:s|count)$/],
  ["cornersVisitante", /^away(?:team)?corner(?:s|count)$/],
];

const lineaDe = (digits: string) => String(Number(digits) / 10);

/** Clave de cuota para un encabezado comprimido, o null si no es una cuota que conozcamos. */
export function claveCuota(h: string): string | null {
  if (!h.startsWith("odds")) return null;
  let m: RegExpMatchArray | null;
  if ((m = h.match(/^odds(?:home(?:win)?|1)$/))) return "1x2:1";
  if ((m = h.match(/^odds(?:draw|x)$/))) return "1x2:X";
  if ((m = h.match(/^odds(?:away(?:win)?|2)$/))) return "1x2:2";
  if ((m = h.match(/^odds(?:btts|bothteamstoscore)(yes|no)$/))) return `btts:${m[1]}`;
  if (h === "oddsgg") return "btts:yes";
  if (h === "oddsng") return "btts:no";
  if ((m = h.match(/^odds(?:corners?|crn)(over|under)(\d{2,3})$/)) || (m = h.match(/^odds(over|under)(\d{2,3})corners?$/)))
    return `corners:${m[1]}:${lineaDe(m[2])}`;
  if ((m = h.match(/^odds(?:1sthalf|firsthalf|1h|ht)(?:goals?)?(over|under)(\d{2,3})$/)))
    return `h1:${m[1]}:${lineaDe(m[2])}`;
  if ((m = h.match(/^odds(?:2ndhalf|secondhalf|2h)(?:goals?)?(over|under)(\d{2,3})$/)))
    return `h2:${m[1]}:${lineaDe(m[2])}`;
  if ((m = h.match(/^odds(?:ft|fulltime|goals?|total)?(over|under)(\d{2,3})$/))) return `ft:${m[1]}:${lineaDe(m[2])}`;
  return null;
}

/** Clave de % historico (over25, btts, c95) para un encabezado comprimido, o null. */
export function clavePct(h: string): string | null {
  let m: RegExpMatchArray | null;
  if ((m = h.match(/^over(05|15|25|35|45|55)(?:average|avg|percentage|percent|pct)$/))) return `over${m[1]}`;
  if (/^btts(?:average|avg|percentage|percent|pct)$/.test(h)) return "btts";
  if ((m = h.match(/^averageover(\d{2,3})corners$/)) || (m = h.match(/^over(\d{2,3})corners(?:average|avg|percentage|pct)?$/)))
    return `c${m[1]}`;
  return null;
}

export function resolverColumnas(headers: string[]): ColumnMap {
  const map: ColumnMap = { pct: {}, odds: {} };
  for (const original of headers) {
    const h = compactarEncabezado(original);
    if (!h) continue;
    const pk = clavePct(h);
    if (pk) {
      map.pct[pk] ??= original;
      continue;
    }
    const ok = claveCuota(h);
    if (ok) {
      map.odds[ok] ??= original;
      continue;
    }
    for (const [campo, re] of SIMPLES) {
      if (re.test(h)) {
        if (!map[campo]) map[campo] = original;
        break;
      }
    }
  }
  return map;
}

/** Que le falta al archivo para que el motor rinda. Texto pensado para mostrarse al usuario. */
export function columnasFaltantes(map: ColumnMap): string[] {
  const out: string[] = [];
  if (!map.local || !map.visitante) out.push("Home Team / Away Team");
  if (!map.timestamp && !map.fechaHora && !map.fecha) out.push("fecha y hora del partido");
  if (!map.estado) out.push("Match Status");
  if (!map.liga) out.push("League");
  if (!map.xgLocal || !map.xgVisitante) out.push("Pre-Match xG (sin él no hay 1X2)");
  if (!Object.keys(map.pct).length) out.push("porcentajes históricos (Over25 Average, BTTS Average...)");
  if (!Object.keys(map.odds).length) out.push("cuotas (Odds_*)");
  return out;
}
