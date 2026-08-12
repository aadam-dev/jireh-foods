'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* Overflow menu for the register.
   ────────────────────────────────────────────────────────────────────────────
   Secondary actions used to be scattered: some in the header and desktop-only,
   some behind a long-press with no affordance, some reachable only by leaving
   the screen you were on. This is the one place a cashier looks when the thing
   they want is not a menu tile.

   The panel is portaled to document.body and positioned fixed. The register
   shell uses overflow-hidden, so an absolute dropdown inside the header was
   clipped on phones — the Menu button appeared to do nothing. */

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Short line under the label, for anything not self-evident. */
  hint?: string;
  onSelect: () => void;
  /** Renders in red — sign out, and anything else that ends the session. */
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
}

type PanelPos = { top: number; left: number; width: number; maxHeight: number; mobileSheet: boolean };

export function ActionMenu({
  items,
  label = 'More actions',
  trigger,
  align = 'right',
}: {
  items: ActionMenuItem[];
  label?: string;
  trigger: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const place = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const mobileSheet = window.innerWidth < 640;
    if (mobileSheet) {
      // Bottom sheet — thumb-reachable, never clipped by the register shell.
      setPos({
        top: 0,
        left: 0,
        width: window.innerWidth,
        maxHeight: Math.min(window.innerHeight * 0.72, window.innerHeight - 24),
        mobileSheet: true,
      });
      return;
    }
    const width = 288;
    const gap = 8;
    const maxHeight = Math.min(420, window.innerHeight - r.bottom - 16);
    let left = align === 'right' ? r.right - width : r.left;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setPos({
      top: r.bottom + gap,
      left,
      width,
      maxHeight: Math.max(180, maxHeight),
      mobileSheet: false,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (item: ActionMenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  const panel = open && mounted && pos && createPortal(
    <div className="fixed inset-0 z-[200]" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className={`absolute inset-0 ${pos.mobileSheet ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`}
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="menu"
        aria-label={label}
        className={
          pos.mobileSheet
            ? 'absolute inset-x-0 bottom-0 overflow-hidden rounded-t-3xl border-t border-[#2b2f2b] bg-[#191c19] py-2 shadow-2xl'
            : 'absolute overflow-hidden rounded-2xl border border-[#2b2f2b] bg-[#191c19] py-1 shadow-2xl'
        }
        style={
          pos.mobileSheet
            ? { maxHeight: pos.maxHeight }
            : { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
        }
      >
        {pos.mobileSheet && (
          <div className="flex justify-center pb-1 pt-1">
            <div className="h-1 w-10 rounded-full bg-[#404540]" />
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: pos.mobileSheet ? pos.maxHeight - 20 : pos.maxHeight }}>
          {items.map(item => (
            <div key={item.id}>
              {item.separated && <div className="my-1 border-t border-[#2b2f2b]" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => run(item)}
                className={`flex min-h-[52px] w-full items-center gap-3 px-4 text-left transition-colors disabled:opacity-40 sm:min-h-[48px] sm:px-3.5 ${
                  item.danger
                    ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/15'
                    : 'text-[#f4efeb] hover:bg-white/5 active:bg-white/10'
                }`}
              >
                {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  {item.hint && (
                    <span className="block truncate text-[11px] text-[#aba8a4]">{item.hint}</span>
                  )}
                </span>
              </button>
            </div>
          ))}
        </div>
        {pos.mobileSheet && (
          <div className="border-t border-[#2b2f2b] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-[#2b2f2b] text-sm font-medium text-[#aba8a4]"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
          open
            ? 'border-[#349f2d]/40 bg-[#349f2d]/20 text-[#5ecf4f]'
            : 'border-[#2b2f2b] text-[#f4efeb] hover:border-[#404540] hover:text-[#f4efeb]'
        }`}
      >
        {trigger}
      </button>
      {panel}
    </div>
  );
}
