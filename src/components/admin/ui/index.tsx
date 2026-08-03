'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   Fresh Ledger — shared back office components.
   Build once here, reuse on every admin screen. Rules that hold everywhere:
     · money is always tabular and GH₵-prefixed
     · deltas are always signed and coloured good/bad
     · ember orange means "something needs doing" — nothing else
     · every empty state teaches or prompts the next action, never just "No data"
   ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────────── */

export function formatGHS(value: number, opts: { decimals?: boolean } = {}) {
  const decimals = opts.decimals ?? true;
  return `GH₵ ${value.toLocaleString('en-GH', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

/** Signed, coloured delta — "+12.4%" green, "−8.1%" red, "no change" neutral. */
export function Delta({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) {
    return <span className="text-[13px] text-[var(--fl-ink-3)]">no change</span>;
  }
  const up = rounded > 0;
  return (
    <span
      className="fl-mono text-[13px] font-medium tabular-nums"
      style={{ color: up ? 'var(--fl-good)' : 'var(--fl-bad)' }}
    >
      {up ? '+' : '−'}
      {Math.abs(rounded)}
      {suffix}
    </span>
  );
}

/* ── count-up (0.8s, once) ───────────────────────────────────────────────── */

function useCountUp(target: number, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const done = useRef(false);

  useEffect(() => {
    if (!enabled || done.current) {
      setValue(target);
      return;
    }
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target === 0) {
      setValue(target);
      done.current = true;
      return;
    }
    const start = performance.now();
    const DURATION = 800;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      // ease-out cubic
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return value;
}

/* ── StatCard ────────────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  money = false,
  delta = null,
  deltaLabel,
  subline,
  attention = false,
  href,
  countUp = true,
}: {
  label: string;
  value: number | string;
  money?: boolean;
  delta?: number | null;
  deltaLabel?: string;
  /** Plain-language line under the number — say what it means, not what it is. */
  subline?: string;
  /** Turns the card ember — use only when the owner must act. */
  attention?: boolean;
  href?: string;
  countUp?: boolean;
}) {
  const numeric = typeof value === 'number';
  const animated = useCountUp(numeric ? value : 0, numeric && countUp);
  const shown = numeric
    ? money
      ? formatGHS(animated)
      : Math.round(animated).toLocaleString('en-GH')
    : value;

  const body = (
    <>
      <p className="fl-label">{label}</p>
      <p
        className="fl-kpi mt-2"
        style={{ color: attention ? 'var(--fl-accent)' : 'var(--fl-ink)' }}
      >
        {shown}
      </p>
      {(delta !== null || subline) && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Delta value={delta} />
          {deltaLabel && <span className="text-[13px] text-[var(--fl-ink-3)]">{deltaLabel}</span>}
        </div>
      )}
      {subline && <p className="mt-2 text-[13px] leading-snug text-[var(--fl-ink-2)]">{subline}</p>}
    </>
  );

  const className = [
    'block rounded-2xl border p-5 transition-colors',
    attention
      ? 'border-[rgba(232,134,46,0.35)] bg-[var(--fl-accent-soft)]'
      : 'border-[var(--fl-line)] bg-[var(--fl-surface)]',
    href ? 'hover:border-[rgba(30,92,58,0.35)]' : '',
  ].join(' ');

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/* ── SectionCard ─────────────────────────────────────────────────────────── */

export function SectionCard({
  title,
  explainer,
  deepLink,
  deepLinkLabel = 'Open',
  attention = false,
  actions,
  children,
}: {
  /** Phrase as the question an owner actually asks. */
  title: string;
  explainer?: string;
  deepLink?: string;
  deepLinkLabel?: string;
  attention?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={[
        // min-w-0 matters: as a grid/flex child the default min-width:auto lets
        // a wide table inside push the whole card past the viewport on phones.
        'min-w-0 rounded-2xl border',
        attention
          ? 'border-[rgba(232,134,46,0.35)] bg-[var(--fl-accent-soft)]'
          : 'border-[var(--fl-line)] bg-[var(--fl-surface)]',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--fl-line)] px-5 py-4">
        <div className="min-w-0">
          <h2
            className="fl-display text-[19px] leading-tight"
            style={{ color: attention ? 'var(--fl-accent)' : 'var(--fl-ink)' }}
          >
            {title}
          </h2>
          {explainer && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--fl-ink-2)]">
              {explainer}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {deepLink && (
            <Link
              href={deepLink}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--fl-line)] px-3.5 text-[13px] font-medium text-[var(--fl-brand)] transition-colors hover:bg-[var(--fl-brand-soft)]"
            >
              {deepLinkLabel} <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

/* ── StatusChip ──────────────────────────────────────────────────────────── */

type ChipTone = 'good' | 'bad' | 'attention' | 'neutral' | 'brand';

const CHIP_TONES: Record<ChipTone, { bg: string; fg: string; border: string }> = {
  good: { bg: 'rgba(46,139,87,0.12)', fg: 'var(--fl-good)', border: 'rgba(46,139,87,0.28)' },
  bad: { bg: 'rgba(192,57,43,0.10)', fg: 'var(--fl-bad)', border: 'rgba(192,57,43,0.28)' },
  attention: { bg: 'var(--fl-accent-soft)', fg: 'var(--fl-accent)', border: 'rgba(232,134,46,0.35)' },
  brand: { bg: 'var(--fl-brand-soft)', fg: 'var(--fl-brand)', border: 'rgba(30,92,58,0.28)' },
  neutral: { bg: 'var(--fl-surface-2)', fg: 'var(--fl-ink-2)', border: 'var(--fl-line)' },
};

/** Known statuses map to a tone automatically; pass `tone` to override. */
const STATUS_TONES: Record<string, ChipTone> = {
  PAID: 'good', COMPLETED: 'good', OK: 'good', OPEN: 'good', ACTIVE: 'good', IN_STOCK: 'good',
  PENDING: 'attention', LOW: 'attention', PREPARING: 'attention', PARTIAL: 'attention',
  VOID: 'bad', VOIDED: 'bad', CANCELLED: 'bad', OUT: 'bad', OUT_OF_STOCK: 'bad', FAILED: 'bad',
  CLOSED: 'neutral', DRAFT: 'neutral', UNPAID: 'neutral',
};

export function StatusChip({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone?: ChipTone;
  icon?: LucideIcon;
}) {
  const resolved = tone ?? STATUS_TONES[label.toUpperCase().replace(/[\s-]/g, '_')] ?? 'neutral';
  const t = CHIP_TONES[resolved];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ background: t.bg, color: t.fg, borderColor: t.border }}
    >
      {Icon && <Icon size={11} />}
      {label}
    </span>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon?: LucideIcon;
  /** One sentence. Teach or prompt — never "No data". */
  title: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--fl-line-strong)] bg-[var(--fl-surface-2)] px-6 py-10 text-center">
      {Icon && (
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--fl-brand-soft)] text-[var(--fl-brand)]">
          <Icon size={19} />
        </span>
      )}
      <p className="max-w-md text-[15px] font-medium text-[var(--fl-ink)]">{title}</p>
      {body && <p className="max-w-md text-[13px] leading-relaxed text-[var(--fl-ink-2)]">{body}</p>}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="mt-1 inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--fl-brand)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--fl-brand-hover)]"
          >
            {actionLabel} <ArrowRight size={15} />
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="mt-1 inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[var(--fl-brand)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--fl-brand-hover)]"
          >
            {actionLabel} <ArrowRight size={15} />
          </button>
        )
      )}
    </div>
  );
}

/* ── PageHeader ──────────────────────────────────────────────────────────── */

export type QuickAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  primary?: boolean;
};

export function PageHeader({
  title,
  subtitle,
  actions = [],
}: {
  title: string;
  subtitle?: string;
  actions?: QuickAction[];
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="fl-display text-[26px] leading-tight text-[var(--fl-ink)] sm:text-[30px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-[var(--fl-ink-2)]">{subtitle}</p>}
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map(action => {
            const Icon = action.icon;
            const cls = [
              'inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
              action.primary
                ? 'bg-[var(--fl-brand)] text-white hover:bg-[var(--fl-brand-hover)]'
                : 'border border-[var(--fl-line)] bg-[var(--fl-surface)] text-[var(--fl-ink)] hover:bg-[var(--fl-brand-soft)]',
            ].join(' ');
            return action.href ? (
              <Link key={action.label} href={action.href} className={cls}>
                {Icon && <Icon size={15} />} {action.label}
              </Link>
            ) : (
              <button key={action.label} onClick={action.onClick} className={cls}>
                {Icon && <Icon size={15} />} {action.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}

/* ── DataTable ───────────────────────────────────────────────────────────── */

export type Column<T> = {
  key: string;
  header: string;
  /** Right-align and tabular — use for money and counts. */
  numeric?: boolean;
  /** Hide below sm: so phone views stay readable. */
  hideOnMobile?: boolean;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Required — a table with nothing in it must still tell the owner what to do. */
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--fl-line)]">
            {columns.map(col => (
              <th
                key={col.key}
                scope="col"
                className={[
                  'fl-label sticky top-0 whitespace-nowrap bg-[var(--fl-surface)] pb-2.5 pt-0 text-left font-normal',
                  col.numeric ? 'text-right' : '',
                  col.hideOnMobile ? 'hidden sm:table-cell' : '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                'border-b border-[var(--fl-line)] transition-colors last:border-0',
                onRowClick ? 'cursor-pointer hover:bg-[var(--fl-brand-soft)]' : '',
              ].join(' ')}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={[
                    'py-3 pr-4 align-middle text-[var(--fl-ink)] last:pr-0',
                    col.numeric ? 'text-right tabular-nums' : '',
                    col.hideOnMobile ? 'hidden sm:table-cell' : '',
                  ].join(' ')}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
