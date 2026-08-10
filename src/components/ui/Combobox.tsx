'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

/* Type-or-pick field for the register.
   ────────────────────────────────────────────────────────────────────────────
   Free text first, suggestions second: a cashier must always be able to just
   type a name and move on. The list is an accelerator, never a gate — there is
   no "please select from the list" state, and closing the list keeps whatever
   was typed.

   Rows are 48px because this is used with a thumb, mid-service. The existing
   hand-rolled dropdown in the admin reports page uses 34px rows and mousedown
   only; both are wrong for a tablet, so this does not copy it. */

export interface ComboboxOption {
  id: string;
  label: string;
  /** Secondary line — a phone number, typically. */
  sub?: string | null;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when a suggestion is chosen, so the caller can capture its id/sub. */
  onPick?: (option: ComboboxOption) => void;
  options: ComboboxOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  value,
  onChange,
  onPick,
  options,
  placeholder,
  label,
  disabled,
  className = '',
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // pointerdown, not mousedown: a touch scroll should dismiss the list the
  // same way a click outside does.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Reset the highlight whenever the list content changes, so Enter can never
  // commit a row the cashier is no longer looking at.
  useEffect(() => { setActive(-1); }, [options]);

  const choose = (opt: ComboboxOption) => {
    onChange(opt.label);
    onPick?.(opt);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return; }
    if (!options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(i => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive(i => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter' && open && active >= 0) {
      // Only intercept Enter when a row is actually highlighted — otherwise it
      // belongs to the form, not to us.
      e.preventDefault();
      choose(options[active]);
    }
  };

  const showList = open && options.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <p className="mb-1 text-[11px] font-medium text-[#aba8a4]">{label}</p>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="w-full rounded-xl border border-[#2b2f2b] bg-[#111311] px-3 py-2.5 pr-9 text-sm text-[#f4efeb] placeholder:text-[#5f635f] focus:border-[#349f2d] focus:outline-none disabled:opacity-50"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); inputRef.current?.focus(); }}
            aria-label="Clear"
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#aba8a4] hover:text-[#f4efeb]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#2b2f2b] bg-[#191c19] py-1 shadow-2xl"
        >
          {options.map((opt, i) => {
            const picked = opt.label.toLowerCase() === value.trim().toLowerCase();
            return (
              <li key={opt.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // pointerdown fires before the input's blur, so the tap is
                  // never swallowed by the list closing first.
                  onPointerDown={e => { e.preventDefault(); choose(opt); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-[48px] w-full items-center gap-2 px-3 text-left transition-colors ${
                    i === active ? 'bg-[#349f2d]/15' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[#f4efeb]">{opt.label}</span>
                    {opt.sub && <span className="block truncate text-[11px] text-[#aba8a4]">{opt.sub}</span>}
                  </span>
                  {picked && <Check size={14} className="shrink-0 text-[#5ecf4f]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
