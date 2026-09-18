// Cliente de la API publica no oficial de ESPN (site.api.espn.com). Sin key.
// Es no oficial: puede cambiar. Todo el parseo es defensivo.

const SITE = "https://site.api.espn.com/apis/site/v2/sports";

interface CacheEntry {
  at: number;
  ttl: number;
  data: unknown;
}
// Cache acotada por-instancia. El cache real y persistente es el Data Cache de
// Next (fetch con `revalidate`); este Map solo evita repetir dentro de un mismo
// render y en dev. FIFO con tope para no crecer sin limite en un proceso vivo.
const MAX_ENTRIES = 300;
const cache = new Map<string, CacheEntry>();
// Coalescing: si N requests piden el mismo path a la vez, se hace 1 sola.
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  scoreboard: 5 * 60 * 1000, // 5 min
  schedule: 60 * 60 * 1000, // 1 h
  summary: 24 * 60 * 60 * 1000, // 24 h (partido terminado no cambia)
};

/** GET contra site.api.espn.com. `path` arranca sin barra, ej "soccer/eng.1/scoreboard?dates=20260907". */
export async function espnGet<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data as T;

  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    const res = await fetch(`${SITE}/${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: Math.max(1, Math.floor(ttlMs / 1000)) },
    });
    if (!res.ok) {
      throw new Error(`ESPN ${path.split("?")[0]} respondió ${res.status}`);
    }
    const json = (await res.json()) as T;
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(path, { at: Date.now(), ttl: ttlMs, data: json });
    return json;
  })();

  inflight.set(path, p);
  try {
    return await p;
  } finally {
    inflight.delete(path);
  }
}

/** Promesas con limite de concurrencia. */
export async function mapLimit<A, B>(
  items: A[],
  limit: number,
  fn: (item: A, index: number) => Promise<B>,
): Promise<B[]> {
  const out: B[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return out;
}

export function yyyymmdd(date: string): string {
  return date.slice(0, 10).replace(/-/g, "");
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.round(Math.abs(a - b) / 86_400_000);
}

// ---- shapes parciales de ESPN ----
export type EspnScore = string | number | { value?: number; displayValue?: string } | null;

export interface EspnTeam {
  id: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  abbreviation?: string;
  logo?: string;
  logos?: { href: string; rel?: string[] }[];
}

export interface EspnAthlete {
  fullName?: string;
  displayName?: string;
  shortName?: string;
}

export interface EspnProbable {
  name?: string;
  athlete?: EspnAthlete;
  statistics?: { name?: string; displayValue?: string; value?: number }[];
  record?: string;
}

export interface EspnCompetitor {
  id: string;
  homeAway: "home" | "away";
  team: EspnTeam;
  score?: EspnScore;
  linescores?: { value?: number; displayValue?: string }[];
  probables?: EspnProbable[];
}

/** El score llega como string (scoreboard) u objeto {value,displayValue} (schedule). */
export function scoreOf(s: EspnScore | undefined): number | null {
  if (s === null || s === undefined) return null;
  if (typeof s === "object") {
    return s.displayValue !== undefined
      ? num(s.displayValue)
      : s.value !== undefined
        ? s.value
        : null;
  }
  return num(s);
}

export interface EspnEvent {
  id: string;
  date: string;
  name?: string;
  season?: { year?: number };
  status?: { type?: { name?: string; state?: string; completed?: boolean } };
  competitions?: {
    id: string;
    date: string;
    competitors?: EspnCompetitor[];
    status?: { type?: { name?: string; state?: string; completed?: boolean } };
  }[];
}

export interface EspnScoreboard {
  leagues?: { id?: string; name?: string; abbreviation?: string; slug?: string }[];
  events?: EspnEvent[];
}

export interface EspnScheduleResp {
  team?: { id?: string; displayName?: string };
  events?: EspnEvent[];
  requestedSeason?: { year?: number };
}

export interface EspnStat {
  name?: string;
  displayValue?: string;
  value?: number;
  stats?: EspnStat[];
}

export interface EspnSummary {
  boxscore?: {
    teams?: { team?: EspnTeam; statistics?: EspnStat[] }[];
  };
  header?: {
    competitions?: {
      id?: string;
      date?: string;
      status?: { type?: { name?: string; state?: string; completed?: boolean } };
      competitors?: EspnCompetitor[];
    }[];
  };
  gameInfo?: {
    officials?: { fullName?: string; displayName?: string; position?: { name?: string } }[];
  };
}

export function teamLogo(c: EspnTeam): string {
  // ESPN sirve variantes: "scoreboard" (oscura) y "500-dark". Preferir la full clara.
  const light = c.logos?.find((l) => !(l.rel ?? []).includes("dark"))?.href;
  const raw = light || c.logo || c.logos?.[0]?.href || "";
  return raw.replace("/scoreboard/", "/").replace("/500-dark/", "/500/");
}

export function completed(e: EspnEvent): boolean {
  const t = e.status?.type ?? e.competitions?.[0]?.status?.type;
  return t?.completed === true || t?.state === "post";
}

export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace("%", "")) || 0;
}
