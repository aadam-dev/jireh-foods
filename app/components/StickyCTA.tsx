"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Phone, MapPin } from "lucide-react";

const PHONE = "tel:+233551133481";
const MAPS = "https://maps.app.goo.gl/kfRUcx2bjwNJUWs79?g_st=ic";
const WHATSAPP_ORDER =
  "https://wa.me/233551133481?text=Hello%20Jireh%20Natural%20Foods!%20I%20would%20like%20to%20place%20an%20order...";

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
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center gap-2 border-t border-[var(--border)] bg-[var(--card)]/95 px-3 pt-3 shadow-lg backdrop-blur sm:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      role="group"
      aria-label="Quick actions"
    >
      {/* WhatsApp is the primary order channel — it gets the widest button */}
      <a
        href={WHATSAPP_ORDER}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[48px] flex-[1.4] items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-3 font-semibold text-white transition hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--card)]"
      >
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        <span className="truncate">Order</span>
      </a>
      <a
        href={PHONE}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--accent)] px-3 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--card)]"
      >
        <Phone className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Call</span>
      </a>
      <a
        href={MAPS}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get directions"
        className="flex min-h-[48px] w-[52px] shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--foreground)] transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--card)]"
      >
        <MapPin className="h-5 w-5" aria-hidden />
      </a>
    </div>
  );
}
