"use client";

import { useState } from "react";

const FALLBACK_ALT = "Jireh Natural Foods";

export function JirehLogo({
  className = "",
  size = 120,
  dark = false,
}: {
  className?: string;
  size?: number;
  dark?: boolean;
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
    <img
      src={source}
      alt={FALLBACK_ALT}
      width={size}
      height={size}
      className={`rounded-full bg-white object-contain p-1 ${className}`}
      onError={handleError}
    />
  );
}
