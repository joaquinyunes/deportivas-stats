// Genera CSVs SINTETICOS con la forma del CSV diario de FootyStats, para probar el analizador
// sin datos reales. Los equipos y numeros son inventados. Uso: node scripts/generar-ejemplo.mjs
import { writeFileSync } from "node:fs";

let seed = 20261022;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];
const poisson = (l) => {
  let k = 0;
  let p = 1;
  const L = Math.exp(-l);
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
};

const LIGAS = [
  ["England", "Premier League", 1],
  ["Spain", "La Liga", 1],
  ["Italy", "Serie A", 1],
  ["Europe", "UEFA Europa League", 1],
  ["Europe", "UEFA Conference League", 1],
  ["Europe", "UEFA Champions League", 1],
  ["Bulgaria", "First League", 0.3],
  ["Georgia", "Erovnuli Liga", 0.3],
  ["Sweden", "Allsvenskan", 0.6],
  ["Brazil", "Serie A", 0.8],
];
const NOMBRES = "Atlas Boreal Cobre Delta Eclipse Fénix Gaviota Horizonte Ícaro Jaguar Kiro Lince Mistral Nórdico Olimpo Pampa Quimera Roble Sirius Tundra Urano Vértice Zenit Ágora".split(" ");
const CAB = [
  "League", "Country", "Home Team", "Away Team", "Match Status", "Date (UTC)",
  "Home Team Pre-Match xG", "Away Team Pre-Match xG",
  "Over05 Average", "Over15 Average", "Over25 Average", "Over35 Average", "Over45 Average", "BTTS Average",
  "Average Over 8.5 Corners", "Average Over 9.5 Corners", "Average Over 10.5 Corners",
  "Average Goals", "Average Corners", "Average Cards", "Match FootyStats URL",
  "Odds_Home_Win", "Odds_Draw", "Odds_Away_Win",
  "Odds_Over15", "Odds_Under15", "Odds_Over25", "Odds_Under25", "Odds_Over35", "Odds_Under35",
  "Odds_BTTS_Yes", "Odds_BTTS_No",
  "Odds_Corners_Over_95", "Odds_Corners_Under_95",
  "Home Team Goals", "Away Team Goals", "Total Corners",
];

const cuota = (p, margen) => Math.max(1.02, Math.round((1 / (p * (1 + margen))) * 100) / 100);
const pctDe = (p, n) => Math.round((100 * Math.round(p * n)) / n);

