import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: number; // percentage, positive = up, negative = down
  trendLabel?: string;
  icon: React.ReactNode;
  iconBg?: string;
  className?: string;
}

export function StatCard({ title, value, subValue, trend, trendLabel, icon, iconBg = 'bg-[#349f2d]/20', className = '' }: StatCardProps) {
  const trendUp = trend !== undefined && trend > 0;
  const trendDown = trend !== undefined && trend < 0;
  const trendFlat = trend === 0;

  return (
    <div className={`bg-[#191c19] border border-[#2b2f2b] rounded-2xl p-5 hover:border-[#404540] transition-colors ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-[#aba8a4] uppercase tracking-wider">{title}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-[#f4efeb] font-serif">{value}</p>
        {subValue && <p className="text-xs text-[#aba8a4]">{subValue}</p>}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          {trendUp && <TrendingUp size={13} className="text-[#5ecf4f]" />}
          {trendDown && <TrendingDown size={13} className="text-red-400" />}
          {trendFlat && <Minus size={13} className="text-[#aba8a4]" />}
          <span className={`text-xs font-medium ${trendUp ? 'text-[#5ecf4f]' : trendDown ? 'text-red-400' : 'text-[#aba8a4]'}`}>
            {trendUp ? '+' : ''}{trend.toFixed(1)}%
          </span>
          {trendLabel && <span className="text-xs text-[#aba8a4]">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
