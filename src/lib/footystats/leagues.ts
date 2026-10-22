import { normalizarNombre } from "./normalize";

const NACIONALES = [
  /^england premier league$/,
  /^spain (la ?liga|primera division)$/,
  /^italy serie a$/,
  /^germany bundesliga$/,
  /^france ligue 1$/,
];
const CONTINENTALES = /^(uefa )?(champions league|europa league|europa conference league|conference league)$/;
const EXCLUIR = /\b(women|womens|feminin\w*|youth|u ?\d{2}|qualif\w*|reserves?)\b/;

/** Europa, Conference, Champions y las cinco grandes ligas. */
export function esLigaGrande(pais: string, liga: string): boolean {
  const l = normalizarNombre(liga);
  const p = normalizarNombre(pais);
  if (EXCLUIR.test(l)) return false;
  if (CONTINENTALES.test(l)) return true;
  const texto = p && !l.startsWith(p) ? `${p} ${l}` : l;
  return NACIONALES.some((re) => re.test(texto));
}