function partido(i, dia, hora, ligaBase) {
  const [pais, liga] = ligaBase;
  const local = `${pick(NOMBRES)} ${String.fromCharCode(65 + (i % 26))}`;
  const visitante = `${pick(NOMBRES)} ${String.fromCharCode(65 + ((i * 7) % 26))}`;
  const n = pick([1, 2, 2, 3, 3, 4, 4, 4, 5, 6, 7, 7, 8, 9, 10, 12, 15, 17]);
  const xgL = 0.7 + rnd() * 1.6;
  const xgV = 0.5 + rnd() * 1.3;
  const total = xgL + xgV;
  const pO = (l) => {
    let c = 0;
    let t = Math.exp(-total);
    for (let k = 0; k <= Math.floor(l); k++) { c += t; t *= total / (k + 1); }
    return 1 - c;
  };
  const jitter = () => (rnd() - 0.5) * 0.35;
  const h = (l) => Math.min(1, Math.max(0, pO(l) + jitter()));
  const btts = Math.min(1, Math.max(0, (1 - Math.exp(-xgL)) * (1 - Math.exp(-xgV)) + jitter()));
  const margen = 0.05 + rnd() * 0.04;
  const sinCorners = rnd() < 0.65;
  const sinOU = rnd() < 0.3;
  // Resultado real (para el CSV del dia siguiente): se sortea con los xG verdaderos.
  const gl = poisson(xgL);
  const gv = poisson(xgV);
  const corners = poisson(9.6);
  const pH = pO(2.5);
  return {
    pais, liga, local, visitante, dia, hora, gl, gv, corners,
    fila: (estado, conResultado) => [
      liga, pais, local, visitante, estado, `${dia} ${hora}`,
      xgL.toFixed(2), xgV.toFixed(2),
      pctDe(h(0.5), n), pctDe(h(1.5), n), pctDe(h(2.5), n), pctDe(h(3.5), n), pctDe(h(4.5), n), pctDe(btts, n),
      pctDe(Math.min(1, Math.max(0, 0.65 + jitter())), n), pctDe(Math.min(1, Math.max(0, 0.5 + jitter())), n), pctDe(Math.min(1, Math.max(0, 0.33 + jitter())), n),
      total.toFixed(2), (9 + (rnd() - 0.5) * 3).toFixed(1), (3.5 + rnd() * 3).toFixed(1),
      `https://footystats.org/ejemplo/${local}-vs-${visitante}`.replace(/ /g, "-"),
      cuota(0.42, margen), cuota(0.27, margen), cuota(0.31, margen),
      sinOU ? "" : cuota(h(1.5), margen), sinOU ? "" : cuota(1 - h(1.5), margen),
      sinOU ? "" : cuota(pH, margen), sinOU ? "" : cuota(1 - pH, margen),
      sinOU ? "" : cuota(h(3.5), margen), sinOU ? "" : cuota(1 - h(3.5), margen),
      cuota(btts, margen), cuota(1 - btts, margen),
      sinCorners ? "" : cuota(0.5, margen), sinCorners ? "" : cuota(0.5, margen),
      conResultado ? gl : "", conResultado ? gv : "", conResultado ? corners : "",
    ].join(","),
  };
}

function virtual(i) {
  const l = pick(["Arsenal", "Roma", "Inter", "Milan", "Ajax"]);
  const v = pick(["Chelsea", "Napoli", "Porto", "Lyon", "Benfica"]);
  return [
    "Esoccer Battle - 8 mins play", "International", `${l} (${pick(["Dani", "Boki", "Nikkitta"])})`, `${v} (${pick(["Zeus", "Vova", "Tonexo"])})`,
    "incomplete", `2026-10-22 ${String(10 + (i % 12)).padStart(2, "0")}:${pick(["00", "15", "30", "45"])}`,
    "2.1", "1.9", "100", "100", "67", "50", "33", "67", "", "", "", "4.0", "", "", "", "1.9", "3.5", "3.8",
    "", "", "1.8", "1.95", "", "", "1.7", "2.1", "", "", "", "", "",
  ].join(",");
}

const horas = ["12:30", "15:00", "17:30", "18:45", "19:30", "20:00", "21:00", "21:45"];
const hoy = [];
for (let i = 0; i < 70; i++) {
  const liga = LIGAS[Math.floor(rnd() ** 1.4 * LIGAS.length)];
  hoy.push(partido(i, "2026-10-22", pick(horas), liga));
}
const manana = [];
for (let i = 0; i < 55; i++) {
  const liga = LIGAS[Math.floor(rnd() ** 1.4 * LIGAS.length)];
  manana.push(partido(100 + i, "2026-10-23", pick(horas), liga));
}

const filasHoy = [
  ...hoy.map((p) => p.fila("incomplete", false)),
  ...Array.from({ length: 25 }, (_, i) => virtual(i)),
  hoy[0].fila("canceled", false),
];
writeFileSync("public/ejemplo-footystats.csv", [CAB.join(","), ...filasHoy].join("\n") + "\n");

// Dia siguiente: los partidos de ayer ya jugados (con resultado) + los nuevos por jugar.
const filasManana = [
  ...hoy.map((p) => p.fila("complete", true)),
  ...manana.map((p) => p.fila("incomplete", false)),
  ...Array.from({ length: 20 }, (_, i) => virtual(i)),
];
writeFileSync("public/ejemplo-footystats-dia-siguiente.csv", [CAB.join(","), ...filasManana].join("\n") + "\n");
console.log(`hoy: ${filasHoy.length} filas · dia siguiente: ${filasManana.length} filas`);
