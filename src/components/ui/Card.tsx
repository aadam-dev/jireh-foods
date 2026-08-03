'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, className = '', hover = false, onClick, padding = 'md' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-[var(--card)] border border-[var(--border)] rounded-2xl',
        paddingStyles[padding],
        hover ? 'hover:border-[var(--border-strong)] hover:bg-[var(--surface-light)] transition duration-200 cursor-pointer' : '',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-xs font-semibold text-[var(--muted)] uppercase tracking-widest ${className}`}>
      {children}
    </h3>
  );
}
