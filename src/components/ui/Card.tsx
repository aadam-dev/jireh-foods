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
        'bg-[#191c19] border border-[#2b2f2b] rounded-2xl',
        paddingStyles[padding],
        hover ? 'hover:border-[#404540] hover:bg-[#1b1e1b] transition-all duration-200 cursor-pointer' : '',
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
    <h3 className={`text-sm font-semibold text-[#aba8a4] uppercase tracking-wider ${className}`}>
      {children}
    </h3>
  );
}
