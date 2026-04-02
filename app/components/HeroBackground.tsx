"use client";

import { useState, useEffect } from "react";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1604908176997-125188eb3dd3?w=1920&q=80";

export function HeroBackground({ children }: { children: React.ReactNode }) {
  const [bgImage, setBgImage] = useState("/jireh/hero_new.png");

  useEffect(() => {
    const img = new Image();
    img.onerror = () => setBgImage(FALLBACK_IMAGE);
    img.src = "/jireh/hero_new.png";
  }, []);

  return (
    <header className="relative flex min-h-[100dvh] flex-col justify-end bg-[var(--surface-dark)] px-6 pb-16 pt-24 text-white md:justify-center md:pb-24 md:pt-32">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-55 transition-opacity duration-500"
        style={{ backgroundImage: `url("${bgImage}")` }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[var(--surface-dark)]/95 via-[var(--surface-dark)]/65 to-[var(--surface-dark)]/40"
        aria-hidden
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(214,138,71,0.22),transparent_38%)]" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
        {children}
      </div>
    </header>
  );
}
