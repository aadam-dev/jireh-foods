type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-[#349f2d]/20 text-[#5ecf4f] border-[#349f2d]/40',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  red: 'bg-red-500/20 text-red-400 border-red-500/40',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  gray: 'bg-white/5 text-[#aba8a4] border-white/10',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
};

const dotColors: Record<BadgeVariant, string> = {
  green: 'bg-[#5ecf4f]',
  blue: 'bg-blue-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-400',
  purple: 'bg-purple-400',
  gray: 'bg-[#aba8a4]',
  orange: 'bg-orange-400',
};

export function Badge({ children, variant = 'gray', size = 'sm', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantStyles[variant],
        className,
      ].join(' ')}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

// Convenience status badges
export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING: { label: 'Pending', variant: 'yellow' },
    PREPARING: { label: 'Preparing', variant: 'blue' },
    READY: { label: 'Ready', variant: 'purple' },
    COMPLETED: { label: 'Completed', variant: 'green' },
    CANCELLED: { label: 'Cancelled', variant: 'red' },
  };
  const cfg = map[status] ?? { label: status, variant: 'gray' as BadgeVariant };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function PaymentBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    CASH: { label: 'Cash', variant: 'green' },
    MOMO: { label: 'MoMo', variant: 'yellow' },
    CARD: { label: 'Card', variant: 'blue' },
    BANK_TRANSFER: { label: 'Bank', variant: 'purple' },
    UNPAID: { label: 'Unpaid', variant: 'red' },
  };
  const cfg = map[method] ?? { label: method, variant: 'gray' as BadgeVariant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
