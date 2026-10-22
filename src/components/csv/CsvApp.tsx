"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaLarga } from "@/lib/footystats/format";
import { parseCsv } from "@/lib/footystats/parse";
import {
  borrarSubida,
  cargarConfig,
  cargarSubidas,
  guardarConfig,
  guardarSubida,
  nuevaSubida,
} from "@/lib/footystats/storage";
import { CONFIG_DEFAULT, type Config, type CsvMatch, type Subida } from "@/lib/footystats/types";
import {
  FILTROS_DEFAULT,
  ORDEN_DEFAULT,
  evaluar,
  filasDe,
  filtrosAQuery,
  ligasDe,
  ordenarSecciones,
  parseFiltros,
  seccionar,
  tarjetasDe,
  type Columna,
  type Filtros,
  type Orden,
} from "@/lib/footystats/view";
import DetallePartido from "./DetallePartido";
import FiltrosBar from "./Filtros";
import ResumenSubida from "./ResumenSubida";
import Tablero, { TarjetasInfo } from "./Tablero";
import UploadZone from "./UploadZone";

export default function CsvApp() {
  const sp = useSearchParams();
  const filtros = useMemo(() => parseFiltros(sp), [sp]);
  const [subidas, setSubidas] = useState<Subida[] | null>(null);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(CONFIG_DEFAULT);
  const [orden, setOrden] = useState<Orden>(ORDEN_DEFAULT);
  const [detalle, setDetalle] = useState<CsvMatch | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "error" | "info"; texto: string } | null>(null);

  useEffect(() => {
    const guardadas = cargarSubidas();
    setSubidas(guardadas);
    setActivaId(guardadas[0]?.id ?? null);
    setConfig(cargarConfig());
  }, []);

  // Los filtros viven en la URL (?muestra=7&prob=80&agrupar=mercado): se actualiza sin navegar.
  const setFiltros = useCallback(
    (patch: Partial<Filtros>) => {
      const q = filtrosAQuery({ ...filtros, ...patch }).toString();
      window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
    },
    [filtros],
  );

  const activa = subidas?.find((s) => s.id === activaId) ?? null;
  const matches = useMemo(() => activa?.matches ?? [], [activa]);
  const evaluados = useMemo(() => evaluar(matches, config), [matches, config]);
  const filas = useMemo(() => filasDe(evaluados, filtros), [evaluados, filtros]);
  const secciones = useMemo(
    () => ordenarSecciones(seccionar(filas, filtros.agrupar), orden),
    [filas, filtros.agrupar, orden],
  );
  const tarjetas = useMemo(() => (filtros.mercado ? [] : tarjetasDe(matches, filtros)), [matches, filtros]);
  const ligas = useMemo(() => ligasDe(matches), [matches]);

  function onArchivo(nombre: string, contenido: string) {
    setAviso(null);
    let parseado;
    try {
      parseado = parseCsv(contenido);
    } catch {
      setAviso({ tipo: "error", texto: "No pude leer ese archivo como CSV. Revisá que sea el CSV diario de FootyStats, sin editar." });
      return;
    }
    if (!parseado.matches.length) {
      setAviso({
        tipo: "error",
        texto: parseado.resumen.columnasFaltantes.length
          ? `No encontré partidos. Al archivo le faltan estas columnas: ${parseado.resumen.columnasFaltantes.join(", ")}. Revisá que sea el CSV diario de FootyStats.`
          : "No encontré partidos válidos en el archivo. Revisá que sea el CSV diario de FootyStats.",
      });
      return;
    }
    const subida = nuevaSubida(nombre, parseado, config);
    const { subida: guardada, subidas: lista, guardado } = guardarSubida(subida);
    setSubidas(lista);
    setActivaId(guardada.id);
    setDetalle(null);
    if (!guardado) {
      setAviso({
        tipo: "info",
        texto: "El archivo se analizó, pero el navegador no tiene lugar para guardarlo: se pierde al cerrar la pestaña. Borrá algún día viejo y volvé a subirlo.",
      });
    } else if (guardada.resumen.incompletos === 0) {
      setAviso({
        tipo: "info",
        texto: "Este archivo no trae partidos por jugar. Se guardó igual: sus resultados se cruzan con tus predicciones anteriores en Rendimiento.",
      });
    }
  }

  function onConfig(c: Config) {
    setConfig(c);
    guardarConfig(c);
  }

  function onOrden(col: Columna) {
    setOrden((o) => (o.col === col ? { col, dir: o.dir === 1 ? -1 : 1 } : { col, dir: col === "hora" || col === "partido" ? 1 : -1 }));
  }

  function onBorrar() {
    if (!activa) return;
    if (!window.confirm(`¿Borrar el día ${fechaLarga(activa.fecha)} (${activa.nombreArchivo})? Se pierden sus partidos y predicciones, y no se puede deshacer.`)) return;
    const lista = borrarSubida(activa.id);
    setSubidas(lista);
    setActivaId(lista[0]?.id ?? null);
  }

  if (subidas === null) {
    return <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" aria-label="Cargando" role="status" />;
  }

  return (
    <div className="space-y-5">
      {subidas.length === 0 ? (
        <>
          <UploadZone onArchivo={onArchivo} />
          <ComoFunciona />
          <Ejemplos onArchivo={onArchivo} />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium text-ink-dim">Día</span>
            <select
              className="rounded-md border border-ink-faint bg-surface-2 px-2 py-1.5 text-sm"
              value={activaId ?? ""}
              onChange={(e) => {
                setActivaId(e.target.value);
                setDetalle(null);
              }}
            >
              {subidas.map((s) => (
                <option key={s.id} value={s.id}>
                  {fechaLarga(s.fecha)} · {s.resumen.incompletos} por jugar
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onBorrar}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-dim hover:border-under/50 hover:text-under focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Borrar este día
          </button>
          <div className="ml-auto">
            <UploadZone onArchivo={onArchivo} compacto />
          </div>
        </div>
      )}

      <div role={aviso?.tipo === "error" ? "alert" : "status"}>
        {aviso && (
          <p
            className={`rounded-lg border px-4 py-2.5 text-sm ${
              aviso.tipo === "error" ? "border-under/30 bg-under/10 text-under" : "border-accent/25 bg-accent/10 text-accent"
            }`}
          >
            {aviso.texto}
          </p>
        )}
      </div>

      {activa && (
        <>
          <ResumenSubida subida={activa} />
          <FiltrosBar
            filtros={filtros}
            onCambio={setFiltros}
            ligas={ligas}
            config={config}
            onConfig={onConfig}
            total={filas.length}
          />
          {filas.length === 0 && tarjetas.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-sm text-ink-dim">
              <p>Ningún mercado pasa estos filtros. Probá bajar la probabilidad o la muestra mínima.</p>
              <button
                type="button"
                onClick={() => setFiltros({ ...FILTROS_DEFAULT, prob: 50, muestra: 1, ventaja: 0, liga: "", mercado: "", grandes: false })}
                className="mt-3 rounded-md border border-line px-3 py-1.5 text-xs hover:text-ink"
              >
                Aflojar los filtros
              </button>
            </div>
          ) : (
            <div className="space-y-3 fade-up">
              <Tablero secciones={secciones} orden={orden} onOrden={onOrden} onAbrir={setDetalle} agrupar={filtros.agrupar} />
              <TarjetasInfo partidos={tarjetas} onAbrir={setDetalle} />
            </div>
          )}
          <Advertencia />
        </>
      )}

      <DetallePartido match={detalle} config={config} onCerrar={() => setDetalle(null)} />
    </div>
  );
}

