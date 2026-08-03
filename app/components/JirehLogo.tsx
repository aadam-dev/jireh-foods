"use client";

import { useState } from "react";
import Image from "next/image";

const FALLBACK_ALT = "Jireh Natural Foods";

/* The source file is 1280×1280 / 121KB but never renders larger than ~108px.
   A raw <img> made every visitor download all of it; next/image serves a
   correctly-sized AVIF/WebP instead (~4KB at these sizes). The .png/.svg
   fallback chain is kept — it exists because the logo asset has changed
   format before. */
export function JirehLogo({
  className = "",
  size = 120,
  dark = false,
  priority = false,
}: {
  className?: string;
  size?: number;
  dark?: boolean;
  /** Set on the logo that appears above the fold. */
  priority?: boolean;
}) {
  const [source, setSource] = useState<
    "/jireh/logo.jpg" | "/jireh/logo.png" | "/jireh/logo.svg" | null
  >("/jireh/logo.jpg");

  const handleError = () => {
    if (source === "/jireh/logo.jpg") setSource("/jireh/logo.png");
    else if (source === "/jireh/logo.png") setSource("/jireh/logo.svg");
    else setSource(null);
  };

  if (source === null) {
    return (
      <span
        className={`font-serif font-semibold tracking-tight ${dark ? "text-[var(--foreground)]" : "text-white"} ${className}`}
        style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)" }}
      >
        {FALLBACK_ALT}
      </span>
    );
  }

  return (
    <Image
      src={source}
      alt={FALLBACK_ALT}
      width={size}
      height={size}
      priority={priority}
      // Rendered at a fixed CSS size, so one candidate width is enough.
      sizes={`${size}px`}
      className={`rounded-full bg-white object-contain p-1 ${className}`}
      onError={handleError}
    />
  );
}
