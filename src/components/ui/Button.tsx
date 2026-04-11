'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[#349f2d] hover:bg-[#287e22] text-white border border-[#349f2d] hover:border-[#287e22] shadow-[0_0_20px_rgba(52,159,45,0.25)] hover:shadow-[0_0_28px_rgba(52,159,45,0.4)]',
  secondary:
    'bg-[#1b1e1b] hover:bg-[#222522] text-[#f4efeb] border border-[#2b2f2b] hover:border-[#404540]',
  outline:
    'bg-transparent hover:bg-[#1b1e1b] text-[#5ecf4f] border border-[#349f2d] hover:border-[#5ecf4f]',
  ghost:
    'bg-transparent hover:bg-white/5 text-[#aba8a4] hover:text-[#f4efeb] border border-transparent',
  danger:
    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/40 hover:border-red-500/60',
  success:
    'bg-[#349f2d]/20 hover:bg-[#349f2d]/30 text-[#5ecf4f] border border-[#349f2d]/40 hover:border-[#5ecf4f]/60',
};

const sizeStyles: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
  sm: 'px-3.5 py-1.5 text-sm rounded-xl gap-2',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-2xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#349f2d]/60',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? 'w-full' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? (
          <Loader2 className="shrink-0 animate-spin" size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
        {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
