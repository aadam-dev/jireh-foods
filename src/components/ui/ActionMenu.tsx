'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/* Overflow menu for the register.
   ────────────────────────────────────────────────────────────────────────────
   Secondary actions used to be scattered: some in the header and desktop-only,
   some behind a long-press with no affordance, some reachable only by leaving
   the screen you were on. This is the one place a cashier looks when the thing
   they want is not a menu tile.

   Built rather than copied: the existing hand-rolled dropdown in the admin
   reports page has 34px rows, listens on mousedown only, and carries no
   keyboard or ARIA support. On a greasy tablet mid-service that is not usable,
   so this matches the register's own conventions instead — 48px rows,
   pointerdown, Escape, and focus returned to the trigger on close. */

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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // pointerdown so a touch-scroll outside dismisses it, which mousedown misses.
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`flex items-center justify-center rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
          open
            ? 'border-[#349f2d]/40 bg-[#349f2d]/20 text-[#5ecf4f]'
            : 'border-[#2b2f2b] text-[#aba8a4] hover:border-[#404540] hover:text-[#f4efeb]'
        }`}
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute top-full z-[80] mt-1.5 w-64 overflow-hidden rounded-2xl border border-[#2b2f2b] bg-[#191c19] py-1 shadow-2xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map(item => (
            <div key={item.id}>
              {item.separated && <div className="my-1 border-t border-[#2b2f2b]" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => run(item)}
                className={`flex min-h-[48px] w-full items-center gap-3 px-3.5 text-left transition-colors disabled:opacity-40 ${
                  item.danger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-[#f4efeb] hover:bg-white/5'
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
      )}
    </div>
  );
}
