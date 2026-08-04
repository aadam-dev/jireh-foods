'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Monitor, PackagePlus, Receipt, ClipboardList, AlertTriangle, Clock,
  EyeOff, Wallet, Package, ShoppingBag, ArrowRight, Sunrise,
} from 'lucide-react';
import {
  StatCard, SectionCard, EmptyState, PageHeader, StatusChip, DataTable,
  formatGHS, Delta, type Column,
} from '@/src/components/admin/ui';
import dynamic from 'next/dynamic';
import { apiGet, errorMessage } from '@/src/lib/api-client';

/* recharts is ~110KB. Load it after the numbers so the figures an owner came
   for are readable immediately, and reserve the height to avoid a layout jump. */
const RevenueTrend = dynamic(() => import('@/src/components/admin/RevenueTrend'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] animate-pulse rounded-xl bg-[var(--fl-surface-2)]" />
  ),
});

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AttentionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  actionLabel: string;
}

interface DashboardData {
  serverTime: string;
  today: {
    revenue: number; orders: number; averageTicket: number;
    revenueTrend: number | null; lastWeekSameDayRevenue: number;
    topSeller: { name: string; qty: number } | null;
  };
  yesterday: { revenue: number; orders: number };
  week: {
    revenue: number; ingredientCost: number; expenses: number;
    moneyLeft: number; recipeCoverage: number; startDate: string;
  };
  month: { revenue: number; orders: number };
  trendChart: { date: string; revenue: number }[];
  channelMix: Record<string, { orders: number; revenue: number }>;
  paymentMix: Record<string, number>;
  recentOrders: any[];
  lowStockAlerts: {
    id: string; name: string; unit: string; quantity: number;
    threshold: number; costPerUnit: number; suggestedQty: number;
  }[];
  activeSession: any;
  attention: {
    staleShifts: { id: string; openedAt: string; openedBy: string }[];
    staleOrders: { id: string; orderNumber: string; status: string; total: number; waitingMinutes: number }[];
    unavailableItems: { id: string; name: string; category: string }[];
    duePayroll: { id: string; name: string; netPay: number; periodEnd: string; status: string }[];
  };
  topItems: { name: string; qty: number; revenue: number }[];
  stockValue: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  POS: 'Walk-in (register)',
  WALK_IN: 'Walk-in',
  ONLINE: 'WhatsApp / online',
  BOLT: 'Bolt Food',
};

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function TodayPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // The dashboard endpoint runs ~17 queries. An owner leaves this open all
      // day, so don't poll a tab nobody is looking at — refresh on return instead.
      if (document.hidden) return;
      try {
        const fresh = await apiGet<DashboardData>('/api/admin/dashboard');
        if (!cancelled) {
          setData(fresh);
          setLoadError('');
        }
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, 'Could not refresh the dashboard.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60_000);
    const onVisible = () => { if (!document.hidden) fetchData(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--fl-brand)] border-t-transparent" />
      </div>
    );
  }

  const t = data?.today;
  const w = data?.week;
  const hasSoldToday = (t?.orders ?? 0) > 0;

  /* Attention feed — one ember section, assembled from every open loop. */
  const attention: AttentionItem[] = [];
  for (const s of data?.attention?.staleShifts ?? []) {
    attention.push({
      id: `shift-${s.id}`,
      label: 'Shift never closed',
      detail: `${s.openedBy} opened the register on ${new Date(s.openedAt).toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'short' })} and it is still open. Cash is unaccounted for until it is closed.`,
      href: '/pos',
      actionLabel: 'Close shift',
    });
  }
  for (const o of data?.attention?.staleOrders ?? []) {
    attention.push({
      id: `order-${o.id}`,
      label: `Order ${o.orderNumber} waiting ${o.waitingMinutes} min`,
      detail: `Still ${o.status.toLowerCase()} — ${formatGHS(o.total)}.`,
      href: '/admin/orders',
      actionLabel: 'Open orders',
    });
  }
  const lowStock = data?.lowStockAlerts ?? [];
  if (lowStock.length > 0) {
    attention.push({
      id: 'low-stock',
      label: `${lowStock.length} ingredient${lowStock.length === 1 ? '' : 's'} low`,
      detail: lowStock.slice(0, 4).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ') +
        (lowStock.length > 4 ? `, +${lowStock.length - 4} more` : ''),
      href: '/admin/inventory',
      actionLabel: 'Build market list',
    });
  }
  for (const i of data?.attention?.unavailableItems ?? []) {
    attention.push({
      id: `86-${i.id}`,
      label: `${i.name} is 86'd`,
      detail: `Marked unavailable, so it is hidden from the register and the website. Turn it back on when it is back.`,
      href: '/admin/menu',
      actionLabel: 'Menu manager',
    });
  }
  for (const p of data?.attention?.duePayroll ?? []) {
    attention.push({
      id: `pay-${p.id}`,
      label: `Payroll due — ${p.name}`,
      detail: `${formatGHS(p.netPay)} for the period ending ${new Date(p.periodEnd).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}. Still ${p.status.toLowerCase()}.`,
      href: '/admin/payroll',
      actionLabel: 'Payroll',
    });
  }

  const channels = Object.entries(data?.channelMix ?? {})
    .sort((a, b) => b[1].revenue - a[1].revenue);

  const stockColumns: Column<DashboardData['lowStockAlerts'][number]>[] = [
    { key: 'name', header: 'Ingredient', render: r => <span className="font-medium">{r.name}</span> },
    {
      key: 'left', header: 'Left', numeric: true,
      render: r => <span className="fl-mono">{r.quantity} {r.unit}</span>,
    },
    {
      key: 'par', header: 'Par', numeric: true, hideOnMobile: true,
      render: r => <span className="fl-mono text-[var(--fl-ink-3)]">{r.threshold} {r.unit}</span>,
    },
    {
      key: 'buy', header: 'Buy about', numeric: true,
      render: r => (
        <span className="fl-mono">
          {Math.ceil(r.suggestedQty)} {r.unit}
          {r.costPerUnit > 0 && (
            <span className="ml-2 text-[var(--fl-ink-3)]">
              ≈ {formatGHS(Math.ceil(r.suggestedQty) * r.costPerUnit, { decimals: false })}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {loadError && (
        <div className="rounded-xl border border-[rgba(192,57,43,0.3)] bg-[#FBEAE8] px-4 py-3 text-sm text-[var(--fl-bad)]">
          {loadError} Showing the last figures loaded.
        </div>
      )}

      <PageHeader
        title={`${now ? greeting(now) : 'Hello'}, ${data?.activeSession?.openedByUser?.name ?? 'Chef'}`}
        subtitle={
          now
            ? now.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : undefined
        }
        actions={[
          { label: 'Open POS', href: '/pos', icon: Monitor, primary: true },
          { label: 'Receive stock', href: '/admin/purchasing', icon: PackagePlus },
          { label: 'Add expense', href: '/admin/expenses', icon: Receipt },
          { label: 'Market list', href: '/admin/inventory', icon: ClipboardList },
        ]}
      />

      {/* Live service strip — only while the register is open */}
      {data?.activeSession && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[rgba(30,92,58,0.28)] bg-[var(--fl-brand-soft)] px-5 py-3.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--fl-brand)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--fl-brand)]" />
            Register open · {data.activeSession.openedByUser?.name}
          </span>
          <span className="text-sm text-[var(--fl-ink-2)]">
            <span className="fl-mono font-semibold text-[var(--fl-ink)]">
              {data.activeSession._count?.orders ?? 0}
            </span>{' '}
            order{(data.activeSession._count?.orders ?? 0) === 1 ? '' : 's'} this shift
          </span>
          <span className="text-sm text-[var(--fl-ink-2)]">
            Opening float{' '}
            <span className="fl-mono font-semibold text-[var(--fl-ink)]">
              {formatGHS(Number(data.activeSession.openingFloat ?? 0))}
            </span>
          </span>
          {(data.attention?.staleOrders?.length ?? 0) > 0 && (
            <StatusChip label={`${data.attention?.staleOrders?.length} waiting`} tone="attention" icon={Clock} />
          )}
        </div>
      )}

      {/* ── Sales at a glance ───────────────────────────────────────────── */}
      <SectionCard
        title="Sales at a glance"
        explainer="Money collected, before costs. Today runs from midnight; the week starts Monday."
        deepLink="/admin/reports"
        deepLinkLabel="Reports"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Today"
            value={t?.revenue ?? 0}
            money
            delta={t?.revenueTrend ?? null}
            deltaLabel="vs same day last week"
            subline={`${t?.orders ?? 0} order${(t?.orders ?? 0) === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Yesterday"
            value={data?.yesterday?.revenue ?? 0}
            money
            subline={`${data?.yesterday?.orders ?? 0} order${(data?.yesterday?.orders ?? 0) === 1 ? '' : 's'}`}
          />
          <StatCard label="This week" value={w?.revenue ?? 0} money subline="Monday to today" />
          <StatCard
            label="This month"
            value={data?.month?.revenue ?? 0}
            money
            subline={`${data?.month?.orders ?? 0} order${(data?.month?.orders ?? 0) === 1 ? '' : 's'}`}
          />
        </div>

        <div className="mt-5">
          <p className="fl-label mb-2.5">Last 30 days</p>
          <RevenueTrend data={data?.trendChart ?? []} />
        </div>
      </SectionCard>

      {/* ── How is today going? ─────────────────────────────────────────── */}
      <SectionCard
        title="How is today going?"
        explainer="Money collected so far today, compared with the same weekday last week — restaurants run on a weekly rhythm, so last Monday tells you more than yesterday did."
        deepLink="/admin/reports"
        deepLinkLabel="Reports"
      >
        {hasSoldToday ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Collected today"
                value={t?.revenue ?? 0}
                money
                delta={t?.revenueTrend ?? null}
                deltaLabel="vs same day last week"
              />
              <StatCard label="Orders" value={t?.orders ?? 0} />
              <StatCard label="Average ticket" value={t?.averageTicket ?? 0} money />
              <StatCard
                label="Top seller so far"
                value={t?.topSeller?.name ?? '—'}
                countUp={false}
                subline={t?.topSeller ? `${t.topSeller.qty} sold today` : undefined}
              />
            </div>

            {channels.length > 0 && (
              <div className="mt-5">
                <p className="fl-label mb-2.5">Where the orders came from</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {channels.map(([channel, v]) => (
                    <div
                      key={channel}
                      className="rounded-xl border border-[var(--fl-line)] bg-[var(--fl-surface-2)] px-3.5 py-3"
                    >
                      <p className="text-[13px] font-medium text-[var(--fl-ink)]">
                        {CHANNEL_LABELS[channel] ?? channel}
                      </p>
                      <p className="fl-mono mt-1 text-sm tabular-nums text-[var(--fl-ink-2)]">
                        {v.orders} order{v.orders === 1 ? '' : 's'} · {formatGHS(v.revenue, { decimals: false })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <EmptyState
              icon={Sunrise}
              title="No sales yet — service starts when you open the register."
              body={
                (data?.yesterday?.orders ?? 0) > 0
                  ? `Yesterday you closed on ${formatGHS(data!.yesterday!.revenue)} from ${data!.yesterday!.orders} order${data!.yesterday!.orders === 1 ? '' : 's'}. This week so far: ${formatGHS(data?.week?.revenue ?? 0)}.`
                  : `This week so far: ${formatGHS(data?.week?.revenue ?? 0)}.`
              }
              actionLabel="Open POS Register"
              actionHref="/pos"
            />
            {lowStock.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(232,134,46,0.35)] bg-[var(--fl-accent-soft)] px-4 py-3">
                <p className="text-[13px] text-[var(--fl-ink)]">
                  Before service: {lowStock.length} ingredient{lowStock.length === 1 ? ' is' : 's are'} low.
                  Build today&apos;s market list.
                </p>
                <Link
                  href="/admin/inventory"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[var(--fl-accent)] px-3.5 text-[13px] font-semibold text-white"
                >
                  Market list <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Are we making money? ────────────────────────────────────────── */}
      <SectionCard
        title="Are we making money?"
        explainer="Money left = sales collected − ingredient costs from your recipes − logged expenses. Waste and comps are included once you log them."
        deepLink="/admin/reports"
        deepLinkLabel="Full picture"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Collected this week" value={w?.revenue ?? 0} money />
          <StatCard
            label="Ingredient cost"
            value={w?.ingredientCost ?? 0}
            money
            subline={
              (w?.recipeCoverage ?? 0) < 100
                ? `Only ${w?.recipeCoverage ?? 0}% of what you sold has a recipe, so the real cost is higher.`
                : 'Every item sold this week is costed from its recipe.'
            }
          />
          <StatCard label="Logged expenses" value={w?.expenses ?? 0} money />
          <StatCard
            label="Money left"
            value={w?.moneyLeft ?? 0}
            money
            attention={(w?.moneyLeft ?? 0) < 0}
            subline={
              (w?.moneyLeft ?? 0) < 0
                ? 'You are spending more than you collected this week.'
                : 'What is left after ingredients and logged expenses.'
            }
          />
        </div>

        {(w?.recipeCoverage ?? 0) < 100 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--fl-line)] bg-[var(--fl-surface-2)] px-4 py-3">
            <p className="text-[13px] text-[var(--fl-ink-2)]">
              Add recipes to the rest of your menu and this number becomes the truth, not an estimate.
            </p>
            <Link
              href="/admin/boms"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--fl-line)] px-3.5 text-[13px] font-medium text-[var(--fl-brand)] hover:bg-[var(--fl-brand-soft)]"
            >
              Recipes <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </SectionCard>

      {/* ── What needs attention? ───────────────────────────────────────── */}
      <SectionCard
        title="What needs attention?"
        explainer="Everything open right now, in one place. When this section is empty, nothing is waiting on you."
        attention={attention.length > 0}
      >
        {attention.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nothing needs your attention right now."
            body="Stock is above par, no shifts are hanging open and no orders are overdue."
          />
        ) : (
          <ul className="space-y-2.5" role="list">
            {attention.map(item => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[rgba(232,134,46,0.35)] bg-[var(--fl-surface)] px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--fl-ink)]">
                    <AlertTriangle size={14} className="shrink-0 text-[var(--fl-accent)]" />
                    {item.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--fl-ink-2)]">{item.detail}</p>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--fl-accent)] px-3.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {item.actionLabel} <ArrowRight size={13} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Today's orders ────────────────────────────────────────────── */}
        <SectionCard
          title="What has sold today?"
          explainer="Every ticket rung up since midnight, newest first."
          deepLink="/admin/orders"
          deepLinkLabel="All orders"
        >
          {(data?.recentOrders ?? []).length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No tickets yet today."
              body="Orders appear here the moment the register rings one up."
              actionLabel="Open POS Register"
              actionHref="/pos"
            />
          ) : (
            <ul className="divide-y divide-[var(--fl-line)]" role="list">
              {data!.recentOrders.map(order => (
                <li key={order.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="fl-mono text-[13px] font-semibold text-[var(--fl-ink)]">
                        {order.orderNumber}
                      </span>
                      <StatusChip label={order.status} />
                    </div>
                    <p className="mt-1 truncate text-[13px] text-[var(--fl-ink-2)]">
                      {order.items?.map((i: any) => `${i.quantity}× ${i.menuItem?.name ?? i.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="fl-mono text-sm font-semibold tabular-nums text-[var(--fl-ink)]">
                      {formatGHS(Number(order.total))}
                    </p>
                    <p className="fl-mono mt-0.5 text-[11px] text-[var(--fl-ink-3)]">
                      {new Date(order.createdAt).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ── Market list ───────────────────────────────────────────────── */}
        <SectionCard
          title="What should we buy?"
          explainer="Ingredients at or below their par level, with a rough quantity and cost for the market run."
          deepLink="/admin/inventory"
          deepLinkLabel="Inventory"
        >
          <DataTable
            columns={stockColumns}
            rows={lowStock}
            rowKey={r => r.id}
            empty={
              <EmptyState
                icon={Package}
                title="Every ingredient is above its par level."
                body={
                  data?.stockValue
                    ? `You are holding about ${formatGHS(data.stockValue)} of stock.`
                    : 'Set par levels on your ingredients and this becomes your daily market list.'
                }
                actionLabel="Open inventory"
                actionHref="/admin/inventory"
              />
            }
          />
        </SectionCard>
      </div>

      {/* ── This month's best sellers ───────────────────────────────────── */}
      {(data?.topItems ?? []).length > 0 && (
        <SectionCard
          title="What sells best this month?"
          explainer="Ranked by plates sold. The top few are what your kitchen should never run out of."
          deepLink="/admin/reports"
          deepLinkLabel="Reports"
        >
          <ul className="space-y-2" role="list">
            {data!.topItems.map((item, index) => {
              const max = data!.topItems[0]?.qty || 1;
              return (
                <li key={item.name} className="flex items-center gap-3">
                  <span className="fl-mono w-5 shrink-0 text-[11px] text-[var(--fl-ink-3)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-[var(--fl-ink)]">{item.name}</span>
                      <span className="fl-mono shrink-0 text-[13px] tabular-nums text-[var(--fl-ink-2)]">
                        {item.qty} · {formatGHS(item.revenue, { decimals: false })}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--fl-surface-2)]">
                      <div
                        className="h-full rounded-full bg-[var(--fl-brand)]"
                        style={{ width: `${Math.max(4, (item.qty / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
