"use client";

/* The hero sits at 55% opacity under two gradient layers, so it is decoration
   rather than content — it gets a low-quality JPEG (341KB, down from an 809KB
   PNG) and the section stays readable on its own if the image never arrives.
   There is deliberately no stock-photo fallback: showing someone else's food on
   a real restaurant's site is worse than showing none. */

const HERO_IMAGE = "/jireh/hero-bg.jpg";

export function HeroBackground({ children }: { children: React.ReactNode }) {
  return (
    <header className="relative flex min-h-[100dvh] flex-col justify-end bg-[var(--surface-dark)] px-6 pb-16 pt-24 text-white md:justify-center md:pb-24 md:pt-32">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-55"
        style={{ backgroundImage: `url("${HERO_IMAGE}")` }}
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
