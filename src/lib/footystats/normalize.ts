const sinAcentos = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** minusculas, sin acentos, sin puntuacion ni espacios dobles: "Red Star  Belgrade" -> "red star belgrade". */
export function normalizarNombre(s: string): string {
  return sinAcentos(s).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Encabezado comprimido: "Over05 Average" -> "over05average", "Odds_Over2.5" -> "oddsover25". */
export function compactarEncabezado(s: string): string {
  return sinAcentos(s).replace(/[^a-z0-9]+/g, "");
}

export function matchKey(kickoff: string | null, local: string, visitante: string): { key: string; dayKey: string } {
  const l = normalizarNombre(local);
  const v = normalizarNombre(visitante);
  const minuto = kickoff ? kickoff.slice(0, 16) : "sin-hora";
  const dia = kickoff ? kickoff.slice(0, 10) : "sin-dia";
  return { key: `${minuto}|${l}|${v}`, dayKey: `${dia}|${l}|${v}` };
}