/** CSVs inventados con la forma del de FootyStats, para probar sin tener un archivo a mano. */
function Ejemplos({ onArchivo }: { onArchivo: (nombre: string, contenido: string) => void }) {
  const [error, setError] = useState(false);
  async function cargar(archivo: string) {
    setError(false);
    try {
      const res = await fetch(`/${archivo}`);
      if (!res.ok) throw new Error();
      onArchivo(archivo, await res.text());
    } catch {
      setError(true);
    }
  }
  const boton =
    "rounded-md border border-line px-3 py-1.5 text-xs hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-dim">
      <span>¿No tenés un CSV a mano? Probá con datos de ejemplo (inventados):</span>
      <button type="button" className={boton} onClick={() => cargar("ejemplo-footystats.csv")}>
        Día 1
      </button>
      <button type="button" className={boton} onClick={() => cargar("ejemplo-footystats-dia-siguiente.csv")}>
        Día 2 (con resultados del día 1)
      </button>
      {error && <span role="alert" className="text-under">No se pudo cargar el ejemplo.</span>}
    </div>
  );
}

function ComoFunciona() {
  const pasos = [
    ["Subís el CSV del día", "Un botón, un archivo. Se descartan los partidos ya jugados y el fútbol virtual queda oculto."],
    ["El motor calcula", "Para cada mercado compara el histórico de la temporada con lo que paga la casa, sin el margen."],
    ["Ves el tablero", "Ordenado por hora y por probabilidad, con el tamaño de muestra al lado de cada número."],
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {pasos.map(([t, d], i) => (
        <li key={t} className="rounded-xl border border-line bg-surface p-4">
          <span className="font-mono text-xs text-accent">0{i + 1}</span>
          <h2 className="mt-1 text-sm font-semibold">{t}</h2>
          <p className="mt-1 text-xs text-ink-dim">{d}</p>
        </li>
      ))}
    </ol>
  );
}

function Advertencia() {
  return (
    <p className="text-xs leading-relaxed text-ink-dim">
      La probabilidad ajustada es una estimación a partir de promedios de temporada, no una predicción. Un 85% quiere decir
      que, si el modelo está bien calibrado, de cada veinte veces falla tres. Hasta tener resultados cargados en{" "}
      <a href="/csv/rendimiento" className="text-accent underline-offset-2 hover:underline">
        Rendimiento
      </a>
      , los números son una hipótesis. Las filas con barra roja tienen menos de 4 partidos de muestra por equipo. No es
      consejo de apuestas.
    </p>
  );
}
