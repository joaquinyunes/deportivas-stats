"use client";

import { useEffect, useState } from "react";

/** Hora/fecha en la zona horaria y locale del navegador (SSR muestra UTC hasta hidratar). */
export default function Time({ iso, mode = "time" }: { iso: string; mode?: "time" | "datetime" }) {
  const opts: Intl.DateTimeFormatOptions =
    mode === "time"
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" };

  const [text, setText] = useState(() => new Date(iso).toISOString().slice(11, 16) + " UTC");

  useEffect(() => {
    setText(new Date(iso).toLocaleString(undefined, opts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, mode]);

  return <span suppressHydrationWarning>{text}</span>;
}
