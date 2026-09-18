# Deportivas

Analisis tipo FootyStats sobre los ultimos 10 partidos de cada equipo, por deporte.
Calcula promedios (goles, corners, tarjetas, remates, puntos por cuarto, carreras),
el arbitro asignado y una proyeccion del partido del dia.

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
