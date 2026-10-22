# Deportivas

Analisis tipo FootyStats sobre los ultimos 10 partidos de cada equipo, por deporte.
Calcula promedios (goles, corners, tarjetas, remates, puntos por cuarto, carreras),
el arbitro asignado y una proyeccion del partido del dia.

## Analizador de CSV de FootyStats (`/csv`)

Subis el CSV diario de FootyStats y te devuelve, ordenado por hora y por probabilidad, que es lo
mas probable que pase hoy, con el tamano de muestra al lado de cada numero. **Todo corre en el
navegador**: el archivo no se sube a ningun servidor y los dias se guardan en `localStorage`
(hasta 10 dias).

- `/csv` — subir, tablero con filtros, detalle del partido (clic en el nombre).
- `/csv/rendimiento` — cruza las predicciones guardadas con los resultados de los CSV siguientes:
  acierto real vs esperado por rango de probabilidad, mercado y liga.
- Los filtros viven en la URL: `?muestra=7&prob=80&agrupar=mercado&grandes=1`.
- Sin CSV a mano: botones de ejemplo (datos **inventados**, `npm run ejemplo` los regenera).

### Motor (`src/lib/footystats/engine.ts`, funciones puras)

1. `devig()`: saca el margen de la casa con el par de cuotas opuestas (3 vias para 1X2).
2. Probabilidad historica: la columna `OverNN Average` / `BTTS Average` / `Average Over N Corners`
   del CSV; para 1X2, Poisson con el Pre-Match xG (doble oportunidad y empate-anula salen de ahi).
3. `ajustarPorMuestra()`: `n/(n+K) * hist + K/(n+K) * mercado`, K configurable (default 5).
4. `calcularVentaja()`: ajustada menos mercado, en puntos porcentuales.

El tamano de muestra no viene en el archivo: `inferirMuestra()` busca el denominador mas chico
(hasta 20) que explica todos los porcentajes de la fila a la vez (43 y 86 -> 7). Si ninguno
explica la fila queda `?` y se usa una muestra efectiva de 10.

Se omiten (no se estiman) los mercados sin las dos cuotas del par. Tarjetas es una seccion
informativa: el CSV trae el promedio pero no cuotas. El futbol virtual se detecta por el nombre
de la liga y queda oculto por defecto.

### Columnas

Se reconocen por patron, no por nombre exacto (`src/lib/footystats/columns.ts`): `Over25 Average`,
`Odds_Over25`, `Odds_Over_2.5`, `Home Team Pre-Match xG`, `Match Status`... Al subir, el resumen
avisa que columnas no encontro. **Los nombres se dedujeron de la descripcion del CSV, no de un
archivo real**: si alguno no se reconoce, se suma el patron ahi (hay tests en `footystats.test.ts`).

### Pendiente

Postgres/Prisma (fase 4 "de verdad": historial entre dispositivos), mercados de primer/segundo
tiempo (el CSV no trae % historicos para esas lineas), ventana de los ultimos 7 partidos y
enfrentamientos directos (necesitan semanas de CSVs acumulados).

## Stack

- Next.js 15 (App Router) + TypeScript estricto + Tailwind
- **Datos: API publica no oficial de ESPN** (`site.api.espn.com`) — sin API key
- Deploy: Vercel

## Setup

```bash
npm install
npm run dev
```

No hace falta ninguna key. Opcional `.env.local` (ver `.env.local.example`):

| Var | Default | Que hace |
|---|---|---|
| `DEMO_MODE` | `false` | `true` = datos sinteticos deterministas (sin red) |
| `SOCCER_LEAGUES` | 15 ligas top | slugs de ESPN para "partidos del dia" |
| `ESPN_DEEP` | `true` | `false` = solo goles/puntos/carreras, menos requests |

## Deportes y metricas

| Deporte | Fuente ESPN | Metricas |
|---|---|---|
| Futbol | `soccer/{liga}` | goles, corners, amarillas, rojas, remates, remates al arco, faltas, offsides + arbitro |
| NBA | `basketball/nba` | puntos totales, 1ra mitad, 1er cuarto |
| MLB | `baseball/mlb` | carreras, carreras F5, hits |

