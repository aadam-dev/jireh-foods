"use client";

import { useEffect, useState } from "react";

const PHONE = "tel:+233551133481";
const MAPS = "https://maps.app.goo.gl/kfRUcx2bjwNJUWs79?g_st=ic";

export function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center gap-3 border-t border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 shadow-lg backdrop-blur sm:hidden"
      role="group"
      aria-label="Quick actions"
    >
      <a
        href={PHONE}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      >
        <span aria-hidden>📞</span> Call
      </a>
      <a
        href={MAPS}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--accent)] px-4 py-3 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      >
        <span aria-hidden>📍</span> Directions
      </a>
    </div>
  );
}
