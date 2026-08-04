'use client';

/* 30-day revenue trend.
   ────────────────────────────────────────────────────────────────────────────
   Split into its own module so recharts is code-split out of the dashboard
   bundle — it is ~110KB and the owner should see their numbers before a chart
   library finishes downloading. Imported with next/dynamic at the call site. */

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export interface TrendPoint { date: string; revenue: number }

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });

export default function RevenueTrend({ data }: { data: TrendPoint[] }) {
  const hasSales = data.some(d => d.revenue > 0);

  if (!hasSales) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--fl-line-strong)] bg-[var(--fl-surface-2)] px-6 text-center">
        <p className="text-[13px] text-[var(--fl-ink-2)]">
          The trend line fills in as you ring up sales. Come back after a few days of service.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="jirehRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E5C3A" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#1E5C3A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,36,32,0.10)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: 'rgba(28,36,32,0.44)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: 'rgba(28,36,32,0.44)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(28,36,32,0.18)' }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid rgba(28,36,32,0.10)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v: string) =>
              new Date(v).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'long' })
            }
            formatter={(v: number) => [
              `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              'Collected',
            ]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#1E5C3A"
            strokeWidth={2}
            fill="url(#jirehRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