Ligas de futbol por defecto: Premier, LaLiga, Serie A, Bundesliga, Ligue 1, Primeira,
Eredivisie, Championship, MLS, Liga MX, Liga Argentina, Brasileirao, Champions, Europa,
Libertadores. Se agregan/quitan con `SOCCER_LEAGUES`.

## Arquitectura

```
src/lib/
  espn.ts                cliente site.api.espn.com: fetch + cache acotada + coalescing + parsers
  types.ts               interfaces + SportAdapter
  stats.ts               analyzeTeam(), project() (ponderado por recencia), refereeFromDataset()
  analysis.ts            fixture -> historiales -> analisis + proyeccion
  sports/
    createAdapter.ts     factory generico ESPN (fixtures, getFixtureById, historial, summary, arbitro)
    football.ts          config soccer: fan-out por liga; historial via "soccer/all" (liga + copas)
    basketball.ts        config NBA: linescores por cuarto -> 1ra mitad / 1er cuarto
    baseball.ts          config MLB: innings -> F5, hits; pitchers probables (ERA) del scoreboard
    demo.ts              adapter sintetico (DEMO_MODE=true)
    index.ts             registro + getAdapter()
src/app/
  page.tsx                       partidos del dia
  match/[sport]/[id]/page.tsx    analisis del partido (+ loading.tsx / error.tsx)
  api/fixtures, api/analysis     JSON
```

### Modelo de proyeccion

- **Recencia**: cada partido pesa `0.82^i` (i = 0 es el mas reciente); el 10mo pesa ~0.17.
- **Local/visita**: el equipo local usa sus splits de local y el visitante los de visita,
  con shrinkage hacia el promedio global cuando la muestra del venue es chica.
- **Valor esperado**: `homeExpected = avg(home.forLocal, away.againstVisita)`,
  `awayExpected = avg(away.forVisita, home.againstLocal)`, `total = suma`.
- **P(over linea)**: Poisson para conteos chicos (goles, corners, tarjetas...) y Normal
  (con desvio de la muestra) para totales grandes (puntos NBA, hits). `lean` sale de P(over):
  over si >= 0.57, under si <= 0.43, si no push.
- **Resultado** (`outcome()`): futbol usa Poisson independiente sobre los goles esperados de
  cada lado -> 1X2, ambos marcan y los 3 marcadores mas probables. NBA/MLB: Normal sobre la
  diferencia -> prob. de ganar el local y margen esperado.
- **Tendencia**: cada metrica compara el total de los ultimos 5 con el de los 10 (flecha ▲/▼).
- **MLB**: pitcher probable + ERA. **NBA**: dias de descanso y aviso de back-to-back.

### Tests

`npm test` (vitest) cubre el nucleo estadistico: ponderacion por recencia, tendencia,
`project()` (lean/pOver) y `outcome()` (1X2 suma 1, BTTS en rango, NBA sin empate).

### Costo de requests

Por analisis: `getFixtureById` (1 `summary` si el partido termino, si no cae al fan-out ya
cacheado) + 1-2 `schedule` por equipo + hasta 20 `summary` de partidos historicos
(concurrencia 4, cache 24 h, coalescing de requests concurrentes). Sin `force-dynamic`: el
Data Cache de Next sirve las repeticiones. Con `ESPN_DEEP=false` se saltan los `summary`.

## Limitaciones

- La API de ESPN es **no oficial**: puede cambiar sin aviso. Todo el parseo es defensivo
  y cae a datos parciales antes que romper.
- ESPN no expone el historial de un arbitro, solo el asignado al partido. El promedio de
  tarjetas del arbitro sale de los partidos suyos **dentro de la muestra** (casi siempre
  0-2 partidos).
- Fuera de temporada (ej. NBA en septiembre) la lista del dia viene vacia: elegi otra fecha.
- **eSports**: ESPN discontinuo su cobertura, la API no lo tiene. Se podria sumar despues
  con otro proveedor (PandaScore tiene free tier) reusando el patron `SportAdapter`.

No es consejo de apuestas.
