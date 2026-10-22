"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 25 * 1024 * 1024;

export default function UploadZone({
  onArchivo,
  compacto,
}: {
  onArchivo: (nombre: string, contenido: string) => void;
  compacto?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  async function leer(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.(csv|txt)$/i.test(file.name) && file.type !== "text/csv") {
      setError("Ese archivo no parece un CSV. Bajá el CSV diario de FootyStats y probá de nuevo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("El archivo pesa más de 25 MB. Un CSV diario de FootyStats pesa menos de 1 MB.");
      return;
    }
    setLeyendo(true);
    try {
      onArchivo(file.name, await file.text());
    } catch {
      setError("No se pudo leer el archivo. Probá exportarlo de nuevo.");
    } finally {
      setLeyendo(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        void leer(e.dataTransfer.files[0]);
      }}
      className={`rounded-xl border border-dashed text-center transition-colors ${
        arrastrando ? "border-accent bg-accent/10" : "border-line-strong bg-surface"
      } ${compacto ? "px-4 py-3" : "px-6 py-10"}`}
    >
      <input
        ref={input}
        id="csv-input"
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => void leer(e.target.files?.[0])}
      />
      {!compacto && (
        <>
          <p className="text-sm font-medium">Arrastrá acá el CSV del día</p>
          <p className="mt-1 text-xs text-ink-dim">
            Se procesa en tu navegador: el archivo no sale de tu computadora.
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={leyendo}
        className={`rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
          compacto ? "" : "mt-4"
        }`}
      >
        {leyendo ? "Leyendo…" : compacto ? "Subir otro CSV" : "Elegir archivo"}
      </button>
      <div role="alert" className="text-xs text-under">
        {error && <p className="mt-3">{error}</p>}
      </div>
    </div>
  );
}
