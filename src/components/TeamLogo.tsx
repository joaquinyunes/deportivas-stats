"use client";

import { useState } from "react";

export default function TeamLogo({
  src,
  alt,
  size = 24,
}: {
  src: string;
  alt: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = alt
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (failed || !src) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded bg-surface-2 text-[11px] font-semibold text-ink-dim"
        style={{ width: size, height: size }}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
