"use client";

import Image from "next/image";

/* The hero sits at 55% opacity under two gradient layers, so it is decoration
   rather than content — but it is also the heaviest thing a first-time visitor
   downloads, and most of them are on Ghanaian mobile data.

   It used to be a CSS background-image, which bypasses the image optimizer
   entirely: every visitor pulled the full 349KB JPEG at every screen size.
   next/image serves a correctly-sized AVIF/WebP instead. `priority` keeps it
   as the LCP candidate; `quality={55}` is generous for something behind two
   gradients at just over half opacity.

   There is deliberately no stock-photo fallback: showing someone else's food
   on a real restaurant's site is worse than showing none, and the section
   reads perfectly well on its dark background alone. */

export function HeroBackground({ children }: { children: React.ReactNode }) {
  return (
    <header className="relative flex min-h-[100dvh] flex-col justify-end bg-[var(--surface-dark)] px-6 pb-16 pt-24 text-white md:justify-center md:pb-24 md:pt-32">
      <div className="absolute inset-0 opacity-55" aria-hidden>
        <Image
          src="/jireh/hero-bg.jpg"
          alt=""
          fill
          priority
          quality={55}
          /* Decoration, not detail: cap the candidate width rather than using
             100vw, which makes wide screens pull the 1600px original for
             something sitting at 55% opacity under two gradients. */
          sizes="(max-width: 768px) 60vw, 800px"
          className="object-cover object-center"
        />
      </div>
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
